"""FastAPI server — the web layer of CCWeb.

Serves the React frontend (static files in production), provides REST
endpoints for session management, and a WebSocket endpoint for real-time
bidirectional communication with the browser.

On startup:
  1. Run health checks (tmux running, hook installed, state dir exists)
  2. Initialize TmuxManager, SessionManager, SessionMonitor
  3. Start SessionMonitor polling loop
  4. Start status polling loop (1s interval)
  5. Set message callback to broadcast to connected WebSocket clients

Key functions: create_app(), ws_endpoint(), handle_new_message().
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from .config import config
from .core.session_monitor import NewMessage, SessionMonitor
from .core.terminal_parser import (
    extract_interactive_content,
    is_interactive_ui,
    parse_status_line,
)
from .core.tmux_manager import tmux_manager
from .ui_parser import parse_interactive_ui
from .ws_protocol import (
    CLIENT_CREATE_SESSION,
    CLIENT_GET_HISTORY,
    CLIENT_KILL_SESSION,
    CLIENT_PING,
    CLIENT_SEND_KEY,
    CLIENT_SEND_TEXT,
    CLIENT_SWITCH_SESSION,
    WsError,
    WsHealth,
    WsInteractiveUI,
    WsMessage,
    WsSessions,
    WsStatus,
)

logger = logging.getLogger(__name__)

# ── Connected clients ────────────────────────────────────────────────────

# client_id → WebSocket
_clients: dict[str, WebSocket] = {}
# client_id → window_id (which session the client is viewing)
_client_bindings: dict[str, str] = {}

# Session monitor instance
_monitor: SessionMonitor | None = None
# Status polling task
_status_task: asyncio.Task[None] | None = None


# ── Health checks ────────────────────────────────────────────────────────


async def _check_tmux_running() -> bool:
    """Check if tmux server is running."""
    proc = await asyncio.create_subprocess_exec(
        "tmux",
        "list-sessions",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()
    return proc.returncode == 0


def _check_hook_installed() -> bool:
    """Check if the SessionStart hook is installed for ccweb."""
    settings_path = Path.home() / ".claude" / "settings.json"
    if not settings_path.exists():
        return False
    try:
        data = json.loads(settings_path.read_text())
        hooks = data.get("hooks", {}).get("SessionStart", [])
        for entry in hooks:
            for hook in entry.get("hooks", []):
                cmd = hook.get("command", "")
                if "ccweb hook" in cmd:
                    return True
    except (json.JSONDecodeError, OSError):
        pass
    return False


async def _build_health() -> WsHealth:
    """Build health check status."""
    tmux_running = await _check_tmux_running()
    hook_installed = _check_hook_installed()
    warnings: list[str] = []

    if not tmux_running:
        warnings.append(
            "tmux is not running. Start tmux first: tmux new -s "
            f"{config.tmux_session_name}"
        )
    if not hook_installed:
        warnings.append("SessionStart hook not installed. Run: ccweb install")

    windows = await tmux_manager.list_windows() if tmux_running else []

    return WsHealth(
        tmux_running=tmux_running,
        hook_installed=hook_installed,
        sessions_found=len(windows),
        warnings=warnings,
    )


# ── Session list ─────────────────────────────────────────────────────────


async def _build_session_list() -> list[dict[str, Any]]:
    """Build session list for the frontend."""
    windows = await tmux_manager.list_windows()
    return [
        {
            "window_id": w.window_id,
            "name": w.window_name,
            "cwd": w.cwd,
            "command": w.pane_current_command,
        }
        for w in windows
    ]


async def _broadcast_sessions() -> None:
    """Send updated session list to all connected clients."""
    sessions = await _build_session_list()
    msg = WsSessions(sessions=sessions).to_dict()
    for ws in list(_clients.values()):
        try:
            await ws.send_json(msg)
        except Exception:
            pass


# ── Message callback (from SessionMonitor) ───────────────────────────────


async def _handle_new_message(msg: NewMessage) -> None:
    """Route a new message from SessionMonitor to bound WebSocket clients."""
    # Find which clients are bound to a window matching this session
    from .session import session_manager

    for client_id, window_id in list(_client_bindings.items()):
        ws = _clients.get(client_id)
        if not ws:
            continue

        # Check if this window's session matches the message's session
        state = session_manager.get_window_state(window_id)
        if state.session_id != msg.session_id:
            continue

        ws_msg = WsMessage(
            window_id=window_id,
            role=msg.role,
            content_type=msg.content_type,
            text=msg.text,
            tool_use_id=msg.tool_use_id,
            tool_name=msg.tool_name,
        )
        try:
            await ws.send_json(ws_msg.to_dict())
        except Exception:
            pass


# ── Status polling ───────────────────────────────────────────────────────


async def _status_poll_loop() -> None:
    """Poll terminal status for all active windows at 1-second intervals."""
    while True:
        try:
            for client_id, window_id in list(_client_bindings.items()):
                ws = _clients.get(client_id)
                if not ws:
                    continue

                w = await tmux_manager.find_window_by_id(window_id)
                if not w:
                    continue

                pane_text = await tmux_manager.capture_pane(w.window_id)
                if not pane_text:
                    continue

                # Check for interactive UI
                if is_interactive_ui(pane_text):
                    content = extract_interactive_content(pane_text)
                    if content:
                        parsed = parse_interactive_ui(content.content, content.name)
                        ui_msg = WsInteractiveUI(
                            window_id=window_id,
                            ui_name=content.name,
                            raw_content=content.content,
                            structured=parsed.to_dict() if parsed else None,
                        )
                        try:
                            await ws.send_json(ui_msg.to_dict())
                        except Exception:
                            pass
                        continue

                # Check for status line
                status_text = parse_status_line(pane_text)
                if status_text:
                    status_msg = WsStatus(
                        window_id=window_id,
                        text=status_text,
                    )
                    try:
                        await ws.send_json(status_msg.to_dict())
                    except Exception:
                        pass

        except Exception as e:
            logger.error("Status poll error: %s", e)

        await asyncio.sleep(1.0)


# ── WebSocket handler ────────────────────────────────────────────────────


async def _handle_ws_message(
    client_id: str,
    ws: WebSocket,
    data: dict[str, Any],
) -> None:
    """Dispatch a single incoming WebSocket message."""
    msg_type = data.get("type", "")
    window_id = data.get("window_id", "")

    if msg_type == CLIENT_PING:
        await ws.send_json({"type": "pong"})
        return

    if msg_type == CLIENT_SWITCH_SESSION:
        _client_bindings[client_id] = window_id
        # Send history for the new session
        from .session import session_manager

        messages, total = await session_manager.get_recent_messages(window_id)
        await ws.send_json(
            {
                "type": "history",
                "window_id": window_id,
                "messages": messages,
                "total": total,
            }
        )
        return

    if msg_type == CLIENT_SEND_TEXT:
        text = data.get("text", "")
        if text and window_id:
            from .session import session_manager

            success, message = await session_manager.send_to_window(window_id, text)
            if not success:
                await ws.send_json(
                    WsError(code="send_failed", message=message).to_dict()
                )
        return

    if msg_type == CLIENT_SEND_KEY:
        key = data.get("key", "")
        if key and window_id:
            # Stale UI guard: verify interactive UI is still showing
            w = await tmux_manager.find_window_by_id(window_id)
            if w:
                pane_text = await tmux_manager.capture_pane(w.window_id)
                if pane_text and not is_interactive_ui(pane_text):
                    await ws.send_json(
                        WsError(
                            code="stale_ui",
                            message="This prompt has expired.",
                        ).to_dict()
                    )
                    return

            # Map key names to tmux send_keys parameters
            key_map: dict[str, tuple[str, bool, bool]] = {
                "Enter": ("Enter", False, False),
                "Escape": ("Escape", False, False),
                "Space": ("Space", False, False),
                "Tab": ("Tab", False, False),
                "Up": ("Up", False, False),
                "Down": ("Down", False, False),
                "Left": ("Left", False, False),
                "Right": ("Right", False, False),
            }
            key_info = key_map.get(key)
            if key_info:
                text_val, enter, literal = key_info
                await tmux_manager.send_keys(
                    window_id, text_val, enter=enter, literal=literal
                )
        return

    if msg_type == CLIENT_CREATE_SESSION:
        work_dir = data.get("work_dir", "")
        name = data.get("name")
        if work_dir:
            success, message, wname, wid = await tmux_manager.create_window(
                work_dir, window_name=name
            )
            if success:
                _client_bindings[client_id] = wid
                await _broadcast_sessions()
            else:
                await ws.send_json(
                    WsError(code="create_failed", message=message).to_dict()
                )
        return

    if msg_type == CLIENT_KILL_SESSION:
        if window_id:
            await tmux_manager.kill_window(window_id)
            # Unbind any clients from this window
            for cid, wid in list(_client_bindings.items()):
                if wid == window_id:
                    del _client_bindings[cid]
            await _broadcast_sessions()
        return

    if msg_type == CLIENT_GET_HISTORY:
        if window_id:
            from .session import session_manager

            messages, total = await session_manager.get_recent_messages(window_id)
            await ws.send_json(
                {
                    "type": "history",
                    "window_id": window_id,
                    "messages": messages,
                    "total": total,
                }
            )
        return

    logger.warning("Unknown WebSocket message type: %s", msg_type)


async def ws_endpoint(websocket: WebSocket) -> None:
    """WebSocket connection handler."""
    await websocket.accept()
    client_id = str(uuid.uuid4())
    _clients[client_id] = websocket
    logger.info("WebSocket connected: %s", client_id)

    try:
        # Send health check
        health = await _build_health()
        await websocket.send_json(health.to_dict())

        # Send session list
        sessions = await _build_session_list()
        await websocket.send_json(WsSessions(sessions=sessions).to_dict())

        # Message loop
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    WsError(code="invalid_json", message="Invalid JSON").to_dict()
                )
                continue

            await _handle_ws_message(client_id, websocket, data)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", client_id)
    except Exception as e:
        logger.error("WebSocket error for %s: %s", client_id, e)
    finally:
        _clients.pop(client_id, None)
        _client_bindings.pop(client_id, None)


# ── App lifecycle ────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """FastAPI lifespan: start monitor + status polling on startup."""
    global _monitor, _status_task

    # Startup health checks (log warnings, don't crash)
    tmux_ok = await _check_tmux_running()
    if not tmux_ok:
        logger.warning(
            "tmux is not running! Start tmux first: tmux new -s %s",
            config.tmux_session_name,
        )

    hook_ok = _check_hook_installed()
    if not hook_ok:
        logger.warning("SessionStart hook not installed. Run: ccweb install")

    # Initialize session manager (loads state)
    from .session import session_manager

    await session_manager.resolve_stale_ids()
    await session_manager.load_session_map()

    # Start session monitor
    _monitor = SessionMonitor()
    _monitor.set_message_callback(_handle_new_message)
    _monitor.start()

    # Start status polling
    _status_task = asyncio.create_task(_status_poll_loop())

    logger.info("CCWeb started on %s:%d", config.web_host, config.web_port)

    yield

    # Shutdown
    if _status_task:
        _status_task.cancel()
    if _monitor:
        _monitor.stop()
    logger.info("CCWeb stopped")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="CCWeb", lifespan=lifespan)

    # WebSocket endpoint
    app.add_api_websocket_route("/ws", ws_endpoint)

    # REST endpoints
    @app.get("/api/sessions")
    async def list_sessions() -> list[dict[str, Any]]:
        return await _build_session_list()

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        h = await _build_health()
        return h.to_dict()

    # Serve static frontend files (production)
    static_dir = Path(__file__).parent.parent / "frontend" / "dist"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True))

    return app
