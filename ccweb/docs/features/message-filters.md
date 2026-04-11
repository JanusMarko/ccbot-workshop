---
title: Message Filters
description: Filter messages by content type
order: 5
---

# Message Filters

The filter bar at the top of the message stream lets you show or hide different types of messages.

## Filter Options

| Filter | What it shows |
|--------|--------------|
| **All** | Everything (default) |
| **Chat** | Only user messages and assistant text — hides tool calls, tool results, and thinking |
| **No Thinking** | Everything except thinking/reasoning blocks |
| **Tools** | Only tool_use and tool_result — see what Claude did without the prose |

## How to Use

Click the filter chips at the top of the message stream. The active filter is highlighted in blue.

## Persistence

Your selected filter is saved to localStorage and persists across page reloads.

## Export Interaction

When you export a conversation (via the Export button in the status bar), the export respects the current filter. If you have "Chat" selected, only chat messages are exported.
