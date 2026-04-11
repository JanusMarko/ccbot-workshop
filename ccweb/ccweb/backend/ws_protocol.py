"""WebSocket protocol message types for CCWeb.

Defines the bidirectional JSON message format between the FastAPI backend
and the React frontend. Server→Client messages deliver Claude output,
interactive UIs, status updates, and session lists. Client→Server messages
send user text, key presses, decision grid submissions, and session commands.

All messages are JSON objects with a "type" field for dispatch.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


# ── Server → Client messages ─────────────────────────────────────────────


@dataclass
class WsMessage:
    """A new message from a Claude Code session."""

    type: str = "message"
    window_id: str = ""
    role: str = "assistant"
    content_type: str = "text"
    text: str = ""
    tool_use_id: str | None = None
    tool_name: str | None = None
    timestamp: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsInteractiveUI:
    """An interactive UI detected in the terminal (AskUserQuestion, etc.)."""

    type: str = "interactive_ui"
    window_id: str = ""
    ui_name: str = ""
    raw_content: str = ""  # Always included as fallback
    structured: dict[str, Any] | None = None  # Parsed options when available

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsDecisionGrid:
    """A decision grid file detected in .ccweb/pending/."""

    type: str = "decision_grid"
    window_id: str = ""
    grid: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsStatus:
    """Status update (spinner text from Claude's status line)."""

    type: str = "status"
    window_id: str = ""
    text: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsSessions:
    """Current session list broadcast."""

    type: str = "sessions"
    sessions: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsHealth:
    """Health check sent on WebSocket connect."""

    type: str = "health"
    tmux_running: bool = False
    hook_installed: bool = False
    sessions_found: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsError:
    """Backend error notification."""

    type: str = "error"
    code: str = ""
    message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class WsReplay:
    """Message replay after client reconnection."""

    type: str = "replay"
    messages: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Client → Server messages (parsed from JSON dicts) ────────────────────

# These are not dataclasses — they're parsed from incoming JSON.
# Type field values for dispatch:
CLIENT_SEND_TEXT = "send_text"
CLIENT_SEND_KEY = "send_key"
CLIENT_SUBMIT_DECISIONS = "submit_decisions"
CLIENT_CREATE_SESSION = "create_session"
CLIENT_KILL_SESSION = "kill_session"
CLIENT_SWITCH_SESSION = "switch_session"
CLIENT_GET_HISTORY = "get_history"
CLIENT_REPLAY_REQUEST = "replay_request"
CLIENT_PING = "ping"
