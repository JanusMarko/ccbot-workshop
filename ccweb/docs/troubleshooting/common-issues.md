---
title: Common Issues
description: FAQ and troubleshooting for CCWeb
order: 1
---

# Common Issues

## "tmux is not running"

Start a tmux session before running CCWeb:

```bash
tmux new -s ccbot
```

## Sessions not appearing

Make sure the SessionStart hook is installed:

```bash
ccweb install
```

Check `~/.claude/settings.json` has a `SessionStart` hook entry pointing to `ccweb hook`.

## WebSocket disconnected

The connection status indicator in the bottom bar shows the current state. CCWeb auto-reconnects with exponential backoff. If it stays disconnected, check that the backend is running.

## No messages appearing

Messages are delivered via JSONL polling (2-second interval). If messages don't appear:

1. Check the session is bound correctly (click it in the sidebar)
2. Check the hook wrote to `~/.ccweb/session_map.json`
3. Check Claude Code is actually running in the tmux window

## File upload fails

Ensure the session has a known working directory (the hook must have fired). The file is saved to `{cwd}/docs/inbox/` in the session's project.
