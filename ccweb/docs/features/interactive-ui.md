---
title: Interactive UI
description: How CCWeb handles Claude Code's interactive prompts — permissions, questions, plan mode
order: 2
---

# Interactive UI

When Claude Code needs your input — a permission approval, a question with options, or a plan mode confirmation — it displays an interactive prompt in the terminal. CCWeb detects these prompts and renders them as clickable HTML components instead of requiring terminal keyboard navigation.

## How Detection Works

Every second, the backend captures the terminal screen of each active session using `tmux capture-pane`. The captured text is passed through `terminal_parser.py`, which uses regex patterns to detect known Claude Code UI formats:

1. **Top delimiter** — a regex matches the first line of the UI (e.g., "Do you want to proceed?", "☐ Option A")
2. **Bottom delimiter** — a regex matches the last line (e.g., "Esc to cancel", "Enter to select")
3. **Content extraction** — everything between the delimiters is extracted as the UI content

The raw content is then passed to `ui_parser.py`, which attempts to parse it into structured data (option labels, checked/unchecked states, action descriptions). If parsing succeeds, structured data is sent alongside the raw text. If parsing fails, only the raw text is sent — the frontend falls back to generic navigation.

### Deduplication

The same interactive UI content is not re-sent every second. The backend tracks the last content sent per client/window pair and skips sending if it hasn't changed. When the UI disappears (Claude processed the input), the dedup cache is cleared.

## Supported UI Types

### AskUserQuestion

Claude Code asks a question with selectable options (checkboxes). CCWeb renders each option as a clickable card button.

**Terminal appearance:**
```
☐ Option A
✔ Option B (pre-selected)
☐ Option C
Enter to select
```

**CCWeb rendering:** Clickable cards for each option (checked state shown), with a Submit button at the bottom. Click an option to toggle it, then click Submit (sends Enter to tmux).

### ExitPlanMode

Claude has written a plan and asks if you want to proceed. CCWeb renders two buttons.

**Terminal appearance:**
```
Would you like to proceed?
  ctrl-g to edit in editor
  Esc to cancel
```

**CCWeb rendering:** Plan text displayed as readable content, with **Proceed** (sends Enter) and **Edit Plan** (sends Escape) buttons.

### PermissionPrompt

Claude asks permission for an action (file creation, deletion, etc.).

**Terminal appearance:**
```
Do you want to proceed?
  ❯ 1. Yes, allow once
    2. Yes, always allow
    3. No, deny
  Esc to cancel
```

**CCWeb rendering:** Action description displayed, with **Allow** (sends Enter) and **Deny** (sends Escape) buttons. If numbered choices are detected, each is shown as a separate button.

### BashApproval

Claude wants to run a bash command that requires approval.

**Terminal appearance:**
```
Bash command
  rm -rf /tmp/build
  Esc to cancel
```

**CCWeb rendering:** The command displayed in a code block (with red border for visibility), with **Allow** and **Deny** buttons.

### RestoreCheckpoint

Claude offers to restore a previous checkpoint.

**CCWeb rendering:** Each checkpoint option as a clickable card. Falls back to generic navigation if the options can't be parsed.

## Fallback Mode

When `ui_parser.py` can't parse the terminal text into structured data (unknown format, changed UI layout, etc.), the frontend displays:

1. The raw terminal text in a `<pre>` block
2. A grid of generic navigation buttons: Space, Up, Down, Left, Right, Tab, Escape, Enter

This ensures every interactive prompt is usable even if the parser doesn't recognize it.

## Stale UI Guard

There's a time gap between when the frontend displays an interactive prompt and when the user clicks a button. During this gap, the prompt might have already been dismissed (Claude timed out, another client responded, etc.).

To prevent blind key injection into whatever Claude is now showing, the backend re-captures the terminal before sending any key (except Escape, which is always allowed as the interrupt key). If the interactive UI is no longer showing, the backend rejects the key with a `stale_ui` error and the frontend shows "This prompt has expired."

## Fragility Warning

Interactive UI detection is fundamentally screen-scraping — it parses text from a terminal. If Anthropic changes Claude Code's terminal UI format (different checkbox characters, different delimiter text, new prompt types), the parsers may break.

CCWeb mitigates this with:
- The raw text fallback (always works regardless of parser changes)
- Defensive parsing (returns None on failure rather than crashing)
- Pattern definitions centralized in `terminal_parser.py` (easy to update)

If you encounter a prompt that CCWeb doesn't render correctly, the raw text + navigation buttons will still let you interact with it.
