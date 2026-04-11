---
title: Quick Start
description: Create your first Claude Code session in CCWeb
order: 2
---

# Quick Start

## 1. Create a Session

Click **+ New** in the sidebar, or press **Ctrl+N**. The directory picker opens — browse to your project folder and click **Create Session**.

Claude Code launches in a new tmux window for that directory.

## 2. Send a Message

Type in the message input area at the bottom. Press **Ctrl+Enter** or click **Send** to submit.

Claude's responses appear in the message stream with markdown rendering.

## 3. Use Commands

Type `/` to open the command palette, or click the **/ Commands** button. Built-in commands like `/clear`, `/compact`, `/model` are available, plus any project-specific commands from `.claude/commands/`.

## 4. Interactive Prompts

When Claude asks a question (AskUserQuestion, permission prompts, plan mode), clickable buttons appear instead of terminal navigation. Click to respond.

## 5. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Send message |
| Ctrl+N | New session |
| Ctrl+Up/Down | Command history |
| Esc button | Interrupt Claude |
