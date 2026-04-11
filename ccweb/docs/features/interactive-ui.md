---
title: Interactive UI
description: Handling Claude Code prompts — permissions, questions, plan mode
order: 2
---

# Interactive UI

When Claude Code displays an interactive prompt (AskUserQuestion, permission request, plan mode), CCWeb renders it as clickable HTML components instead of requiring terminal keyboard navigation.

## AskUserQuestion

Rendered as clickable option cards. Click an option to select it, then click **Submit**.

## Permission Prompts

Rendered as **Allow** / **Deny** buttons with the action description shown. For bash commands, the command is displayed in a code block.

## Plan Mode (ExitPlanMode)

Rendered as **Proceed** / **Edit Plan** buttons with the plan summary displayed as text.

## Fallback

If CCWeb can't parse the terminal UI into structured data (e.g., a new Claude Code UI format), it falls back to displaying the raw terminal text with generic navigation buttons (Space, Up, Down, Enter, Escape, Tab).

## Stale UI Guard

If you click a button after the prompt has already been dismissed (e.g., Claude timed out), CCWeb detects this and shows "This prompt has expired" instead of sending a blind keystroke.
