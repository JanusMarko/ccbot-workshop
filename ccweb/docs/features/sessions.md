---
title: Sessions
description: Creating, switching, renaming, and managing Claude Code sessions
order: 1
---

# Sessions

A session is a Claude Code instance running in a tmux window, pointed at a specific project directory. CCWeb manages sessions through a sidebar that lists all active sessions and lets you create, switch, rename, and kill them.

## Understanding Sessions

Each session consists of:
- **A tmux window** — identified by a unique ID like `@0`, `@12`. This is where Claude Code's terminal runs.
- **A Claude Code process** — the `claude` command running inside that window, connected to the Anthropic API.
- **A working directory** — the project folder Claude Code operates in (reads files, runs commands, writes code).
- **A JSONL session file** — where Claude Code writes all its activity (your messages, its responses, tool calls, tool results). Located at `~/.claude/projects/{encoded-cwd}/{session-id}.jsonl`.

CCWeb does not create or manage Claude Code sessions directly — it manages tmux windows and lets Claude Code do its own session management within them.

## Creating a Session

Click **+ New** in the sidebar or press **Ctrl+N**. The directory picker opens.

The directory picker has three parts:
1. **Recent directories** — your last 5 used directories (stored in localStorage), click to select
2. **Path input** — type or paste a full path directly, press Enter or click Go to navigate
3. **File tree** — click folders to browse, click `.. (parent directory)` to go up (contained within your browse root)

Below the file tree:
4. **Session name** — optional custom name (defaults to the directory name)

Click **Create Session** to create a new tmux window in that directory and start Claude Code. The session appears in the sidebar and is automatically selected.

**What happens behind the scenes:**
1. Backend calls `tmux_manager.create_window(work_dir)` which creates a new tmux window, cd's to the directory, and runs the `claude` command
2. `.ccweb/pending/` is auto-created in the project directory for decision grid files
3. Claude Code starts and fires the `SessionStart` hook, which writes to `~/.ccweb/session_map.json`
4. The backend detects the new session_map entry and begins monitoring the JSONL file
5. The session list is broadcast to all connected clients

## Switching Sessions

Click any session in the sidebar. The message stream clears and loads the selected session's history. Status text, interactive UI state, and decision grids are also cleared to prevent stale UI.

On tablet, the sidebar closes automatically after selection.

**What happens behind the scenes:**
1. Frontend sends `switch_session` via WebSocket
2. Backend binds the client to the new window_id
3. Backend reads the session's JSONL file and returns all parsed messages as a `history` response
4. Frontend replaces the message array with the history
5. The status poll loop begins sending status updates and interactive UI detections for the new window

## Renaming Sessions

Double-click the session name in the sidebar to edit it inline. Type the new name and press Enter (or click away to confirm, Escape to cancel).

**What happens behind the scenes:**
1. Frontend calls `PUT /api/sessions/{window_id}/rename` with the new name
2. Backend calls `tmux_manager.rename_window()` to rename the actual tmux window
3. Backend updates the display name in session state and broadcasts the updated session list

## Killing Sessions

Click the **x** button on a session in the sidebar. A confirmation dialog asks "Kill session {name}?".

**What happens behind the scenes:**
1. Frontend sends `kill_session` via WebSocket
2. Backend calls `tmux_manager.kill_window()` which destroys the tmux window and the Claude Code process
3. Backend removes any client bindings to that window
4. If the killed session was the active session, the frontend clears all state (messages, status, interactive UI, decision grid) and shows the "Select a session" placeholder
5. If the session is killed externally (e.g., by another client or `tmux kill-window`), the frontend detects this when the server broadcasts an updated session list that no longer includes the window_id, and automatically clears the active session

## Session Persistence

Your last active session is saved to localStorage (`ccweb_last_session`). When you reload the page, CCWeb:
1. Restores the saved window_id
2. Waits for the WebSocket to connect
3. Sends `switch_session` for the restored session
4. Loads the session's history

If the saved session no longer exists (tmux window was killed while the page was closed), the session is automatically cleared when the server sends a sessions list that doesn't include it.

## Session Status

The sidebar shows each session's name and working directory. The active session has a blue accent border on the left.

Health warnings appear as banners at the top of the sidebar:
- **Red**: "tmux is not running" — start tmux with `tmux new -s ccbot`
- **Orange**: "SessionStart hook not installed" — run `ccweb install`

## Multiple Sessions

You can have any number of sessions running simultaneously, each in its own tmux window. They can point to different projects or even the same project (each gets a separate Claude Code instance with its own context).

Sessions are independent — killing one doesn't affect others. Messages are routed to the correct session via the window_id → session_id mapping.
