---
title: Architecture Overview
description: How CCWeb works — data flows, components, and the WebSocket protocol
order: 0
---

# Architecture Overview

This document explains how CCWeb works at a technical level — the components, how data flows between them, and the communication protocol.

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (React Frontend)                                        │
│                                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐ │
│  │ Session     │ │ Message      │ │ Interactive│ │ Decision  │ │
│  │ Sidebar     │ │ Stream       │ │ UI         │ │ Grid      │ │
│  └──────┬──────┘ └──────┬───────┘ └─────┬──────┘ └─────┬─────┘ │
│         │               │               │              │        │
│  ┌──────┴───────────────┴───────────────┴──────────────┴─────┐  │
│  │  useWebSocket (single WebSocket connection)               │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ WebSocket (JSON messages)
┌──────────────────────────────┼──────────────────────────────────┐
│  FastAPI Backend             │                                   │
│                              │                                   │
│  ┌───────────────────────────┴────────────────────────────────┐ │
│  │  server.py (WebSocket handler + REST endpoints)            │ │
│  └─────────┬──────────────────┬──────────────────┬────────────┘ │
│            │                  │                  │              │
│  ┌─────────┴────────┐ ┌──────┴───────┐ ┌───────┴──────────┐   │
│  │ SessionMonitor   │ │ Status Poll  │ │ Session Manager  │   │
│  │ (JSONL polling   │ │ (terminal    │ │ (state, bindings │   │
│  │  every 2s)       │ │  capture 1s) │ │  send_to_window) │   │
│  └────────┬─────────┘ └──────┬───────┘ └───────┬──────────┘   │
│           │                  │                  │              │
│  ┌────────┴──────────────────┴──────────────────┴───────────┐  │
│  │  TmuxManager (libtmux wrapper)                           │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────┐
│  tmux session "ccbot"       │                                   │
│                              │                                   │
│  ┌──────────┐ ┌──────────┐ ┌┴─────────┐                        │
│  │ Window   │ │ Window   │ │ Window   │  ...                    │
│  │ @0       │ │ @5       │ │ @12      │                         │
│  │ project-a│ │ project-b│ │ project-c│                         │
│  │ (claude) │ │ (claude) │ │ (claude) │                         │
│  └──────────┘ └──────────┘ └──────────┘                         │
│                                                                  │
│  Each window runs one Claude Code instance                       │
│  Claude Code reads/writes project files and ~/.claude/ JSONL     │
└──────────────────────────────────────────────────────────────────┘
```

## Data Flows

### Flow 1: User Sends a Message

```
User types "fix the bug" → clicks Send
  → Frontend sends WebSocket: {"type": "send_text", "window_id": "@0", "text": "fix the bug"}
  → Backend receives, calls session_manager.send_to_window("@0", "fix the bug")
  → SessionManager checks if Claude Code is running (not a bare shell)
  → If Claude exited, auto-resumes via `fg` or `claude --resume`
  → TmuxManager sends keystrokes to the tmux pane: types "fix the bug", waits 500ms, presses Enter
  → Claude Code receives the text as user input
```

### Flow 2: Claude Responds

```
Claude Code writes response to ~/.claude/projects/{encoded-cwd}/{session-id}.jsonl
  → SessionMonitor polls the file every 2 seconds
  → Detects new bytes (file size > last byte offset)
  → Reads new JSONL lines, parses via TranscriptParser
  → TranscriptParser extracts: text, thinking, tool_use, tool_result entries
  → Tool pairing: tool_use matched with tool_result by tool_use_id
  → Each parsed entry becomes a NewMessage
  → Backend iterates _client_bindings, finds clients viewing this session
  → Sends WsMessage via WebSocket to matched clients
  → Frontend receives, appends to messages array, React re-renders
  → User sees the response in the message stream
```

### Flow 3: Interactive Prompt

```
Claude Code displays "Do you want to proceed? [Y/n]" in the terminal
  → Status poll captures terminal every 1 second via tmux capture-pane
  → terminal_parser.extract_interactive_content() regex-matches the UI pattern
  → ui_parser.parse_interactive_ui() converts raw text to structured data
  → Backend sends WsInteractiveUI with both structured data AND raw text fallback
  → Frontend renders clickable buttons (Allow/Deny, Proceed/Edit, option cards)
  → User clicks "Allow"
  → Frontend sends {"type": "send_key", "window_id": "@0", "key": "Enter"}
  → Backend verifies the UI is still showing (stale guard), sends Enter key to tmux
  → Claude Code receives the keypress and continues
```

### Flow 4: Decision Grid

```
User invokes /option-grid skill in Claude Code
  → Claude Code researches topics, writes JSON to {cwd}/.ccweb/pending/grid-xxx.json
  → Claude Code calls AskUserQuestion: "Review the option grid in CCWeb..."
  → AskUserQuestion blocks Claude — it waits for user input
  → Status poll detects new file in .ccweb/pending/ (checked every 1 second)
  → Backend reads and validates JSON, sends WsDecisionGrid via WebSocket
  → Frontend renders DecisionGrid overlay (cards with options + notes per row)
  → User selects options, adds notes, clicks Submit All
  → Frontend sends {"type": "submit_decisions", selections: [...]}
  → Backend formats selections as text, sends to tmux via send_keys
  → Claude Code receives the text as the AskUserQuestion response, unblocks
  → Backend moves grid file from pending/ to completed/
```

## Component Details

### TmuxManager (`core/tmux_manager.py`)

Wraps `libtmux` for async tmux operations. All blocking libtmux calls run in `asyncio.to_thread()`.

Key operations:
- **list_windows()** — enumerate all windows in the ccbot session (cached 1s)
- **create_window(work_dir)** — create a new window and start Claude Code in it
- **send_keys(window_id, text)** — type text into a window's pane (with 500ms delay before Enter)
- **capture_pane(window_id)** — read the terminal screen content
- **kill_window(window_id)** — destroy a window and its Claude Code process

### SessionMonitor (`core/session_monitor.py`)

Polls Claude Code's JSONL files for new content using byte-offset tracking.

Key behaviors:
- Polls every 2 seconds (configurable)
- Only monitors sessions registered in `session_map.json` (written by the hook)
- Uses byte offsets for incremental reads — never re-reads old content
- Detects file truncation (after `/clear`) and resets offset
- Carries pending tool_use state across poll cycles (tool_use and tool_result may arrive in different JSONL entries)
- Saves offsets only AFTER delivering messages to clients (at-least-once delivery guarantee)

### TranscriptParser (`core/transcript_parser.py`)

Parses JSONL entries into display-ready messages. Handles:
- **text** — regular assistant responses
- **thinking** — reasoning blocks (rendered as collapsible)
- **tool_use** — tool invocations (summary line like "**Read**(file.py)")
- **tool_result** — tool outputs (with stats like "Read 42 lines")
- **tool pairing** — matches tool_use with its corresponding tool_result by ID
- **local_command** — slash command outputs

### TerminalParser (`core/terminal_parser.py`)

Regex-based detection of Claude Code's terminal UIs. Detects:
- AskUserQuestion (checkboxes: ☐✔☒)
- ExitPlanMode ("Would you like to proceed?")
- PermissionPrompt ("Do you want to proceed?")
- BashApproval ("This command requires approval")
- RestoreCheckpoint, Settings

Also extracts the status line (spinner + working text) from the terminal chrome.

### UIParser (`ui_parser.py`)

Converts raw terminal text from TerminalParser into structured data that the frontend can render as buttons. This is the fragile screen-scraping layer — it parses Unicode checkbox markers, action descriptions, and option labels from text. Falls back gracefully when parsing fails.

### SessionManager (`session.py`)

State management hub. Tracks:
- **window_states** — which Claude session is in which tmux window
- **window_display_names** — human-readable names for the sidebar
- Resolves window IDs to JSONL file paths for reading history
- Sends text to tmux windows (with auto-resume if Claude exited)
- Loads session_map.json (written by the SessionStart hook)
- Re-resolves stale window IDs after tmux server restart

## WebSocket Protocol

All real-time communication uses typed JSON messages over a single WebSocket connection. See [Protocol Reference](protocol.md) for the complete message specification.

### Server → Client (10 message types)

| Type | Purpose |
|------|---------|
| `health` | Sent on connect — tmux status, hook status, warnings |
| `sessions` | Session list update (sent on connect and whenever sessions change) |
| `history` | Message history for a session (response to switch_session) |
| `message` | New message from Claude (text, thinking, tool_use, tool_result) |
| `status` | Status line update (spinner text + context usage %) |
| `interactive_ui` | Interactive prompt detected (structured data + raw text fallback) |
| `decision_grid` | Decision grid file detected in .ccweb/pending/ |
| `send_ack` | Confirmation that text was sent to Claude |
| `error` | Backend error (tmux down, send failed, stale UI, etc.) |
| `pong` | Keepalive response |

### Client → Server (8 message types)

| Type | Purpose |
|------|---------|
| `send_text` | Send text to Claude (typed as keystrokes into tmux) |
| `send_key` | Send a special key (Enter, Escape, Space, arrows, Tab) |
| `submit_decisions` | Submit decision grid selections |
| `switch_session` | Switch to a different session (triggers history load) |
| `create_session` | Create a new session in a directory |
| `kill_session` | Kill a session's tmux window |
| `get_history` | Request message history for a session |
| `ping` | Keepalive |

## State Files

CCWeb stores state in `~/.ccweb/` (configurable via `CCWEB_DIR`):

| File | Written By | Purpose |
|------|-----------|---------|
| `session_map.json` | `ccweb hook` (SessionStart) | Maps tmux window IDs to Claude session IDs and cwds |
| `state.json` | SessionManager | Window states, display names |
| `monitor_state.json` | SessionMonitor | Byte offsets for JSONL incremental reading |

Claude Code's own files (read-only by CCWeb):
- `~/.claude/projects/{encoded-cwd}/{session-id}.jsonl` — session transcripts
- `~/.claude/projects/{encoded-cwd}/sessions-index.json` — session index

## Origins

CCWeb's backend core modules were forked from [CCBot](https://github.com/JanusMarko/ccbot-workshop), a Telegram bot that bridges Telegram Forum topics to Claude Code sessions. The tmux management, session monitoring, JSONL parsing, and terminal parsing layers are transport-agnostic and were adapted (import paths, state directory, config interface) for the web context. The Telegram-specific layers (bot handlers, message queue, MarkdownV2 formatting) were replaced entirely by the FastAPI/WebSocket/React stack.
