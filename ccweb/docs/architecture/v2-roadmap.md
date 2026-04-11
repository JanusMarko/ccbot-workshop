---
title: V2 Roadmap
description: Deferred features and future enhancements for CCWeb
order: 2
---

# CCWeb V2 Roadmap

Features deferred from v1, organized by category.

## Table of Contents

- [Rich Tool Output](#rich-tool-output)
- [Subagent Activity Tracking](#subagent-activity-tracking)
- [Saved Prompts Library](#saved-prompts-library)
- [Creative UX Explorations](#creative-ux-explorations)
- [Decision Grid v2 Improvements](#decision-grid-v2-improvements)
- [Performance: Streaming via inotify](#performance-streaming-via-inotify)

---

## Rich Tool Output

Replace `<pre>` blocks with interactive, tool-specific rendering:

- **File diff viewer** (`DiffViewer.tsx`): Edit tool diffs rendered with green/red line highlighting, collapsible per file. One of the most frequent tool outputs — huge UX improvement.
- **Progress tracker** (`ProgressTracker.tsx`): TodoWrite rendered as persistent checkbox panel, pinned above message stream. Updates in real-time as Claude marks items complete.
- **Search results cards** (`SearchResults.tsx`): WebSearch as cards with title/snippet/link. Grep as file paths with highlighted match lines. Glob as file tree-style list.
- **Destructive action warning**: Permission prompts for `rm`, `reset --hard`, `drop`, `delete` rendered with red highlight border and explicit warning text.

## Subagent Activity Tracking

Better visibility into Claude's Agent/Task tool usage:

- Collapsible task cards in message stream (header: "Agent: {description}" with running/complete indicator)
- Visually nested/indented from the parent conversation
- Subagent status badge ("2 agents running") that updates in real-time
- Future: monitor subagent JSONL files directly for real-time streaming of subagent activity (not just final results)

## Saved Prompts Library

System for creating, storing, and reusing frequently-used prompts:

- **Prompt Library UI** with title, category, preview, fuzzy search (Raycast/Alfred-style)
- **Variable placeholders**: `{{filename}}`, `{{description}}` — form pops up on insert to fill them in
- **Global prompts** in `~/.ccweb/prompts/` + **project prompts** in `{project}/.ccweb/prompts/`
- CRUD API endpoints: `GET/POST/PUT/DELETE /api/prompts`

## Creative UX Explorations

Ideas from design review to explore:

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

## Decision Grid v2 Improvements

- **Keyboard navigation**: Arrow keys between cells, Enter to select, Tab to notes column
- **Comparison mode**: Select two options, see side-by-side with differences highlighted
- **"Explain this option" button**: Per-row button that asks Claude for elaboration without losing context
- **Collapsible file-change groups**: GitHub-style when diffs are numerous

## Performance: Streaming via inotify

Replace 2-second JSONL polling with file-system event monitoring:

- Use `watchdog` or `inotify` to detect JSONL file changes instantly
- Reduces response latency from 2s+ to near-instant
- Status bar already provides 1s feedback, but streaming content would be dramatically better
- Requires careful handling of partial writes (same partial-line logic as current monitor)
