---
title: Message Filters
description: Filter the message stream by content type to focus on what matters
order: 5
---

# Message Filters

The filter bar at the top of the message stream lets you control which types of messages are visible. This is useful for focusing on the conversation without tool noise, reviewing what Claude did without the prose, or hiding thinking blocks that clutter the stream.

## Filter Options

Click the filter chips at the top of the message stream. The active filter is highlighted with a blue border.

### All (default)

Shows every message: user text, assistant text, thinking blocks, tool calls, tool results, and local command outputs. This is the complete, unfiltered view.

### Chat

Shows only the human-readable conversation:
- **User messages** — what you typed
- **Assistant text** — Claude's direct responses
- **Local command outputs** — results of `/` commands

Hides: thinking blocks, tool_use summaries, tool_result outputs. This gives you a clean back-and-forth view without the implementation details.

### No Thinking

Shows everything except thinking/reasoning blocks. Useful when Claude's thinking is verbose and you only care about actions and results. Tool calls, tool results, and text are all visible.

### Tools

Shows only tool activity:
- **tool_use** — what Claude called (e.g., "**Read**(src/auth.py)", "**Bash**(npm test)")
- **tool_result** — what came back (line counts, error messages, output)

Hides: user messages, assistant text, thinking. This gives you a log of everything Claude did — useful for understanding what files were read, what commands were run, and what edits were made.

## How It Works

Every message in the stream has a `contentType` field (set when the JSONL is parsed): `text`, `thinking`, `tool_use`, `tool_result`, or `local_command`. The filter is a simple predicate applied to this field in the `filterMessages()` function. No backend communication is needed — filtering happens entirely in the frontend.

## Persistence

Your selected filter is saved to `localStorage` under the key `ccweb_filter`. It persists across page reloads and browser restarts. When you first load CCWeb, it restores your last-used filter.

The filter is global (not per-session) — switching sessions keeps your current filter.

## Message Stream Behavior

When a filter hides messages, those messages are still in memory. Changing the filter instantly shows/hides messages without re-fetching from the backend. This means you can freely toggle between filters to explore the conversation from different angles.

Auto-scroll behavior works with filtered messages — if you're scrolled to the bottom, new visible messages (that pass the filter) will auto-scroll. If you've scrolled up, auto-scroll pauses until you scroll back to the bottom.
