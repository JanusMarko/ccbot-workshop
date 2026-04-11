---
title: Option Grid
description: Decision grids for batch choices with notes
order: 3
---

# Option Grid

The option grid lets you make multiple decisions at once through an interactive HTML interface, instead of answering Claude one question at a time.

## How It Works

1. A Claude Code skill (like `/option-grid`) researches topics and writes a JSON file to `.ccweb/pending/`
2. The skill then calls `AskUserQuestion` to block Claude while you review
3. CCWeb detects the file and renders it as an interactive card grid
4. You select options, add notes, and click **Submit All**
5. Your selections are formatted as text and sent to Claude via tmux
6. Claude receives your answers and continues

## Using the Grid

Each row in the grid shows:
- **Topic** — what the decision is about
- **Description** — context and details
- **Options** — clickable buttons (recommended option pre-selected with a star)
- **Notes** — text input where you can add context, provide a custom option, or ask for more info

Click an option to select it. The recommended option is highlighted but you can change it. Type in the notes field to add additional context.

Click **Submit All** at the bottom to send all your selections to Claude at once.

## The `/option-grid` Skill

Available after running `ccweb install`. Usage in Claude Code:

```
/option-grid [description of what needs decisions]
```

The skill writes a JSON file and blocks with AskUserQuestion. Your selections are sent back as formatted text.

## Grid JSON Format

Skills write to `{project}/.ccweb/pending/grid-{timestamp}.json`:

```json
{
  "id": "unique-id",
  "type": "ccweb:grid",
  "title": "Code Review Decisions",
  "items": [
    {
      "topic": "Auth module refactor",
      "description": "The auth module uses deprecated bcrypt API...",
      "options": [
        {"label": "Update to bcrypt v4 API", "recommended": true},
        {"label": "Switch to argon2", "recommended": false}
      ],
      "allow_custom": true
    }
  ]
}
```

## Other Interaction Types

CCWeb also supports:
- `/checklist` — interactive checkbox list
- `/status-report` — read-only status dashboard (pass/fail/warn)
- `/confirm` — confirmation dialog for critical actions

All use the same file-based mechanism in `.ccweb/pending/`.
