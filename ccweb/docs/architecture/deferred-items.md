---
title: Deferred Items
description: Complete grid of all deferred features with effort, usefulness, and success estimates
order: 3
---

# Deferred Items Grid

All features deferred from v1, with estimates for prioritization.

## A. Rich Tool Output Rendering

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 1 | **File diff viewer** — green/red highlighting, collapsible per file | Medium (2-3 days) | **Very High** — most frequent tool output, massive UX win | 95% | Requires custom diff parser component; `<pre>` blocks work for v1 |
| 2 | **Progress tracker** — TodoWrite as persistent checkbox panel | Medium (1-2 days) | Medium — nice visibility but TodoWrite is used inconsistently | 90% | Needs new pinned panel UI pattern; low priority vs core features |
| 3 | **Search results cards** — Grep/WebSearch as structured cards | Medium (2 days) | Medium — improves readability of search results | 85% | Requires parsing multiple tool output formats into structured data |
| 4 | **Destructive action warning** — red-bordered permission prompts | Small (0.5 days) | Medium — safety UX improvement | 98% | Simple keyword detection; deferred because base permission UI works |

## B. Subagent Tracking

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 5 | **Collapsible task cards** — nested agent activity in message stream | Medium (2 days) | High — critical for multi-agent workflows | 90% | Requires indentation/nesting model in message stream; tool_use/result pairing already works flat |
| 6 | **Subagent status badge** — "2 agents running" indicator | Small (0.5 days) | Medium — quick glance at agent activity | 95% | Depends on #5 for real value |
| 7 | **Real-time subagent JSONL streaming** — monitor subagent session files | Large (3-5 days) | High — see what agents are doing live, not just final results | 60% | Requires discovering subagent session IDs from parent JSONL, monitoring multiple files dynamically; Claude Code's subagent format may change |

## C. Saved Prompts Library

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 8 | **Prompt Library UI** — fuzzy search, categories, preview | Medium (2-3 days) | High — eliminates copy/paste for repeated prompts | 90% | Full CRUD UI + backend; deferred because command palette covers slash commands |
| 9 | **Variable placeholders** — `{{filename}}` with fill-in form | Medium (1-2 days) | Medium — power-user feature | 80% | Template parsing + dynamic form generation; nice but not essential |
| 10 | **Global + project prompts** — `~/.ccweb/prompts/` + `{project}/.ccweb/prompts/` | Small (1 day) | Medium — organization for prompt collections | 95% | File-based storage is simple; deferred because the library UI (#8) is needed first |

## D. Decision Grid v2

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 11 | **Keyboard navigation** — arrow keys between cells, Tab to notes | Small (1 day) | Medium — power-user speed improvement | 95% | Focus management in a grid is fiddly; mouse works fine for v1 |
| 12 | **Comparison mode** — side-by-side option comparison | Medium (2 days) | Low — rarely need to compare options in detail | 75% | Niche use case; the description field usually provides enough context |
| 13 | **"Explain this option" button** — ask Claude for elaboration per row | Medium (1-2 days) | Medium — reduces back-and-forth | 70% | Requires sending text to Claude while grid is open, handling the response asynchronously; timing is tricky with AskUserQuestion blocking |

## E. Performance

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 14 | **inotify/watchdog streaming** — replace 2s JSONL polling | Medium (2-3 days) | **Very High** — near-instant responses instead of 2s bursts | 80% | Requires `watchdog` dependency, careful partial-write handling, and testing on WSL (inotify can be unreliable on WSL2 filesystem mounts) |

## F. Creative UX Explorations

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 15 | **Optimistic input** — show user message immediately with pending indicator | Small (0.5 days) | High — feels much more responsive | 95% | Simple state addition; deferred because it's pure polish |
| 16 | **Message threading** — nest Q&A exchanges (Slack-style) | Large (3-5 days) | Medium — helps in long sessions but changes the core message model | 50% | Fundamental change to message stream rendering; unclear how to detect thread boundaries in Claude's output |
| 17 | **Session timeline scrubber** — minimap of session phases | Large (3-4 days) | Medium — novel visualization | 60% | Requires phase detection heuristics (thinking vs tool use vs conversation); complex custom UI |
| 18 | **Live file preview pane** — split view showing file state after Edit | Large (3-5 days) | High — see what the file looks like now, not just the diff | 65% | Requires reading files from the project directory via a new API; security implications of serving arbitrary file content |
| 19 | **Pinned messages** — pin key decisions to session top | Medium (1-2 days) | Medium — useful for long sessions | 85% | Needs persistent pin state (per-session localStorage or backend); simple UI but needs thought on what "pinning" means |
| 20 | **Session heatmap** — activity timeline + token spend per session | Medium (2 days) | Low — analytics/insight feature | 70% | Requires tracking activity timestamps and token data that may not be in JSONL |
| 21 | **Quick reactions on tool results** — thumbs-up/flag | Small (1 day) | Low — feedback signal with no immediate use | 80% | Needs storage for reactions; unclear what value they provide without a feedback loop |
| 22 | **Minimap** — VS Code-style vertical scroll overview | Large (3-4 days) | Low-Medium — scroll orientation aid | 50% | Complex canvas/SVG rendering; high effort for modest value |
| 23 | **Keyboard-first navigation** — Linear-style G+S, G+P shortcuts | Small (1 day) | Medium — power-user productivity | 90% | Simple key handler additions; deferred because mouse/touch works |
| 24 | **Stackable message filters** — combine filters (chat + tools) | Small (0.5 days) | Medium — more granular filtering | 95% | Change filter from single enum to bitfield; simple but the current 4 presets cover most needs |

## G. UI Polish

| # | Item | Effort | Usefulness | Success | Reason Deferred |
|---|------|--------|------------|---------|-----------------|
| 25 | **Dark/light theme toggle** | Medium (1-2 days) | Medium — accessibility and preference | 90% | CSS variable swap; needs a second set of color values and a preferences persistence mechanism |
| 26 | **Notification badges on sessions** — unread indicator | Small (1 day) | High — know which sessions have new activity | 90% | Track last-read offset per session in frontend; show badge when messages arrive for non-active session |
| 27 | **Per-project setup banner** — "Enable CCWeb features?" on first session | Small (0.5 days) | Low — one-time convenience | 95% | Check for `.ccweb/instructions.md` existence; show dismissable banner |

## Top 5 by Impact/Effort Ratio

If picking what to build next:

1. **#15 Optimistic input** — 0.5 days, high usefulness, 95% success
2. **#26 Notification badges** — 1 day, high usefulness, 90% success
3. **#4 Destructive action warning** — 0.5 days, medium usefulness, 98% success
4. **#1 File diff viewer** — 2-3 days, very high usefulness, 95% success
5. **#14 inotify streaming** — 2-3 days, very high usefulness, 80% success (WSL risk)
