---
title: Export
description: Exporting conversations as Markdown, JSON, or plain text
order: 8
---

# Export

Export your Claude Code conversation for sharing, archiving, or analysis. The export captures the full message history from the session's JSONL file, parsed and formatted for the requested output format.

## How to Export

Click the **Export** button in the status bar at the bottom of the screen. The conversation downloads as a Markdown file.

The export endpoint is also available via REST API for automation:

```
GET /api/sessions/{window_id}/export?fmt=markdown
GET /api/sessions/{window_id}/export?fmt=json
GET /api/sessions/{window_id}/export?fmt=plain
```

## Export Formats

### Markdown (default)

The conversation is formatted as a readable Markdown document:
- **Session name** as the top-level heading
- **User messages** as `## You` sections
- **Assistant text** as regular paragraphs
- **Thinking blocks** wrapped in `<details><summary>Thinking</summary>` tags (collapsible in Markdown renderers like GitHub)
- **Tool calls and results** in fenced code blocks

This format is ideal for sharing on GitHub, pasting into documents, or reviewing later.

### JSON

Raw message data as a JSON array. Each message includes:
- `role` — "user" or "assistant"
- `text` — the message content
- `content_type` — "text", "thinking", "tool_use", "tool_result", or "local_command"
- `timestamp` — ISO timestamp (may be null for some entries)

This format is ideal for programmatic analysis or importing into other tools.

### Plain Text

Same structure as Markdown but with all formatting stripped. Code blocks are preserved but Markdown syntax (headers, bold, etc.) is retained as-is since it reads naturally in plain text.

## What's Included

The export contains every message from the session's JSONL file, parsed through the same `TranscriptParser` used for the message stream:
- All user messages
- All assistant text responses
- Thinking/reasoning blocks
- Tool call summaries (e.g., "**Read**(file.py)")
- Tool results with stats (e.g., "Read 42 lines")
- Local command outputs (e.g., `/clear`, `/cost` results)

## What's NOT Included

- **Images** — base64-encoded images from tool results are not included in exports
- **Interactive UI state** — AskUserQuestion prompts, permission responses, etc. appear as their tool_use/tool_result summaries, not as the interactive widgets
- **Status messages** — spinner text and working indicators are ephemeral and not part of the JSONL

## File Naming

The downloaded file is named `{session-display-name}.md` (or `.json` / `.txt`). The display name is the session's name as shown in the sidebar.

## Relationship to Filters

The export endpoint returns ALL messages regardless of the current filter setting. The filter only affects what's visible in the message stream UI, not what's exported. This is intentional — exports should be complete for archival purposes.
