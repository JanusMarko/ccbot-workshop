---
title: Export
description: Exporting conversations as Markdown, JSON, or plain text
order: 8
---

# Export

Export your Claude Code conversation for sharing, archiving, or analysis.

## How to Export

Click the **Export** button in the status bar at the bottom of the screen. The conversation downloads as a Markdown file.

## Export Formats

The backend supports three formats via the `fmt` query parameter:

| Format | Description |
|--------|-------------|
| **Markdown** (default) | Formatted with headers, code blocks, thinking in `<details>` tags |
| **JSON** | Raw message data as JSON array |
| **Plain text** | Stripped of all formatting |

## What's Included

- All user messages (prefixed with `## You`)
- All assistant text responses
- Thinking blocks (in collapsible `<details>` tags)
- Tool calls and results (in code blocks)

## Filter Interaction

The export respects your current message filter. If you have "Chat" selected, only user messages and assistant text are exported — tool calls and thinking are excluded.

## File Naming

The downloaded file is named `{session-name}.md` (or `.json` / `.txt` depending on format).
