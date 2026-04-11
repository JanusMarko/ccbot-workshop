---
title: Protocol Reference
description: Complete WebSocket and REST API protocol specification
order: 1
---

# Protocol Reference

Complete specification of all communication between the CCWeb frontend and backend.

## WebSocket Protocol

A single WebSocket connection at `/ws` carries all real-time communication. Messages are JSON objects with a `type` field for dispatch.

### Server → Client Messages

#### `health`
Sent immediately on WebSocket connect. Reports system status.

```json
{
  "type": "health",
  "tmux_running": true,
  "hook_installed": true,
  "sessions_found": 3,
  "warnings": []
}
```

`warnings` is an array of human-readable strings displayed as banners in the sidebar (e.g., "tmux is not running", "SessionStart hook not installed").

#### `sessions`
Sent on connect and whenever sessions are created, killed, or renamed.

```json
{
  "type": "sessions",
  "sessions": [
    {
      "window_id": "@0",
      "name": "my-project",
      "cwd": "/home/user/my-project",
      "command": "claude"
    }
  ]
}
```

`command` is the process running in the pane (e.g., `claude`, `bash`). If it's a shell name, Claude Code has exited.

#### `history`
Sent in response to `switch_session` or `get_history`. Contains all parsed messages for the session.

```json
{
  "type": "history",
  "window_id": "@0",
  "messages": [
    {
      "role": "user",
      "text": "fix the auth bug",
      "content_type": "text",
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "text": "I'll look at the auth module...",
      "content_type": "text",
      "timestamp": "2025-01-15T10:30:05Z"
    }
  ],
  "total": 2
}
```

`content_type` is one of: `text`, `thinking`, `tool_use`, `tool_result`, `local_command`.

#### `message`
A new real-time message from Claude Code (streamed as they appear in the JSONL).

```json
{
  "type": "message",
  "window_id": "@0",
  "role": "assistant",
  "content_type": "tool_use",
  "text": "**Read**(src/auth.py)",
  "tool_use_id": "toolu_abc123",
  "tool_name": "Read",
  "timestamp": null,
  "images": [
    {"media_type": "image/png", "data": "base64..."}
  ]
}
```

`images` is omitted when empty. Present only on `tool_result` messages that include screenshots or other image outputs.

#### `status`
Status line update from Claude Code's terminal chrome (sent every ~1 second when active).

```json
{
  "type": "status",
  "window_id": "@0",
  "text": "Reading files...",
  "context_pct": 34
}
```

`context_pct` is the context usage percentage parsed from the terminal's bottom bar (e.g., "Context: 34%"). Null when not detected.

#### `interactive_ui`
An interactive prompt detected in the terminal.

```json
{
  "type": "interactive_ui",
  "window_id": "@0",
  "ui_name": "AskUserQuestion",
  "raw_content": "☐ Option A\n✔ Option B\n☐ Option C\nEnter to select",
  "structured": {
    "ui_name": "AskUserQuestion",
    "options": [
      {"label": "Option A", "checked": false, "index": 0},
      {"label": "Option B", "checked": true, "index": 1},
      {"label": "Option C", "checked": false, "index": 2}
    ],
    "description": "",
    "command": ""
  }
}
```

`structured` is null when parsing fails — the frontend falls back to displaying `raw_content` with generic navigation buttons. `ui_name` is one of: `AskUserQuestion`, `ExitPlanMode`, `PermissionPrompt`, `BashApproval`, `RestoreCheckpoint`, `Settings`.

#### `decision_grid`
A decision grid JSON file detected in `.ccweb/pending/`.

```json
{
  "type": "decision_grid",
  "window_id": "@0",
  "grid": {
    "id": "grid-1712345678",
    "type": "ccweb:grid",
    "title": "Code Review Decisions",
    "items": [
      {
        "topic": "Auth refactor",
        "description": "The auth module uses deprecated API...",
        "options": [
          {"label": "Update to v4 API", "recommended": true},
          {"label": "Switch to argon2", "recommended": false}
        ],
        "allow_custom": true
      }
    ]
  }
}
```

#### `send_ack`
Confirmation that text was successfully sent to Claude's tmux pane.

```json
{"type": "send_ack", "window_id": "@0"}
```

#### `error`
Backend error notification.

```json
{"type": "error", "code": "send_failed", "message": "Window not found"}
```

Error codes: `send_failed`, `create_failed`, `stale_ui`, `invalid_json`.

#### `pong`
Keepalive response to client `ping`.

```json
{"type": "pong"}
```

### Client → Server Messages

#### `send_text`
Send text to Claude Code (typed as keystrokes into the tmux pane).

```json
{"type": "send_text", "window_id": "@0", "text": "fix the auth bug"}
```

#### `send_key`
Send a special key (for interactive UI navigation or interrupt).

```json
{"type": "send_key", "window_id": "@0", "key": "Enter"}
```

Valid keys: `Enter`, `Escape`, `Space`, `Tab`, `Up`, `Down`, `Left`, `Right`. Escape always passes through (no stale UI guard) since it's the interrupt key. Other keys are guarded: the backend re-captures the pane before sending and rejects the key with a `stale_ui` error if the interactive UI is no longer showing.

#### `submit_decisions`
Submit decision grid selections.

```json
{
  "type": "submit_decisions",
  "window_id": "@0",
  "title": "Code Review Decisions",
  "selections": [
    {"topic": "Auth refactor", "choice": "Update to v4 API", "notes": ""},
    {"topic": "Logging", "choice": null, "notes": "Let's discuss structured logging"}
  ]
}
```

`choice` is null when the user provided only notes (custom answer). The backend formats this as readable text and sends it to Claude via tmux keystrokes.

#### `switch_session`
Switch to a different session. The backend responds with a `history` message.

```json
{"type": "switch_session", "window_id": "@0"}
```

#### `create_session`
Create a new Claude Code session.

```json
{"type": "create_session", "work_dir": "/home/user/my-project", "name": "my-project"}
```

`name` is optional (defaults to the directory name). The backend creates a tmux window, starts Claude Code, creates `.ccweb/pending/`, and broadcasts an updated session list.

#### `kill_session`
Kill a session's tmux window.

```json
{"type": "kill_session", "window_id": "@0"}
```

#### `get_history`
Request message history for a session (same as `switch_session` but without changing the client binding).

```json
{"type": "get_history", "window_id": "@0"}
```

#### `ping`
Keepalive (sent every 30 seconds by the frontend).

```json
{"type": "ping"}
```

## REST API

REST endpoints for operations that don't need real-time streaming.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/sessions` | List active sessions |
| `POST` | `/api/sessions` | Create a new session (body: `{work_dir, name?}`) |
| `DELETE` | `/api/sessions/{window_id}` | Kill a session |
| `PUT` | `/api/sessions/{window_id}/rename` | Rename a session (body: `{name}`) |
| `GET` | `/api/sessions/{window_id}/export?fmt=markdown\|json\|plain` | Export conversation |
| `GET` | `/api/sessions/{window_id}/skills` | List project slash commands |
| `GET` | `/api/sessions/{window_id}/screenshot` | Capture terminal as text |
| `POST` | `/api/sessions/{window_id}/upload` | Upload a file (multipart form) |
| `POST` | `/api/sessions/{window_id}/setup-ccweb` | Create `.ccweb/instructions.md` |
| `GET` | `/api/browse?path=` | Browse directories (contained within browse root) |
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/docs` | Documentation tree (frontmatter metadata) |
| `GET` | `/api/docs/{path}` | Documentation page content (markdown) |
| `GET` | `/api/docs-search?q=` | Full-text search across documentation |
