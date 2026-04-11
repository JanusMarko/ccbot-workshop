"""Claude Code session management — the core state hub for CCWeb.

Simplified from ccbot's session.py: replaces Telegram thread_bindings
with a flat client_bindings model (client_id → window_id). Removes
group_chat_ids and all Telegram-specific routing.

Manages the key mappings:
  Window→Session (window_states): which Claude session_id a window holds.
  Client→Window (client_bindings): which window a WebSocket client is viewing.

Key class: SessionManager (singleton instantiated as `session_manager`).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import aiofiles

from .config import config
from .core.tmux_manager import SHELL_COMMANDS, tmux_manager
from .core.transcript_parser import TranscriptParser
from .core.utils import atomic_write_json

logger = logging.getLogger(__name__)

# Patterns for detecting Claude Code resume commands in pane output
_RESUME_CMD_RE = re.compile(r"(claude\s+(?:--resume|-r)\s+\S+)")
_STOPPED_RE = re.compile(r"Stopped\s+.*claude", re.IGNORECASE)


def _extract_resume_command(pane_text: str) -> str | None:
    """Extract a resume command from pane content after Claude Code exit."""
    if _STOPPED_RE.search(pane_text):
        return "fg"
    match = _RESUME_CMD_RE.search(pane_text)
    if match:
        return match.group(1)
    return None


@dataclass
class WindowState:
    """Persistent state for a tmux window."""

    session_id: str = ""
    cwd: str = ""
    window_name: str = ""

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"session_id": self.session_id, "cwd": self.cwd}
        if self.window_name:
            d["window_name"] = self.window_name
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> WindowState:
        return cls(
            session_id=data.get("session_id", ""),
            cwd=data.get("cwd", ""),
            window_name=data.get("window_name", ""),
        )


@dataclass
class ClaudeSession:
    """Information about a Claude Code session."""

    session_id: str
    summary: str
    message_count: int
    file_path: str


@dataclass
class SessionManager:
    """Manages session state for CCWeb.

    Simplified from ccbot: no thread_bindings, no group_chat_ids.
    Client bindings are ephemeral (WebSocket connections) and not persisted.
    """

    window_states: dict[str, WindowState] = field(default_factory=dict)
    window_display_names: dict[str, str] = field(default_factory=dict)
    # Per-client read offsets (client_id → {window_id → byte_offset})
    # Not persisted — clients are ephemeral
    user_window_offsets: dict[int, dict[str, int]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self._load_state()

    def _save_state(self) -> None:
        state: dict[str, Any] = {
            "window_states": {k: v.to_dict() for k, v in self.window_states.items()},
            "window_display_names": self.window_display_names,
        }
        atomic_write_json(config.state_file, state)
        logger.debug("State saved to %s", config.state_file)

    def _is_window_id(self, key: str) -> bool:
        """Check if a key looks like a tmux window ID (e.g. '@0', '@12')."""
        return key.startswith("@") and len(key) > 1 and key[1:].isdigit()

    def _load_state(self) -> None:
        """Load state synchronously during initialization."""
        if config.state_file.exists():
            try:
                state = json.loads(config.state_file.read_text())
                self.window_states = {
                    k: WindowState.from_dict(v)
                    for k, v in state.get("window_states", {}).items()
                }
                self.window_display_names = state.get("window_display_names", {})
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning("Failed to load state: %s", e)
                self.window_states = {}
                self.window_display_names = {}

    async def resolve_stale_ids(self) -> None:
        """Re-resolve persisted window IDs against live tmux windows."""
        windows = await tmux_manager.list_windows()
        live_by_name: dict[str, str] = {}
        live_ids: set[str] = set()
        for w in windows:
            live_by_name[w.window_name] = w.window_id
            live_ids.add(w.window_id)

        changed = False
        new_window_states: dict[str, WindowState] = {}
        for key, ws in self.window_states.items():
            if self._is_window_id(key):
                if key in live_ids:
                    new_window_states[key] = ws
                else:
                    display = self.window_display_names.get(key, ws.window_name or key)
                    new_id = live_by_name.get(display)
                    if new_id:
                        logger.info(
                            "Re-resolved stale window_id %s -> %s (name=%s)",
                            key,
                            new_id,
                            display,
                        )
                        new_window_states[new_id] = ws
                        ws.window_name = display
                        self.window_display_names[new_id] = display
                        changed = True
                    else:
                        logger.info("Dropping stale window_state: %s", key)
                        changed = True
            else:
                new_id = live_by_name.get(key)
                if new_id:
                    logger.info("Migrating window_state key %s -> %s", key, new_id)
                    ws.window_name = key
                    new_window_states[new_id] = ws
                    self.window_display_names[new_id] = key
                    changed = True
                else:
                    changed = True

        self.window_states = new_window_states
        if changed:
            self._save_state()

    async def load_session_map(self) -> None:
        """Read session_map.json and update window_states."""
        if not config.session_map_file.exists():
            return
        try:
            async with aiofiles.open(config.session_map_file, "r") as f:
                content = await f.read()
            session_map = json.loads(content)
        except (json.JSONDecodeError, OSError):
            return

        prefix = f"{config.tmux_session_name}:"
        valid_wids: set[str] = set()
        changed = False

        for key, info in session_map.items():
            if not key.startswith(prefix):
                continue
            window_id = key[len(prefix) :]
            if not self._is_window_id(window_id):
                continue
            valid_wids.add(window_id)
            new_sid = info.get("session_id", "")
            new_cwd = info.get("cwd", "")
            new_wname = info.get("window_name", "")
            if not new_sid:
                continue
            state = self.get_window_state(window_id)
            if state.session_id != new_sid or state.cwd != new_cwd:
                state.session_id = new_sid
                state.cwd = new_cwd
                changed = True
            if new_wname:
                state.window_name = new_wname
                if self.window_display_names.get(window_id) != new_wname:
                    self.window_display_names[window_id] = new_wname
                    changed = True

        # Only clean up stale entries when we actually found valid entries.
        # If valid_wids is empty (e.g., session_map is mid-write or has no
        # entries for our tmux session), skip cleanup to avoid wiping all state.
        if valid_wids:
            stale_wids = [w for w in self.window_states if w and w not in valid_wids]
            for wid in stale_wids:
                del self.window_states[wid]
                changed = True

        if changed:
            self._save_state()

    # --- Display name management ---

    def get_display_name(self, window_id: str) -> str:
        return self.window_display_names.get(window_id, window_id)

    # --- Window state management ---

    def get_window_state(self, window_id: str) -> WindowState:
        """Get or create window state (use for write paths like load_session_map)."""
        if window_id not in self.window_states:
            self.window_states[window_id] = WindowState()
        return self.window_states[window_id]

    def lookup_window_state(self, window_id: str) -> WindowState | None:
        """Look up window state without creating it (use for read-only checks)."""
        return self.window_states.get(window_id)

    # --- Window → Session resolution ---

    def _build_session_file_path(self, session_id: str, cwd: str) -> Path | None:
        if not session_id or not cwd:
            return None
        encoded_cwd = cwd.replace("/", "-")
        return config.claude_projects_path / encoded_cwd / f"{session_id}.jsonl"

    async def resolve_session_for_window(self, window_id: str) -> ClaudeSession | None:
        """Resolve a tmux window to the best matching Claude session."""
        state = self.lookup_window_state(window_id)
        if not state or not state.session_id or not state.cwd:
            return None

        file_path = self._build_session_file_path(state.session_id, state.cwd)
        if not file_path or not file_path.exists():
            pattern = f"*/{state.session_id}.jsonl"
            matches = list(config.claude_projects_path.glob(pattern))
            if matches:
                file_path = matches[0]
            else:
                return None

        return ClaudeSession(
            session_id=state.session_id,
            summary="",
            message_count=0,
            file_path=str(file_path),
        )

    async def wait_for_session_map_entry(
        self, window_id: str, timeout: float = 5.0, interval: float = 0.5
    ) -> bool:
        """Poll session_map.json until an entry for window_id appears."""
        key = f"{config.tmux_session_name}:{window_id}"
        deadline = asyncio.get_running_loop().time() + timeout
        while asyncio.get_running_loop().time() < deadline:
            try:
                if config.session_map_file.exists():
                    async with aiofiles.open(config.session_map_file, "r") as f:
                        content = await f.read()
                    sm = json.loads(content)
                    info = sm.get(key, {})
                    if info.get("session_id"):
                        await self.load_session_map()
                        return True
            except (json.JSONDecodeError, OSError):
                pass
            await asyncio.sleep(interval)
        return False

    # --- Tmux helpers ---

    async def send_to_window(self, window_id: str, text: str) -> tuple[bool, str]:
        """Send text to a tmux window by ID, auto-resuming if needed."""
        display = self.get_display_name(window_id)
        window = await tmux_manager.find_window_by_id(window_id)
        if not window:
            return False, "Window not found (may have been closed)"
        if window.pane_current_command in SHELL_COMMANDS:
            resumed = await self._try_resume_claude(window_id, display)
            if not resumed:
                return False, "Claude Code is not running (session exited)"
        success = await tmux_manager.send_keys(window.window_id, text)
        if success:
            return True, f"Sent to {display}"
        return False, "Failed to send keys"

    async def _try_resume_claude(self, window_id: str, display: str) -> bool:
        """Attempt to resume Claude Code when pane has dropped to shell."""
        pane_text = await tmux_manager.capture_pane(window_id)
        if not pane_text:
            return False
        resume_cmd = _extract_resume_command(pane_text)
        if not resume_cmd:
            return False
        logger.info(
            "Auto-resuming Claude in %s (%s): %s", window_id, display, resume_cmd
        )
        await tmux_manager.send_keys(window_id, resume_cmd)
        max_wait = 3.0 if resume_cmd == "fg" else 15.0
        elapsed = 0.0
        while elapsed < max_wait:
            await asyncio.sleep(0.5)
            elapsed += 0.5
            w = await tmux_manager.find_window_by_id(window_id)
            if w and w.pane_current_command not in SHELL_COMMANDS:
                await asyncio.sleep(1.0)
                return True
        return False

    # --- Message history ---

    async def get_recent_messages(
        self,
        window_id: str,
        *,
        start_byte: int = 0,
        end_byte: int | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        """Get messages for a window's session."""
        session = await self.resolve_session_for_window(window_id)
        if not session or not session.file_path:
            return [], 0

        file_path = Path(session.file_path)
        if not file_path.exists():
            return [], 0

        entries: list[dict[str, Any]] = []
        try:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                if start_byte > 0:
                    await f.seek(start_byte)
                while True:
                    if end_byte is not None:
                        current_pos = await f.tell()
                        if current_pos >= end_byte:
                            break
                    line = await f.readline()
                    if not line:
                        break
                    data = TranscriptParser.parse_line(line)
                    if data:
                        entries.append(data)
        except OSError as e:
            logger.error("Error reading session file %s: %s", file_path, e)
            return [], 0

        parsed_entries, _ = TranscriptParser.parse_entries(entries)
        all_messages = [
            {
                "role": e.role,
                "text": e.text,
                "content_type": e.content_type,
                "timestamp": e.timestamp,
            }
            for e in parsed_entries
        ]
        return all_messages, len(all_messages)


# Singleton
session_manager = SessionManager()
