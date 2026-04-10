# CCWeb: React Web Gateway to Claude Code

## Context

CCBot currently bridges Telegram Forum topics to Claude Code sessions via tmux. The user wants a **richer web-based interface** that replaces Telegram entirely, with:
- A styled message stream (not raw terminal) with text input for sending messages/commands
- Interactive components: when Claude asks questions (AskUserQuestion, permission prompts), render them as clickable HTML instead of terminal navigation
- A **decision grid** system: a Claude Code skill outputs structured options, CCWeb renders them as an interactive HTML grid, user clicks selections, answers sent back to Claude Code
- Session management (create, switch, kill) similar to Telegram topics

The existing ccbot backend (tmux management, session monitoring, terminal parsing, JSONL parsing, hook system) is transport-agnostic and highly reusable. The Telegram-specific layer (bot.py, handlers/, markdown_v2.py, telegram_sender.py) gets replaced.

## User Workflow

**Current (ccbot + Telegram):**
```
WSL → tmux → run `ccbot` → interact via Telegram app
```

**New (ccweb + Browser):**
```
WSL → tmux → run `ccweb` → interact via browser at http://<tailscale-host>:8765
```

Everything else stays the same: Claude Code still runs in tmux windows, the SessionStart hook still writes session_map.json, the monitor still polls JSONL files. Only the UI layer changes.

Both can coexist: run `ccbot` AND `ccweb` simultaneously, both connecting to the same tmux sessions.

## Interactive UI in the Browser

All interactive Claude Code UIs currently handled by ccbot's terminal-navigation keyboard will be rendered as proper HTML components:

| Claude Code UI | Current (Telegram) | CCWeb (Browser) |
|---|---|---|
| ExitPlanMode | Arrow-key navigation | "Proceed" / "Edit Plan" buttons, plan rendered as markdown |
| AskUserQuestion | Arrow-key checkboxes | Clickable option cards, click to select + Submit |
| Permission Prompt | Arrow-key Yes/No | "Allow" / "Deny" buttons with action description |
| Bash Approval | Arrow-key approve | "Run" / "Deny" with command in code block |
| Settings/Model | Arrow-key menu | Dropdown or card selector |

Detection uses the same `terminal_parser.py` from ccbot — `extract_interactive_content()` identifies the UI type and content, then the backend sends structured data to the frontend via WebSocket, and the frontend renders the appropriate component. When the user clicks, the frontend sends the corresponding key (Enter, Escape, Space, Tab, arrows) back to tmux.

## Design Constraints

- **Single user**: This is a single-user application. No multi-user auth, no per-user state separation. The one user who runs `ccweb` is the only user.
- **Single browser session at a time**: While multiple tabs technically work (fan-out from SessionMonitor callback), interactive UI responses are not tab-locked — last click wins. This is acceptable for single-user.

## Architecture Overview

```
ccweb/
├── backend/          # Python (FastAPI + WebSocket)
│   ├── core/         # Copied + adapted from ccbot (transport-agnostic)
│   │   ├── tmux_manager.py      ← copy verbatim
│   │   ├── terminal_parser.py   ← copy verbatim
│   │   ├── transcript_parser.py ← adapt (remove Telegram expandable quote sentinels)
│   │   ├── session_monitor.py   ← copy verbatim
│   │   ├── monitor_state.py     ← copy verbatim
│   │   ├── hook.py              ← copy verbatim
│   │   └── utils.py             ← copy verbatim
│   ├── config.py         # New: web-specific config (port, auth, no Telegram)
│   ├── session.py        # Adapted: simplified bindings (client_id → window_id)
│   ├── server.py         # New: FastAPI app, WebSocket handler, REST endpoints
│   ├── ws_protocol.py    # New: WebSocket message types and serialization
│   └── main.py           # New: CLI entry point
├── frontend/         # React + TypeScript (Vite)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── MessageStream.tsx    # Styled message display
│   │   │   ├── MessageInput.tsx     # Text input + command sending
│   │   │   ├── SessionSidebar.tsx   # Session list + create/switch/kill
│   │   │   ├── InteractiveUI.tsx    # AskUserQuestion, permissions, etc.
│   │   │   ├── DecisionGrid.tsx     # Custom option grid rendering
│   │   │   ├── StatusBar.tsx        # Claude status (spinner, working text)
│   │   │   └── ExpandableBlock.tsx  # Thinking, tool results (click to expand)
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts      # WebSocket connection + reconnect
│   │   │   └── useSession.ts        # Session state management
│   │   ├── types.ts                 # Shared TypeScript types
│   │   └── protocol.ts             # WebSocket message types (mirrors ws_protocol.py)
│   └── package.json
├── pyproject.toml    # Python package config
└── README.md
```

## Module Reuse Map

### Forked Modules (NOT verbatim copies — all need adaptation)
Every ccbot module imports `from .config import config` and `from .utils import ccbot_dir`. These are **forks**, not copies. Each needs:
- Import paths updated (now under `ccweb.backend.core`)
- `ccbot_dir()` → `ccweb_dir()` (returns `~/.ccweb/` or `$CCWEB_DIR`)
- Config interface matched to the new ccweb config singleton

| Source | Destination | Changes Required |
|--------|------------|-----------------|
| `src/ccbot/tmux_manager.py` | `ccweb/backend/core/tmux_manager.py` | Update config import. Uses `config.tmux_session_name`, `config.claude_command`, `config.tmux_main_window_name` — new config must expose same attrs. |
| `src/ccbot/terminal_parser.py` | `ccweb/backend/core/terminal_parser.py` | Zero config deps — this one IS a true copy. Pure regex, no imports from config/utils. |
| `src/ccbot/session_monitor.py` | `ccweb/backend/core/session_monitor.py` | Update config import. Uses `config.claude_projects_path`, `config.monitor_poll_interval`, `config.session_map_file`, `config.show_user_messages`. |
| `src/ccbot/monitor_state.py` | `ccweb/backend/core/monitor_state.py` | Update utils import (`atomic_write_json`). Otherwise clean. |
| `src/ccbot/hook.py` | `ccweb/backend/core/hook.py` | Update to write to `~/.ccweb/session_map.json` (via `ccweb_dir()`). Hook command becomes `ccweb hook` instead of `ccbot hook`. |
| `src/ccbot/utils.py` | `ccweb/backend/core/utils.py` | Rename `ccbot_dir()` → `ccweb_dir()`, default `~/.ccweb/`, env var `CCWEB_DIR`. |
| `src/ccbot/transcript_parser.py` | `ccweb/backend/core/transcript_parser.py` | Remove `EXPANDABLE_QUOTE_START/END` sentinels. Keep all JSONL parsing logic. |
| `src/ccbot/config.py` | `ccweb/backend/config.py` | Full rewrite. Remove Telegram vars. Add web vars. Must expose same attribute names used by forked modules: `tmux_session_name`, `tmux_main_window_name`, `claude_command`, `claude_projects_path`, `monitor_poll_interval`, `state_file`, `session_map_file`, `monitor_state_file`, `show_user_messages`, `show_hidden_dirs`, `browse_root`, `memory_monitor_enabled`, etc. |
| `src/ccbot/session.py` | `ccweb/backend/session.py` | Replace `thread_bindings` with `client_bindings` (client_id → window_id). Remove group_chat_ids. Keep window_states, user_window_offsets, load_session_map, resolve_stale_ids, send_to_window, get_recent_messages. |

### Drop (Telegram-only, replaced by web equivalents)
- `src/ccbot/bot.py` → replaced by `server.py`
- `src/ccbot/handlers/` → replaced by WebSocket message handlers in `server.py`
- `src/ccbot/markdown_v2.py` → React renders markdown natively
- `src/ccbot/telegram_sender.py` → WebSocket sends (no 4096 char limit)
- `src/ccbot/screenshot.py` → optional; styled view replaces primary use

## WebSocket Protocol (`ws_protocol.py` / `protocol.ts`)

Bidirectional JSON messages over WebSocket:

### Server → Client
```
# New message from Claude (text, thinking, tool_use, tool_result)
{"type": "message", "window_id": "@0", "role": "assistant", "content_type": "text",
 "text": "...", "tool_use_id": null, "tool_name": null, "timestamp": "..."}

# Interactive UI detected (AskUserQuestion, permission, etc.)
{"type": "interactive_ui", "window_id": "@0", "ui_name": "AskUserQuestion",
 "content": "...", "options": [...]}   # parsed from terminal capture

# Decision grid (custom skill output)
{"type": "decision_grid", "window_id": "@0", "grid": {...}}

# Status update (spinner, working text)
{"type": "status", "window_id": "@0", "text": "Reading files..."}

# Session list update
{"type": "sessions", "sessions": [{"window_id": "@0", "name": "project", "cwd": "/path"}]}
```

### Client → Server
```
# Send text to Claude (like typing in terminal/Telegram)
{"type": "send_text", "window_id": "@0", "text": "Fix the bug in auth.py"}

# Send key press (for interactive UI navigation)
{"type": "send_key", "window_id": "@0", "key": "Enter"}

# Submit decision grid selections (each item has selected option + optional notes)
{"type": "submit_decisions", "window_id": "@0", "selections": [
  {"topic": "Auth module refactor", "choice": "Update to bcrypt v4 API", "notes": ""},
  {"topic": "Error handling", "choice": "Add retry with backoff", "notes": "Handle 429 specifically"},
  {"topic": "Logging", "choice": null, "notes": "Let's discuss structured logging first"}
]}

# Session management
{"type": "create_session", "work_dir": "/path/to/project", "name": "my-project"}
{"type": "kill_session", "window_id": "@0"}
{"type": "switch_session", "window_id": "@0"}

# Request history
{"type": "get_history", "window_id": "@0", "page": 0}
```

## Decision Grid Protocol

For the user's custom skill that generates option grids:

1. **Detection**: The skill writes a JSON file to `{session_cwd}/.ccweb/decisions/{id}.json`
2. **Backend monitors** this directory (or the skill outputs a marker in JSONL text)
3. **Grid JSON schema**:
```json
{
  "id": "decision-001",
  "title": "Code Review Decisions",
  "items": [
    {
      "topic": "Auth module refactor",
      "description": "The auth module uses deprecated bcrypt API...",
      "options": [
        {"label": "Update to bcrypt v4 API", "recommended": true},
        {"label": "Switch to argon2", "recommended": false},
        {"label": "Keep current (suppress warning)", "recommended": false}
      ],
      "allow_custom": true
    }
  ]
}
```
4. **Frontend** renders this as an interactive HTML table/card grid:
   - Each row: topic name | description | option radio buttons/cards | **notes column**
   - The **notes column** is always present on every row — a text input that lets the user:
     - Add additional context/details to accompany their selection
     - Provide a custom option not listed (override)
     - Ask a question or request more info on that specific topic
   - Recommended option is pre-selected/highlighted but user can change
   - "Submit All" button at bottom
5. **On submit**: client sends `{"type": "submit_decisions", ...}` with selections AND notes, backend formats as text and sends to Claude via `tmux_manager.send_keys()`
6. The text sent to Claude would be formatted like:
```
Decisions for "Code Review Decisions":
- Auth module refactor: Update to bcrypt v4 API
- Error handling: Add retry with backoff
  Note: "Make sure we handle the 429 case specifically"
- Logging strategy: [Custom] "Let's discuss this one more - what about structured logging?"
...
```

## Custom Interaction Types (CCWeb Protocol)

Beyond the decision grid, define additional structured interaction types that Claude Code skills can output. All use the same detection mechanism (marker in JSONL text or file in `.ccweb/`):

### 1. Decision Grid (primary use case)
See above. Skill outputs structured JSON, user selects options + adds notes, answers sent back.

### 2. Checklist
Simpler than a decision grid — just checkboxes with labels. User checks items and submits.
```json
{"type": "ccweb:checklist", "title": "Pre-deploy checks", "items": [
  {"label": "Tests passing", "checked": false},
  {"label": "Migrations reviewed", "checked": false},
  {"label": "ENV vars updated", "checked": true}
]}
```
Submitted as: "Checked: Tests passing, Migrations reviewed. Unchecked: ENV vars updated."

### 3. Status Report
A skill outputs a structured status dashboard. Read-only (no user interaction needed).
```json
{"type": "ccweb:status", "title": "Build Status", "items": [
  {"label": "Unit tests", "status": "pass", "detail": "142/142"},
  {"label": "Lint", "status": "fail", "detail": "3 errors in auth.py"},
  {"label": "Type check", "status": "pass", "detail": "0 errors"}
]}
```
Rendered as cards with green/yellow/red indicators.

### 4. Confirmation Dialog
For critical actions that need explicit user approval with context.
```json
{"type": "ccweb:confirm", "title": "Deploy to production?",
 "description": "This will deploy commit abc123 to prod. 3 migrations pending.",
 "severity": "high",
 "actions": [{"label": "Deploy", "value": "yes"}, {"label": "Cancel", "value": "no"}]}
```

### Detection Mechanism (file-based, primary)
The Claude Code skill writes a JSON file to a well-known location using the Write tool (which is atomic and reliable — no risk of malformed output or marker splitting):

```
{session_cwd}/.ccweb/pending/{type}-{timestamp}.json
```

Example: `.ccweb/pending/grid-1712345678.json`

The backend watches this directory (via polling alongside JSONL monitoring). When a new file appears:
1. Read and validate the JSON
2. Send structured WebSocket message to the frontend
3. Move file to `.ccweb/completed/` after user submits (or `.ccweb/dismissed/` if ignored)

**Why file-based instead of text markers**: Writing a file via Claude's Write tool is a deterministic tool call — always produces valid JSON, no streaming chunk splits, no code-block false positives, easy to debug (`cat` the file). Text markers (`<!--ccweb:grid {json}-->`) are fragile because Claude's output is free-form text that can be malformed, wrapped in code blocks, or split across JSONL entries.

**CRITICAL: Timing — how Claude waits for the user's response**:
The skill MUST use `AskUserQuestion` after writing the grid file. Without this, Claude writes the file and immediately proceeds — by the time the user sees the grid, Claude is 3 tool calls ahead, and the submitted text arrives as garbage input mid-thought.

Correct flow:
1. Skill writes grid JSON to `.ccweb/pending/grid-xxx.json` (via Write tool)
2. Skill IMMEDIATELY calls `AskUserQuestion` with: "I've prepared an option grid for you. Please review it in your CCWeb interface and submit your selections. (Your answers will appear here automatically.)"
3. `AskUserQuestion` **blocks Claude** — it waits for user input
4. Backend detects the grid file → sends to frontend via WebSocket
5. User fills out grid, clicks Submit
6. Backend sends formatted selection text to Claude via tmux keystrokes
7. Claude receives the text as the AskUserQuestion response, unblocks, and continues

This is the ONLY correct approach. The skill prompt must enforce steps 1+2 together.

### CCWeb Skill Installation
Skills are installed **globally** in `~/.claude/commands/` so they're available in every project. No per-repo copying needed.

**`ccweb install`** command auto-installs:
1. The SessionStart hook (same as ccbot's `ccbot hook --install`)
2. Global slash commands for all ccweb interaction types:
   - `~/.claude/commands/option-grid.md` — Decision/option grid
   - `~/.claude/commands/checklist.md` — Interactive checklist
   - `~/.claude/commands/status-report.md` — Status dashboard
   - `~/.claude/commands/confirm.md` — Confirmation dialog

**Example: `~/.claude/commands/option-grid.md`:**
```markdown
# Option Grid

When called, research the topics provided and output an option grid for the user.

You MUST do these two steps in sequence:

Step 1: Write the grid as a JSON file using your Write tool to this exact path:
  {cwd}/.ccweb/pending/grid-{timestamp}.json

Use this schema:
{"id": "unique-id", "type": "ccweb:grid", "title": "...", "items": [
  {"topic": "...", "description": "...", "allow_custom": true,
   "options": [{"label": "...", "recommended": true}, ...]}
]}

Each item must have: topic, description, options (array with recommended flag),
allow_custom: true. Always include 2-4 options per topic with one marked as recommended.

Step 2: IMMEDIATELY after writing the file, use AskUserQuestion to ask:
"I've prepared an option grid. Please review it in your CCWeb interface and submit
your selections. Your choices will appear here automatically."

This is critical — AskUserQuestion blocks you until the user responds via CCWeb.
Do NOT proceed without waiting. The user's selections will be sent back as text.
```

Run `ccweb install` once and all commands are available everywhere.

## Implementation Order

### Phase 1: Project Scaffold + Core Backend
1. Create `ccweb/` directory structure
2. Create `pyproject.toml` with deps: `fastapi`, `uvicorn[standard]`, `websockets`, `libtmux`, `aiofiles`, `python-dotenv` — pin same `libtmux` version as ccbot to avoid API breakage
3. **Create `config.py` FIRST** — this is the foundation. Must expose all attribute names used by forked modules (`tmux_session_name`, `claude_projects_path`, `state_file`, `session_map_file`, etc.) without Telegram deps
4. **Create `utils.py` SECOND** — `ccweb_dir()` returning `~/.ccweb/`, `atomic_write_json()`
5. Fork modules from ccbot to `ccweb/backend/core/`: update all `from .config import config` and `from .utils import` paths. `terminal_parser.py` is the only true copy (zero config/utils deps).
6. Adapt `transcript_parser.py` (remove Telegram expandable quote sentinels)
7. Adapt `hook.py` — writes to `~/.ccweb/session_map.json`, command is `ccweb hook`
8. Create simplified `session.py` (client_bindings instead of thread_bindings)
9. Create `ws_protocol.py` (message type definitions)
10. Create `server.py` (FastAPI app, WebSocket handler, REST endpoints)
11. Create `main.py` (CLI entry with `ccweb`, `ccweb install`, `ccweb hook` subcommands)
12. **Verify**: run `ccweb` — FastAPI starts, WebSocket connects, health check passes

### Phase 2: React Frontend Scaffold
1. `npm create vite@latest frontend -- --template react-ts`
2. Install deps: `react-markdown`, `remark-gfm` (markdown rendering), a CSS framework (Tailwind or similar)
3. Create `protocol.ts` (mirrors WebSocket types)
4. Create `useWebSocket.ts` hook (connect, reconnect, message dispatch)
5. Create basic `App.tsx` layout (sidebar + main content area)

### Phase 3: Message Stream + Input
1. `MessageStream.tsx` - renders messages with role-based styling:
   - Assistant text → markdown rendered
   - Thinking → collapsible/expandable block
   - tool_use → summary line (like "**Read**(file.py)")
   - tool_result → `<pre>` block (collapsible). Rich rendering (diff viewer, search cards) deferred to v2
   - User messages → right-aligned or prefixed
2. `FileUpload.tsx` - document/file upload:
   - Paperclip (📎) button next to the text input
   - Accepts: text files, code, Markdown, PDF, Word docs, images (same as ccbot's allowed types)
   - Upload flow: file sent to backend → saved to `{session_cwd}/docs/inbox/{filename}` → path sent to Claude via tmux as "A file has been saved to docs/inbox/{name}. Read it with your Read tool."
   - Optional caption/instruction text alongside the upload
   - Drag-and-drop support on the message area
   - Image files rendered as inline thumbnails before sending
3. `MessageInput.tsx` - multi-line text area with:
   - **Enter = newline** (multi-line input by default)
   - **Visible Submit button** to send the message
   - **Ctrl+Enter / Cmd+Enter** keyboard shortcut to submit (optional accelerator)
   - `/command` forwarding (auto-complete dropdown on `/`)
   - Command history (Ctrl+Up / Ctrl+Down to cycle through previous messages)
3. `StatusBar.tsx` - shows Claude's current status (spinner text)

**Note on latency**: JSONL polling at 2s means responses appear in bursts, not token-by-token streaming. The status bar (polled at 1s) provides "Claude is working..." feedback during the gap. This matches ccbot's current latency. True streaming would require monitoring the JSONL file via inotify/watchdog instead of polling — a v2 enhancement.

### Phase 4: Session Management
The session sidebar replaces Telegram's topic list:
1. `SessionSidebar.tsx`:
   - List active sessions (window_id, name, cwd, status indicator)
   - Click to switch (binds WebSocket to that window, loads history)
   - **"+ New Session" button** → opens directory picker modal
   - Kill session: X button on each session (confirms first)
   - Session status: idle / working / waiting for input (based on status polling)
2. `DirectoryPicker.tsx` (modal):
   - File-tree browser (reuses ccbot's directory browsing logic on backend)
   - Click folders to navigate, "Select" to confirm
   - Path text input for direct entry
   - Recent directories list (persisted in localStorage)
   - Optional session name field
3. Backend:
   - `POST /api/sessions` → create_window + start Claude + wait for session_map
   - `GET /api/sessions` → list active sessions
   - `DELETE /api/sessions/{window_id}` → kill_window + cleanup
   - WebSocket broadcasts session list changes to all connected clients

### Phase 5: Interactive UI Components
1. **Backend: structured UI parser** (`ui_parser.py`):
   - `terminal_parser.py` returns raw text (`InteractiveUIContent.content` is a string with Unicode checkboxes like `☐✔☒`, cursor markers, etc.)
   - New `ui_parser.py` module parses this raw text into structured data:
     - AskUserQuestion: extract option labels + checked/unchecked state from `☐`/`✔`/`☒` markers
     - PermissionPrompt: extract the action description + yes/no options
     - ExitPlanMode: extract plan summary text
     - BashApproval: extract the bash command being requested
   - This is **fragile screen-scraping** — Claude Code can change its terminal UI format. The parser must be defensive with fallback to raw text display.
   - WebSocket message includes both structured data (when parsing succeeds) AND raw text (always, as fallback)
2. `InteractiveUI.tsx`:
   - When `type: "interactive_ui"` arrives via WebSocket:
     - If structured data present: render as clickable cards/buttons
     - If only raw text: render in a `<pre>` block with generic navigation buttons (like ccbot's keyboard)
     - AskUserQuestion → clickable option cards
     - PermissionPrompt → "Allow" / "Deny" buttons with action description
     - ExitPlanMode → "Proceed" / "Edit" buttons
   - Clicking sends `send_key` back (Enter, Escape, Space, Tab, arrows)
   - **Stale UI guard**: before sending a key, backend re-captures the pane and verifies the interactive UI is still showing. If not, discard the click and notify the user "This prompt has expired."
3. Backend: detect interactive UIs via `terminal_parser.py`, parse via `ui_parser.py`, send structured data + raw text over WebSocket

### Phase 6: Decision Grid
1. `DecisionGrid.tsx`:
   - Renders grid items as cards in a table/grid layout
   - Each item shows topic, description, and radio buttons for options
   - Recommended option highlighted
   - "Submit All" button
   - Overlay/modal that slides over the message stream
2. Backend: poll `.ccweb/pending/` directory alongside JSONL monitoring (same poll loop, no extra loop)
   - On new file: validate JSON schema, send to frontend, move to `.ccweb/completed/` on submit
   - On invalid JSON: log warning, move to `.ccweb/failed/`, notify frontend with error
   - Stale file cleanup: files older than 1 hour in `pending/` are moved to `failed/`
   - `.ccweb/pending/` directory is auto-created by the backend on session creation
3. Define the Claude Code skill contract (JSON schema for decision files)
4. **Timing**: the skill MUST call AskUserQuestion after writing the file to block Claude (see Detection Mechanism section above)

### Phase 7: Command Palette & Skill Picker
1. **Command auto-complete in MessageInput**:
   - Typing `/` in the text input triggers a dropdown above the input
   - Built-in commands shown with descriptions: `/clear` (Clear history), `/compact` (Compact context), `/model` (Switch model), `/fast` (Toggle fast mode), `/plan` (Enter plan mode), `/cost` (Show usage), `/help`, `/memory`, `/config`, etc.
   - Click to insert and send, or keep typing to filter
2. **Repo skills discovery**:
   - Backend endpoint: `GET /api/sessions/{window_id}/skills`
   - Reads `{session_cwd}/.claude/commands/` directory for custom slash commands
   - Parses command files to extract name + description (first line of the file is typically the description)
   - Frontend shows these in the command dropdown, grouped under "Project Commands" separately from "Built-in Commands"
   - Skills refresh when switching sessions (different repos have different skills)
3. **Dropdown command selector**: A `▾` button next to the text input that opens the full command/skill list without needing to type `/`. Provides discoverability — browse all available commands and skills via click. Same grouped list as the auto-complete (Built-in Commands | Project Commands).
4. **Toolbar quick-actions**: Persistent buttons above the message input for frequent actions:
   - `/esc` (interrupt Claude) — prominent, always visible
   - Command palette button (opens full command/skill list)
   - Screenshot button (captures terminal as image, useful for sharing)

### Phase 8: Message Filters
1. **Filter bar** at the top of the message stream with toggleable chips:
   - **All** — everything (default)
   - **Chat** — only user messages + assistant text (hides tool_use, tool_result, thinking)
   - **No thinking** — everything except thinking blocks
   - **Tools** — only tool_use + tool_result (see what Claude did without the prose)
2. Filter state persisted per session (localStorage) — each session can have its own filter
3. Implementation: each message already has `content_type` from the JSONL parse, so filtering is a simple frontend predicate on the message list. No backend changes needed.

### Phase 9: Documentation Wiki
**Single source of truth**: Markdown files in `ccweb/docs/` serve both as repo-readable docs AND as the in-app wiki. No content duplication.

**Doc structure** (`ccweb/docs/`):
```
docs/
├── index.md                  # Home page, links to all sections
├── getting-started/
│   ├── installation.md       # Prerequisites, install steps, first run
│   ├── setup.md              # Tailscale setup, .env config, ccweb install
│   └── quickstart.md         # Create your first session, send a message, see response
├── configuration/
│   ├── env-variables.md      # Full .env reference table (every variable, default, description)
│   ├── preferences.md        # Web UI settings page options
│   └── claude-code-setup.md  # SessionStart hook, Claude Code configuration
├── features/
│   ├── sessions.md           # Creating, switching, killing sessions
│   ├── message-stream.md     # Message types, markdown rendering, auto-scroll
│   ├── interactive-ui.md     # AskUserQuestion, permissions, plan mode buttons
│   ├── option-grid.md        # Decision grid: how it works, skill usage, JSON schema
│   ├── custom-interactions.md # Checklist, status report, confirm dialog
│   ├── commands.md           # /command auto-complete, dropdown, built-in vs project commands
│   ├── message-filters.md    # Filtering by content type
│   ├── subagents.md          # Subagent activity tracking and display
│   ├── diff-viewer.md        # File diff rendering
│   └── keyboard-shortcuts.md # All shortcuts reference
├── architecture/
│   ├── overview.md           # System architecture diagram
│   ├── design-plan.md        # This plan document (original design decisions & rationale)
│   ├── backend.md            # FastAPI, WebSocket protocol, session management
│   ├── frontend.md           # React components, state management
│   ├── ccweb-protocol.md     # Custom interaction type markers, JSON schemas
│   └── reused-from-ccbot.md  # What was reused from ccbot and how
├── troubleshooting/
│   ├── common-issues.md      # FAQ: can't connect, sessions not appearing, etc.
│   ├── websocket.md          # WebSocket connection issues, reconnection
│   ├── tmux.md               # Tmux session issues, window ID resolution
│   └── logs.md               # Where to find logs, debug mode
└── changelog.md              # Version history
```

**Every doc file has:**
- YAML frontmatter: `title`, `description`, `order` (for sidebar sorting)
- Table of contents (auto-generated from headings)
- Internal links using relative paths: `[Option Grid](../features/option-grid.md)`
- Works when browsing on GitHub/filesystem AND in the web UI

**In-app wiki (`/wiki` route in frontend):**
- `WikiPage.tsx` — renders a single doc page with react-markdown
- `WikiSidebar.tsx` — navigation tree built from the docs/ directory structure
- Backend: `GET /api/docs` returns the doc tree (filenames + frontmatter)
- Backend: `GET /api/docs/{path}` returns raw markdown content for a specific file
- Internal links rewritten to `#/wiki/...` routes in the web UI
- Search: full-text search across all doc files (backend endpoint)
- Breadcrumb navigation at top of each page

### Phase 10: Responsive Design (Desktop + Tablet)
Target: Chrome for Windows (desktop) + Chrome for Android on Samsung Z Fold 7 (tablet mode).

1. **Layout breakpoints**:
   - Desktop (>1024px): sidebar visible + main content area side by side
   - Tablet (768-1024px): sidebar as hamburger drawer, full-width content
   - The Z Fold 7 in tablet mode is ~7.6" at ~904px width → tablet layout
2. **Touch-friendly**:
   - All interactive elements minimum 44x44px touch targets
   - Swipe gestures: swipe right to open sidebar, swipe left to close
   - Decision grid options as large tap targets (cards, not tiny radio buttons)
   - Submit button prominently sized
3. **Input handling**:
   - On tablet: virtual keyboard push-up handling (input stays visible above keyboard)
   - Auto-resize text area as you type
4. **CSS approach**: Tailwind CSS with responsive utilities (`md:`, `lg:` prefixes)
   - Flexbox layout that reflows naturally
   - No fixed pixel widths on content areas

### Phase 11: Quality-of-Life Features

1. **Browser notifications** (`useNotifications.ts`):
   - Request notification permission on first visit
   - Push notification when: Claude finishes a task (stop_reason set), interactive UI appears (AskUserQuestion, permission), subagent completes
   - Only fires when the tab is not focused or screen is off
   - Notification click brings you to the correct session
   - On Android/tablet: works with Chrome's built-in notification system

2. **Context & cost indicator** (`ContextBar.tsx`):
   - Persistent badge in the status bar: "Context: 34% | $2.15"
   - Backend periodically captures `/usage` output via terminal_parser's `parse_usage_output()`
   - Or: parse the status line chrome (bottom bar of Claude Code pane shows model + context %)
   - Color changes: green (<50%), yellow (50-80%), red (>80%)
   - Click to expand full usage details (token counts, rate limits)

3. **Session persistence on page reload**:
   - On WebSocket connect, backend sends full session list + which session was last active
   - Client stores last active session in localStorage
   - On reconnect: auto-binds to last session, requests message history via `get_recent_messages()`
   - Messages load from JSONL (the full history is always there), so no data loss on browser close/refresh

4. **Copy buttons on code blocks** (`CodeBlock.tsx`):
   - One-click copy icon (📋) on every fenced code block, inline code, diff output, and command output
   - "Copied!" toast feedback
   - For diffs: option to copy just the new content (without diff markers)
   - Uses `navigator.clipboard.writeText()`

5. **Connection status indicator**:
   - Small badge in the top bar: 🟢 Connected | 🟡 Reconnecting | 🔴 Disconnected
   - On disconnect: auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - On reconnect: replays any missed messages (backend tracks last-delivered offset per client)
   - Manual "Reconnect" button when auto-reconnect fails

6. **Session rename**:
   - Double-click session name in sidebar → inline edit field
   - Or right-click → "Rename" context menu
   - Backend calls `tmux_manager.rename_window()` + updates display name in session state
   - Updates reflected immediately across all connected clients

7. **Export conversation** (`ExportButton.tsx`):
   - Button in session header: "Export" → dropdown: Markdown / JSON / Plain Text
   - **Markdown**: formatted conversation with headers, code blocks, tool summaries (ready for sharing)
   - **JSON**: raw JSONL entries (for programmatic use)
   - **Plain text**: stripped of all formatting
   - Filters applied: export respects current message filter (e.g., "Chat only" exports only user+assistant text)
   - Downloads as a file: `{session-name}-{date}.md`

### Phase 12: Polish & UX
1. Auto-scroll behavior (pause on scroll-up, resume on new messages)
2. Expandable blocks for thinking/tool results (click to expand/collapse)
3. Image rendering for tool_result images (base64 → inline img)
4. WebSocket reconnection (auto-reconnect + replay missed messages)
5. Keyboard shortcuts: Escape to interrupt, Ctrl+K for command palette, Ctrl+N for new session
6. Dark/light theme toggle (default dark, matching terminal aesthetic)
7. Notification badge on sessions with unread messages (when viewing a different session)

## Technical Issues to Address (from review)

1. **SessionMonitor single callback**: Wrap in a fan-out broadcaster. One callback registered, it iterates all connected WebSocket clients and sends. Single-user means this is simple.

2. **Byte offset + WebSocket delivery**: Since single-user, offsets persist after `ws.send()` (fire-and-forget). On reconnect, client sends its last-received message timestamp; backend replays from that point via `get_recent_messages()` with byte offset.

3. **WebSocket keepalive**: Add ping/pong frames (FastAPI/Starlette supports this natively with `websocket.send_json` + periodic pings). 30s interval.

4. **Error message type**: Add `{"type": "error", "code": "...", "message": "..."}` to the WebSocket protocol for backend failures (tmux down, session_map corrupt, etc.).

5. **`session_map.json` read race**: Use `fcntl.flock` for reads too (shared lock), matching the hook's exclusive lock on writes. Or: read with retry on `JSONDecodeError`.

6. **`config.py` import chain**: The adapted `config.py` for ccweb does NOT import Telegram config. All "copy verbatim" modules import from `ccweb.backend.core.config` (the new one), not the old ccbot config. This breaks the Telegram dependency chain entirely.

7. **WebSocket protocol additions**:
   - `{"type": "ping"}` / `{"type": "pong"}` — keepalive
   - `{"type": "error", "code": "...", "message": "..."}` — backend errors
   - `{"type": "replay_request", "since_timestamp": "..."}` — client reconnection catch-up
   - `{"type": "replay", "messages": [...]}` — server replay response

## V2 Roadmap (deferred features)

Saved as `ccweb/docs/architecture/v2-roadmap.md` alongside the design plan.

### Rich Tool Output (from Phase 7.5, deferred)
- **File diff viewer** (`DiffViewer.tsx`): Edit tool diffs rendered with green/red line highlighting, collapsible per file
- **Progress tracker** (`ProgressTracker.tsx`): TodoWrite rendered as persistent checkbox panel, pinned above message stream
- **Search results cards** (`SearchResults.tsx`): WebSearch as cards with title/snippet/link, Grep as highlighted matches
- **Destructive action warning**: Permission prompts for `rm`, `reset --hard` etc. rendered with red highlight border

### Subagent Activity Tracking (from Phase 7.6, deferred)
- Collapsible task cards in message stream (header: "Agent: {description}" with running/complete indicator)
- Subagent status badge ("2 agents running")
- Future: monitor subagent JSONL files directly for real-time streaming

### Saved Prompts Library (from Phase 8, deferred)
- Prompt Library UI with title, category, preview, fuzzy search
- Variable placeholders: `{{filename}}`, `{{description}}` → form fill on insert
- Global prompts (`~/.ccweb/prompts/`) + per-project prompts (`{project}/.ccweb/prompts/`)
- CRUD API endpoints

### Creative UX Explorations
Ideas from the creative review to explore for v2:
- **Message threading**: Nest question/answer exchanges visually (Slack-style threads)
- **Optimistic input**: Show user's message immediately with pending indicator before tmux round-trip
- **Session timeline scrubber**: Horizontal minimap of session phases (thinking/tool use/conversation/idle), click to jump
- **Live file preview pane**: Split view showing file's current state after Edit, not just the diff
- **Pinned messages**: Pin key decisions/outputs to the top of a session
- **Session heatmap**: Which sessions were active when, token spend per session
- **Quick reactions on tool results**: Thumbs-up/flag individual outputs as feedback
- **Minimap**: VS Code-style vertical scroll overview of message density and type
- **Keyboard-first navigation**: Linear-style shortcuts (G+S for sessions, G+P for prompts)
- **Stackable message filters**: Combine filters (e.g., "chat + tools but not thinking")

### Decision Grid v2 Improvements
- **Keyboard navigation**: Arrow keys between cells, Enter to select, Tab to notes column
- **Comparison mode**: Select two options, see side-by-side with differences highlighted
- **Fuzzy search in saved prompts**: Raycast/Alfred-style instant matching
- **Collapsible file-change groups**: GitHub-style when diffs are numerous

## Key Files to Create

| File | Purpose |
|------|---------|
| `ccweb/pyproject.toml` | Python package: fastapi, uvicorn, libtmux, aiofiles, dotenv |
| `ccweb/backend/core/__init__.py` | Core module init |
| `ccweb/backend/core/tmux_manager.py` | Copy from ccbot |
| `ccweb/backend/core/terminal_parser.py` | Copy from ccbot |
| `ccweb/backend/core/transcript_parser.py` | Adapted from ccbot |
| `ccweb/backend/core/session_monitor.py` | Copy from ccbot |
| `ccweb/backend/core/monitor_state.py` | Copy from ccbot |
| `ccweb/backend/core/hook.py` | Copy from ccbot |
| `ccweb/backend/core/utils.py` | Copy from ccbot |
| `ccweb/backend/config.py` | Web-specific configuration |
| `ccweb/backend/session.py` | Simplified session management |
| `ccweb/backend/server.py` | FastAPI + WebSocket server |
| `ccweb/backend/ws_protocol.py` | Message type definitions |
| `ccweb/backend/main.py` | CLI entry point |
| `ccweb/frontend/package.json` | React app dependencies |
| `ccweb/frontend/src/App.tsx` | Main layout |
| `ccweb/frontend/src/protocol.ts` | WebSocket message types |
| `ccweb/frontend/src/hooks/useWebSocket.ts` | WebSocket hook |
| `ccweb/frontend/src/components/MessageStream.tsx` | Message display |
| `ccweb/frontend/src/components/MessageInput.tsx` | Text input |
| `ccweb/frontend/src/components/SessionSidebar.tsx` | Session list |
| `ccweb/frontend/src/components/InteractiveUI.tsx` | Interactive prompts |
| `ccweb/frontend/src/components/DecisionGrid.tsx` | Option grid |
| `ccweb/frontend/src/components/StatusBar.tsx` | Status display |
| `ccweb/frontend/src/components/ExpandableBlock.tsx` | Collapsible content |

## Startup Health Checks & Error UX

On startup, `ccweb` runs validation before accepting connections:

1. **tmux running?** — Check `tmux list-sessions`. If not: print clear error "tmux is not running. Start tmux first: `tmux new -s ccbot`"
2. **Hook installed?** — Check `~/.claude/settings.json` for SessionStart hook pointing to `ccweb hook`. If not: print warning "SessionStart hook not installed. Run `ccweb install` first. Sessions will not be monitored."
3. **State directory exists?** — Create `~/.ccweb/` if missing.
4. **Config valid?** — Validate .env loaded, required vars present.

On WebSocket connect, send a `{"type": "health", "status": {...}}` message with:
- `tmux_running: bool`
- `hook_installed: bool`
- `sessions_found: int`
- `warnings: string[]`

Frontend renders a diagnostic banner for any issues: "Hook not installed — run `ccweb install`" with a one-click fix button (calls backend endpoint that installs the hook).

**Error states in the UI**:
- tmux not running → red banner: "tmux is not running"
- WebSocket disconnected → yellow banner with reconnect button
- Session killed externally → session shows "(ended)" in sidebar with explanation
- Hook not installed → orange banner with install button
- No sessions → helpful empty state: "No sessions yet. Click + New Session to start."

## Backend Server Design (`server.py`)

```python
# FastAPI app serves:
# - GET / → React static files (production) or proxy to Vite dev server
# - WebSocket /ws → bidirectional real-time communication
# - GET /api/sessions → list active sessions
# - POST /api/sessions → create new session
# - DELETE /api/sessions/{window_id} → kill session

# On startup:
# 1. Initialize TmuxManager, SessionManager, SessionMonitor
# 2. Start SessionMonitor polling loop
# 3. Start status polling loop (1s interval, like ccbot)
# 4. Set message callback to broadcast to connected WebSocket clients

# WebSocket handler:
# - On connect: send current session list + bind to active window
# - On message: dispatch by type (send_text, send_key, submit_decisions, etc.)
# - On disconnect: clean up client binding

# Message callback (from SessionMonitor):
# - For each NewMessage, find connected clients bound to that window
# - Serialize and send via WebSocket
# - For AskUserQuestion/ExitPlanMode tool_use: capture terminal, 
#   parse interactive UI, send structured data instead of raw text
```

## Hosting & Remote Access

The FastAPI server serves both the API (WebSocket + REST) and the built React static files on a **single port** (default 8765). No separate frontend hosting needed.

**With Tailscale (user's current setup):**
- Server binds to `0.0.0.0:8765`
- Access from any device on the tailnet: `http://<machine-name>:8765`
- Tailscale ACLs control access (no separate auth needed if tailnet is trusted)
- Optional HTTPS: `tailscale cert` + uvicorn SSL config, or `tailscale serve --bg 8765` for automatic HTTPS at `https://<machine>.tail-net.ts.net`

**Server config** (`.env` file in `~/.ccweb/` or env vars — set once, requires restart):
```bash
CCWEB_HOST=0.0.0.0          # Bind address
CCWEB_PORT=8765              # Port
CCWEB_AUTH_TOKEN=            # Optional bearer token (empty = no auth, rely on Tailscale)
TMUX_SESSION_NAME=ccbot      # Tmux session name
CLAUDE_COMMAND=claude         # Command to start Claude Code
CCWEB_BROWSE_ROOT=           # Starting dir for session browser (empty = home)
MONITOR_POLL_INTERVAL=2.0    # Seconds between JSONL polls
CCWEB_SHOW_HIDDEN_DIRS=false # Show dot-dirs in browser
# Memory monitoring
CCWEB_MEMORY_MONITOR=true
CCWEB_MEM_AVAIL_WARN_MB=1024
CCWEB_MEM_AVAIL_INTERRUPT_MB=512
CCWEB_MEM_AVAIL_KILL_MB=256
```

**User preferences** (settings page in the web UI — changeable live, persisted to `~/.ccweb/preferences.json`):
- Theme: dark / light
- Default message filter: All / Chat / No thinking / Tools
- Show hidden directories in browser
- Auto-scroll behavior (pause on scroll-up, resume on new messages)
- Submit shortcut: Ctrl+Enter / Cmd+Enter toggle

The settings page is accessible via a gear icon in the sidebar. Changes take effect immediately without restart.

**Production serving:**
- `uvicorn ccweb.backend.main:app --host 0.0.0.0 --port 8765`
- React app built with `npm run build` → static files served by FastAPI's `StaticFiles` mount
- In dev: Vite dev server on :5173 proxies API calls to FastAPI on :8765
- **IMPORTANT**: Vite proxy must explicitly enable WebSocket: `server.proxy["/ws"] = { target: "ws://localhost:8765", ws: true }` in `vite.config.ts`. Without `ws: true`, WebSocket upgrade handshake fails silently.

## Per-Project Setup (What a new repo needs)

**Short answer**: Run `ccweb install` once, and new projects work automatically.

**What `ccweb install` sets up globally (one time):**
- `~/.claude/settings.json` → SessionStart hook (writes session_map.json when Claude starts)
- `~/.claude/commands/option-grid.md` → option grid slash command
- `~/.claude/commands/checklist.md`, `status-report.md`, `confirm.md` → other interaction commands

**What a new project gets for free (zero setup):**
- Session creation via ccweb's directory browser
- Real-time message streaming
- All interactive UI handling (AskUserQuestion, permissions, plan mode)
- All built-in /commands and the global ccweb skills
- File upload, message filters, subagent tracking, diff viewer, etc.

**Optional per-project enhancements** (add to the project's `CLAUDE.md` if you want Claude to proactively use ccweb features):
```markdown
## CCWeb Integration
- When presenting multiple options/decisions to the user, use the /option-grid command
- When reporting build/test status, use the /status-report command
- For critical destructive actions, use the /confirm command before proceeding
```

**Optional per-project prompts** (for the Saved Prompts library):
- Create `{project}/.ccweb/prompts/deploy.md`, `review.md`, etc.
- These show up in the prompt library only when that project's session is active

**Per-project CCWeb instructions** (avoids mutating CLAUDE.md directly):
Instead of writing into CLAUDE.md (which creates git noise, merge conflicts, and meaningless diffs), ccweb creates a separate `.ccweb/instructions.md` file that CLAUDE.md can reference:

1. **On session creation**: If the project has no `.ccweb/instructions.md`, a subtle banner appears: "Enable CCWeb features for this project?" → click to create.
2. **"Setup CCWeb" button**: Available in the session sidebar (per-session gear icon). One click creates/updates `.ccweb/instructions.md`.
3. **The file** contains ccweb-specific instructions for Claude:
```markdown
## CCWeb Integration
- When presenting multiple options/decisions to the user, use /option-grid
- When reporting build/test/deploy status, use /status-report
- For interactive checklists, use /checklist
- For critical destructive actions, use /confirm before proceeding
```
4. **CLAUDE.md reference** (optional, user adds manually if they want): Add one line to CLAUDE.md: `See @.ccweb/instructions.md for CCWeb integration.`
5. `.ccweb/` can be `.gitignore`d if the user doesn't want it tracked — no git noise.
6. **Backend**: `POST /api/sessions/{window_id}/setup-ccweb` → creates `.ccweb/instructions.md` in the session's working directory.

**Summary**: A bare repo with no ccweb-specific files works perfectly. The CLAUDE.md management is an optional convenience — one click to enable, auto-updated as ccweb evolves, and clearly delimited so it doesn't interfere with your own CLAUDE.md content.

## Portability

The `ccweb/` folder is **completely self-contained** — no imports from the parent ccbot-workshop repo. All reused modules are copied into `ccweb/backend/core/`. To make it a standalone repo:

1. Copy `ccweb/` to a new location
2. `git init` → it's a new repo
3. Has its own `pyproject.toml`, `package.json`, README, docs, etc.
4. No changes needed — everything works out of the box

The only shared resource is the tmux session itself. State is fully separate:
- ccbot uses `~/.ccbot/` (state.json, session_map.json, monitor_state.json)
- ccweb uses `~/.ccweb/` (its own state.json, session_map.json, monitor_state.json)
- Both can monitor the same tmux windows without conflict (read-only JSONL access)
- The SessionStart hook must be `ccweb hook` (writes to `~/.ccweb/`), not `ccbot hook`
- If running both simultaneously, install BOTH hooks in `~/.claude/settings.json`

## Key Reusable Methods from session.py

The adapted `session.py` will keep these critical methods (changing only the binding model):
- `resolve_stale_ids()` — re-resolve window IDs after tmux restart
- `load_session_map()` — read hook-generated session_map.json
- `get_window_state()` / `clear_window_session()` — window state management
- `send_to_window()` — send text + auto-resume Claude if exited
- `get_recent_messages()` — retrieve history with byte-range support
- `resolve_session_for_window()` — window_id → ClaudeSession resolution
- `wait_for_session_map_entry()` — poll for hook to fire after window creation
- `find_users_for_session()` → renamed `find_clients_for_session()` — route incoming messages to connected WebSocket clients

**Binding model change**: Replace `thread_bindings: dict[int, dict[int, str]]` (user_id → {thread_id → window_id}) with `client_bindings: dict[str, str]` (client_id → window_id). Each WebSocket connection has a unique client_id and can be bound to one window at a time.

## Verification Plan

1. **Backend standalone**: Start server, connect WebSocket client (wscat), verify session list, create session, send text, receive messages
2. **Frontend dev**: `npm run dev` in frontend/, verify React app loads, WebSocket connects
3. **End-to-end**: Create session via UI, send a message, see Claude's response stream in, interact with AskUserQuestion via clickable options
4. **Decision grid**: Manually create a test `.ccweb/decisions/test.json`, verify it renders in the frontend, submit selections, verify text arrives in Claude's tmux pane
5. **Linting**: `ruff check` + `ruff format` + `pyright` on all Python files in `ccweb/backend/`
