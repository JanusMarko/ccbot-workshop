# CLAUDE.md

ccweb — React web gateway to Claude Code sessions via tmux. Replaces the Telegram interface with a browser-based UI.

Tech stack: Python (FastAPI + WebSocket), React (TypeScript + Vite + Tailwind), tmux (libtmux).

## Common Commands

```bash
# Backend
cd ccweb && uv run ruff check ccweb/backend/       # Lint
cd ccweb && uv run ruff format ccweb/backend/       # Format
cd ccweb && pip install -e .                         # Install backend

# Frontend
cd ccweb/frontend && npx tsc -b --noEmit            # Type check
cd ccweb/frontend && npx vite build                  # Production build
cd ccweb/frontend && npm run dev                     # Dev server (:5173)

# Run
ccweb                    # Start server (default :8765)
ccweb install            # Install hook + global commands
ccweb hook               # SessionStart hook handler
```

## Documentation Wiki — IMPORTANT

The `docs/` directory contains all user-facing documentation, rendered both as repo-readable markdown AND in the in-app wiki at `/wiki`.

**When you change any feature, endpoint, component, protocol message, configuration option, or user-facing behavior, you MUST update the corresponding doc file in `docs/`.** This is not optional — the wiki is the primary user documentation.

Doc files use YAML frontmatter (`title`, `description`, `order`) for wiki sidebar sorting. Internal links use relative paths (`../features/sessions.md`).

Key doc locations:
- `docs/getting-started/` — installation, setup, quickstart
- `docs/configuration/` — env vars, preferences
- `docs/features/` — one file per feature
- `docs/architecture/` — system design, protocol reference
- `docs/troubleshooting/` — common issues, debugging

## Architecture

- Backend: `ccweb/backend/` — FastAPI server, WebSocket handler, session management
- Core modules: `ccweb/backend/core/` — forked from ccbot (tmux_manager, session_monitor, terminal_parser, etc.)
- Frontend: `frontend/src/` — React components, hooks, protocol types
- State: `~/.ccweb/` — state.json, session_map.json, monitor_state.json, preferences.json
- Docs: `docs/` — markdown wiki files

## Key Design Constraints

- **Single user** — no multi-user auth
- **File-based decision grids** — skills write JSON to `.ccweb/pending/`, backend polls, AskUserQuestion blocks Claude
- **WebSocket protocol** — all real-time comms via typed JSON messages (see `ws_protocol.py` / `protocol.ts`)
- **Forked modules** — core/ modules are forks from ccbot with import paths adapted; `~/.ccweb/` state is fully separate from `~/.ccbot/`
