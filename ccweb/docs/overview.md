---
title: What is CCWeb
description: System overview — what CCWeb is, why it exists, and how it works
order: 0
---

# What is CCWeb

CCWeb is a browser-based interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Anthropic's command-line AI coding assistant. It replaces the terminal as your primary way of interacting with Claude Code, giving you a richer, more visual experience while Claude Code continues to run in the background via tmux.

## The Problem

Claude Code runs in a terminal. When you're working with it, you see scrolling text — tool calls, thinking blocks, code diffs, and responses all mixed together in a monospace stream. Interactive prompts (like "Do you want to proceed?") require navigating with arrow keys and pressing Enter. If you're running Claude Code on a remote server (via SSH or tmux), the experience is even more constrained.

Specific pain points:
- **No visual structure** — everything is flat text. Thinking blocks, tool results, and actual responses are hard to distinguish.
- **Terminal-only interaction** — permission prompts, plan mode, and AskUserQuestion all require keyboard navigation in a terminal UI.
- **No batch decisions** — when Claude has multiple questions or options, you answer them one at a time.
- **No mobile access** — you can't easily interact with Claude Code from a phone or tablet.
- **No persistent history** — closing your terminal or SSH session means scrolling back through raw output.

## The Solution

CCWeb runs alongside Claude Code, not instead of it. Claude Code still runs in tmux windows, doing all the actual work (reading files, running commands, writing code). CCWeb watches what Claude Code does by reading its JSONL session files, and presents everything in a structured web interface.

```
You (browser) ↔ CCWeb (web server) ↔ tmux ↔ Claude Code ↔ your project
```

What you get:
- **Styled message stream** — markdown rendering, syntax highlighting, collapsible thinking blocks, copy buttons on code
- **Clickable interactive prompts** — "Allow" / "Deny" buttons instead of arrow keys, plan mode as "Proceed" / "Edit" buttons
- **Decision grids** — make multiple choices at once via an interactive HTML form
- **Session management** — create, switch, rename, and kill Claude Code sessions from a sidebar
- **Command palette** — type `/` for auto-complete of all Claude Code commands and project skills
- **Remote access** — use from any device on your Tailscale network, including Android tablets
- **Message filters** — show only what you care about (hide thinking, show only tools, etc.)
- **Export** — download any conversation as Markdown, JSON, or plain text

## How It Works (Conceptual)

CCWeb has two halves: a Python backend and a React frontend, connected by WebSocket.

### The Backend

The backend is a FastAPI web server that does three things:

1. **Manages tmux windows** — creates new windows (each one runs a Claude Code instance), sends keystrokes to them (your messages), and captures their terminal output.

2. **Monitors Claude Code's output** — Claude Code writes all its activity to JSONL files in `~/.claude/projects/`. The backend polls these files every 2 seconds, parses new entries, and pushes them to the frontend via WebSocket.

3. **Detects interactive prompts** — every second, the backend captures the terminal screen and looks for interactive UIs (permission prompts, AskUserQuestion, plan mode). When found, it parses them into structured data and sends it to the frontend.

### The Frontend

The frontend is a React single-page app that:

1. **Renders messages** — takes the parsed JSONL entries and renders them as styled HTML with markdown support, expandable blocks, and inline images.

2. **Renders interactive UIs** — when the backend detects a prompt, the frontend renders it as clickable buttons instead of terminal navigation.

3. **Sends user input** — when you type a message and click Send, the frontend tells the backend, which sends the text as keystrokes to the tmux window where Claude Code is waiting for input.

### The Connection

The frontend connects to the backend via a single WebSocket. All real-time communication flows through this connection:
- Backend → Frontend: new messages, status updates, interactive prompts, session list changes
- Frontend → Backend: user text, key presses, session management commands

There are also REST endpoints for things like file upload, directory browsing, documentation, and session export.

## Key Concepts

### Sessions

A **session** is a Claude Code instance running in a tmux window, pointed at a specific project directory. Each session has:
- A **tmux window ID** (like `@0`, `@12`) — the unique identifier
- A **display name** — shown in the sidebar (defaults to the directory name)
- A **working directory** — the project Claude Code is working on
- A **JSONL file** — where Claude Code writes all its activity

You can have multiple sessions running simultaneously, each in its own tmux window, each working on a different project (or the same project).

### The SessionStart Hook

When Claude Code starts a new session, it fires a "SessionStart" hook. CCWeb installs a hook handler (`ccweb hook`) that writes the window-to-session mapping to `~/.ccweb/session_map.json`. This is how the backend knows which tmux window corresponds to which Claude Code session and JSONL file.

Without this hook, CCWeb can't track sessions. That's why `ccweb install` is required.

### Interactive UI Detection

Claude Code renders interactive prompts as text-based UIs in the terminal (checkboxes, selection lists, yes/no prompts). CCWeb captures the terminal screen every second and uses regex patterns to detect these UIs. When found, it parses the raw text into structured data (option labels, checked/unchecked states) and sends it to the frontend, which renders proper HTML buttons.

This is inherently fragile — it's screen-scraping a terminal UI. If Claude Code changes its UI format, the parsers may need updating. CCWeb always falls back to displaying the raw terminal text with generic navigation buttons if parsing fails.

### Decision Grids (File-Based Protocol)

For batch decisions, CCWeb uses a file-based protocol rather than parsing terminal output:

1. A Claude Code skill writes a JSON file to `{project}/.ccweb/pending/`
2. The skill then calls `AskUserQuestion` to block Claude while you decide
3. CCWeb detects the file and renders it as an interactive HTML grid
4. You make your selections and click Submit
5. CCWeb formats your choices as text and sends them to Claude via tmux keystrokes
6. Claude receives the text as the answer to AskUserQuestion and continues

The file-based approach is more reliable than text markers because Claude's Write tool produces valid JSON deterministically, unlike free-form text output.

## What CCWeb Is Not

- **Not a Claude API client** — it doesn't call the Anthropic API. Claude Code does that.
- **Not a terminal emulator** — it doesn't show raw terminal output. It parses structured data from JSONL files and renders it as HTML.
- **Not a replacement for Claude Code** — Claude Code still does all the work. CCWeb is the interface layer.
- **Not multi-user** — it's designed for a single user running their own Claude Code sessions.

## Where to Go Next

- [Full Setup Guide](getting-started/full-setup-guide.md) — install everything from scratch
- [Quick Start](getting-started/quickstart.md) — create your first session
- [Architecture Overview](architecture/overview.md) — deeper technical understanding
- [Features](#features) — detailed documentation for each feature
