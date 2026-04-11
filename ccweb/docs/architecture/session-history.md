---
title: Build Session History
description: History of the original build session — decisions, reviews, and lessons learned
order: 4
---

# Build Session History

This document captures the history of the original Claude Code session that built CCWeb, so a new session can pick up where we left off with full context.

## Origin

CCWeb was designed as a replacement for CCBot's Telegram interface. The user wanted a richer browser-based experience for interacting with Claude Code sessions running in tmux, specifically:
- A styled message stream instead of raw terminal output
- Clickable interactive UI (instead of terminal arrow-key navigation)
- A decision grid system for batch choices
- Session management similar to Telegram topics

The existing CCBot codebase at `/home/user/ccbot-workshop/src/ccbot/` was used as a reference. Seven core modules were **forked** (not copied verbatim — all needed import path changes) into `ccweb/ccweb/backend/core/`.

## Build Phases Completed

All 12 phases from the design plan are complete:

| Phase | What | Status |
|-------|------|--------|
| 1 | Backend scaffold (FastAPI, WebSocket, forked core modules) | Done |
| 2 | React frontend scaffold (Vite, TypeScript, Tailwind) | Done |
| 3 | Message stream, file upload, text input, status bar | Done |
| 4 | Session management (sidebar, directory picker with file tree) | Done |
| 5 | Interactive UI (AskUserQuestion, permissions, plan mode as buttons) | Done |
| 6 | Decision grid (file-based detection, AskUserQuestion blocking) | Done |
| 7 | Command palette (/ auto-complete, skill discovery, dropdown) | Done |
| 8 | Message filters (All/Chat/No Thinking/Tools) | Done |
| 9 | Documentation wiki (in-app rendering of docs/ markdown) | Done |
| 10 | Responsive design (tablet drawer, swipe, touch targets) | Done |
| 11 | QoL (notifications, context %, rename, export, persistence) | Done |
| 12 | Polish (auto-scroll, expandable blocks, images, reconnect, shortcuts) | Done |

## Key Architectural Decisions

1. **Forked modules, not shared package**: Core modules (`tmux_manager`, `session_monitor`, `terminal_parser`, etc.) were copied and adapted from ccbot, not imported. This ensures ccweb is self-contained and can be a standalone repo. All use `~/.ccweb/` for state (not `~/.ccbot/`).

2. **File-based decision grids**: The original plan used text markers (`<!--ccweb:grid {json}-->`) in Claude's output. Adversarial review identified this as fragile (LLM output is unreliable). Changed to file-based: Claude writes JSON to `.ccweb/pending/`, backend polls the directory. The skill MUST call `AskUserQuestion` after writing the file to block Claude until the user responds.

3. **Single user, single browser session**: No multi-user auth. WebSocket client_bindings are ephemeral. Interactive UI responses are last-click-wins.

4. **Per-project instructions via `.ccweb/instructions.md`**: Instead of mutating CLAUDE.md (causes git noise), ccweb creates a separate file that CLAUDE.md can reference. Can be .gitignored.

5. **Separate state directories**: ccbot uses `~/.ccbot/`, ccweb uses `~/.ccweb/`. Both can coexist monitoring the same tmux sessions. The SessionStart hook must be `ccweb hook` (writes to `~/.ccweb/session_map.json`).

## Adversarial Review Process

The codebase went through **multiple rounds of three-agent adversarial code review**. Each round used three independent agents (backend, frontend, integration) that read the actual code from scratch with no context from previous rounds. Reviews continued until all three agents passed clean simultaneously.

### Total bugs found and fixed across all review rounds: 40+

Key categories of bugs caught:
- **Missing dependency**: `python-multipart` not in pyproject.toml (app wouldn't start)
- **Package structure**: wrong `packages` path in pyproject.toml (empty wheel)
- **Security**: path traversal in file upload (filename with `../`), browse endpoint without containment
- **Protocol gaps**: decision_grid handler missing in frontend, dead WsReplay code
- **Race conditions**: grid file rename during concurrent access, double switch_session, stale closures
- **State management**: phantom WindowState entries, session_map wipe on empty valid_wids, externally killed session leaving stale UI
- **UX**: hamburger button z-index above modals, CommandPalette Enter interception, StrictMode toggle

## What a New Session Needs to Know

### To run the project
```bash
# Backend
cd ccweb
pip install -e .
ccweb install    # Install hook + global commands
ccweb            # Start server on :8765

# Frontend (dev)
cd ccweb/frontend
npm install
npm run dev      # Vite dev server on :5173 (proxies to :8765)
```

### To make changes
- Backend Python: `ccweb/ccweb/backend/` — run `uv run ruff check` and `ruff format`
- Frontend TypeScript: `ccweb/frontend/src/` — run `npx tsc -b --noEmit` and `npx vite build`
- **When changing any feature, update the corresponding doc in `docs/`** (see CLAUDE.md)

### Key files
- `ccweb/CLAUDE.md` — project instructions for Claude Code
- `docs/architecture/design-plan.md` — the full design plan with all decisions
- `docs/architecture/v2-roadmap.md` — deferred features by category
- `docs/architecture/deferred-items.md` — prioritized grid with effort/usefulness estimates
- `ccweb/ccweb/backend/server.py` — the main FastAPI server (largest file, ~850 lines)
- `ccweb/ccweb/backend/ws_protocol.py` — all WebSocket message type definitions
- `ccweb/frontend/src/protocol.ts` — TypeScript mirror of ws_protocol.py
- `ccweb/frontend/src/App.tsx` — main React component (wires everything together)
- `ccweb/frontend/src/hooks/useSession.ts` — session state management
- `ccweb/frontend/src/hooks/useWebSocket.ts` — WebSocket connection + reconnect

### Known limitations
- **2-second message latency**: JSONL polling interval. inotify streaming is item #14 in deferred items.
- **No streaming**: Messages appear in bursts, not token-by-token. Status bar provides "working" feedback.
- **Fragile interactive UI parsing**: `ui_parser.py` screen-scrapes terminal text for checkbox markers. Falls back to raw text if parsing fails. Will break if Claude Code changes its UI format.
- **Tool output is `<pre>` blocks**: No rich diff viewer, search cards, or progress tracker yet (deferred items #1-4).

### Things that are NOT bugs (came up in reviews)
- `ccbot` in tmux session name references is intentional (shared tmux session)
- Infinite WebSocket reconnect (no "disconnected" terminal state) is by design
- `user_window_offsets` in session.py is dead code (never read/written) — harmless
- Module-level `msgCounter` in useSession.ts grows monotonically — intentional for unique React keys
