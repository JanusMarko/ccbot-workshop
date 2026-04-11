---
title: Sessions
description: Creating, switching, and managing Claude Code sessions
order: 1
---

# Sessions

Each session is a Claude Code instance running in a tmux window, bound to a project directory.

## Creating a Session

1. Click **+ New** in the sidebar or press **Ctrl+N**
2. Browse to your project directory using the file tree
3. Optionally enter a session name
4. Click **Create Session**

The session appears in the sidebar and is auto-selected.

## Switching Sessions

Click any session in the sidebar to switch to it. The message stream loads that session's history.

## Killing a Session

Click the **x** button on a session in the sidebar. This kills the tmux window and the Claude Code process in it.

## Session Status

Sessions show their working directory below the name. The sidebar updates in real-time as sessions are created or killed.

## Health Warnings

If tmux is not running or the SessionStart hook is not installed, warning banners appear at the top of the sidebar with instructions to fix the issue.
