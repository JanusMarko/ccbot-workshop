# CCWeb

A browser-based interface for Claude Code sessions running in tmux. Replaces the Telegram bot interface with a richer web experience.

## Features

- **Styled message stream** with markdown rendering, expandable thinking blocks, copy buttons on code
- **Interactive UI** — AskUserQuestion, permission prompts, plan mode rendered as clickable buttons (not terminal arrow-key navigation)
- **Decision grids** — batch option selection with notes column, rendered from JSON files written by Claude Code skills
- **Session management** — create, switch, rename, kill sessions via sidebar with directory picker
- **Command palette** — `/` auto-complete with built-in commands + project-specific skill discovery
- **File upload** — drag-and-drop or paperclip button, saved to project's `docs/inbox/`
- **Message filters** — All / Chat / No Thinking / Tools toggle chips
- **Browser notifications** — alerts when Claude needs input and tab is unfocused
- **Context indicator** — shows Claude's context usage percentage with color coding
- **Export** — download conversation as Markdown, JSON, or plain text
- **Responsive** — works on desktop Chrome and tablet (Samsung Z Fold 7 tested)
- **In-app wiki** — documentation rendered from `docs/` markdown files with search

## Quick Start

```bash
# Install
pip install -e .
ccweb install      # Set up SessionStart hook + global slash commands

# Start tmux
tmux new -s ccbot

# Start server (in another terminal)
ccweb              # Runs on http://localhost:8765

# Frontend dev mode
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Architecture

```
ccweb/
├── ccweb/backend/         Python FastAPI + WebSocket server
│   ├── core/              Forked from ccbot (tmux, session monitor, parsers)
│   ├── server.py          Main server (WebSocket handler, REST endpoints)
│   ├── session.py         Session state management
│   ├── ws_protocol.py     Typed WebSocket message definitions
│   └── ui_parser.py       Terminal text → structured interactive UI data
├── frontend/src/          React + TypeScript + Vite
│   ├── App.tsx            Main layout (sidebar, content, overlays, routing)
│   ├── components/        UI components (15 files)
│   ├── hooks/             State + WebSocket hooks (4 files)
│   └── protocol.ts        TypeScript mirror of ws_protocol.py
├── docs/                  Documentation wiki (rendered in-app)
│   ├── architecture/      Design plan, v2 roadmap, deferred items, session history
│   ├── getting-started/   Installation, quickstart
│   ├── features/          Per-feature docs
│   └── troubleshooting/   Common issues
├── CLAUDE.md              Claude Code instructions for this project
├── pyproject.toml         Python package config
└── README.md              This file
```

## Documentation

All documentation lives in `docs/` and is also rendered in the in-app wiki (click "Wiki / Help" in the sidebar).

| Document | What it covers |
|----------|---------------|
| [Design Plan](docs/architecture/design-plan.md) | Full design plan with all architectural decisions, protocol specs, and phase breakdown |
| [V2 Roadmap](docs/architecture/v2-roadmap.md) | Deferred features organized by category |
| [Deferred Items Grid](docs/architecture/deferred-items.md) | Prioritized grid of all 27 deferred items with effort, usefulness, success probability |
| [Session History](docs/architecture/session-history.md) | History of the build session — decisions, review process, lessons learned, what a new session needs to know |
| **[Full Setup Guide](docs/getting-started/full-setup-guide.md)** | **Complete from-scratch setup: WSL, tmux, Claude Code, Tailscale, Android, troubleshooting, uninstall** |
| [Installation](docs/getting-started/installation.md) | Quick prerequisites and setup |
| [Quick Start](docs/getting-started/quickstart.md) | First session walkthrough |

## Configuration

Server config via `~/.ccweb/.env`:

```bash
CCWEB_HOST=0.0.0.0          # Bind address (default: 0.0.0.0)
CCWEB_PORT=8765              # Port (default: 8765)
CCWEB_AUTH_TOKEN=            # Optional bearer token
TMUX_SESSION_NAME=ccbot      # Tmux session name (default: ccbot)
CLAUDE_COMMAND=claude         # Claude command (default: claude)
CCWEB_BROWSE_ROOT=           # Starting dir for session browser
```

## Tech Stack

- **Backend**: Python 3.12+, FastAPI, uvicorn, libtmux, aiofiles
- **Frontend**: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, react-markdown
- **Runtime**: tmux, Claude Code CLI

## Making This a Standalone Repo

This folder is completely self-contained. To make it a standalone repo:

```bash
cp -r ccweb/ /path/to/new/ccweb
cd /path/to/new/ccweb
git init
git add .
git commit -m "Initial commit"
```

State is stored in `~/.ccweb/` (separate from ccbot's `~/.ccbot/`). Both can coexist.

## License

See parent repository.
