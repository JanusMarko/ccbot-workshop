---
title: Commands
description: Slash command palette and skill discovery
order: 4
---

# Commands

CCWeb provides a command palette for quickly accessing Claude Code's built-in slash commands and project-specific skills.

## Opening the Command Palette

Three ways to open it:

1. **Type `/`** at the start of a line in the message input — the palette appears above the input
2. **Click the `/ Commands` button** in the toolbar
3. **Press `Ctrl+K`** anywhere in the app

## Using the Palette

- Type to filter commands by name
- Use **arrow keys** to navigate, **Enter** to select
- Press **Escape** to close
- Click a command to select it

## Built-in Commands

These Claude Code commands are always available:

| Command | Description |
|---------|-------------|
| `/clear` | Clear conversation history |
| `/compact` | Compact conversation context |
| `/cost` | Show token/cost usage |
| `/model` | Switch AI model |
| `/fast` | Toggle fast mode |
| `/plan` | Enter plan mode |
| `/help` | Show Claude Code help |
| `/memory` | Edit CLAUDE.md |
| `/config` | Open settings |
| `/doctor` | Run diagnostics |
| `/review` | Review code changes |

## Project Commands

Commands from `.claude/commands/` in the session's project directory are automatically discovered and shown in the palette under "Project Commands". These refresh when you switch sessions.

To create a project command, add a `.md` file to `{project}/.claude/commands/`:

```markdown
# My Command

Instructions for Claude when this command is invoked...
```

The first line of the file (after the `#` header) is used as the description in the palette.

## CCWeb Global Commands

Installed by `ccweb install` to `~/.claude/commands/`:

- `/option-grid` — create an interactive decision grid
- `/checklist` — create an interactive checklist
- `/status-report` — create a status dashboard
- `/confirm` — create a confirmation dialog
