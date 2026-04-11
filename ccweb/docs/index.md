---
title: CCWeb Documentation
description: React web gateway to Claude Code sessions via tmux
order: 0
---

# CCWeb Documentation

Welcome to CCWeb — a browser-based interface for Claude Code sessions running in tmux.

**New here?** Start with [What is CCWeb](overview.md) for a conceptual overview, or jump to the [Full Setup Guide](getting-started/full-setup-guide.md) to get running.

## Getting Started

- [What is CCWeb](overview.md) — what it is, why it exists, how the pieces fit together
- [Full Setup Guide](getting-started/full-setup-guide.md) — complete from-scratch setup: WSL, tmux, Claude Code, Tailscale, Android access, troubleshooting, uninstall
- [Installation](getting-started/installation.md) — quick prerequisites and install steps
- [Quick Start](getting-started/quickstart.md) — create your first session in 5 minutes

## Features

- [Sessions](features/sessions.md) — creating, switching, renaming, killing sessions; how session tracking works
- [Interactive UI](features/interactive-ui.md) — how CCWeb detects and renders AskUserQuestion, permissions, plan mode; the stale UI guard; fallback mode
- [Option Grid](features/option-grid.md) — decision grids for batch choices; the file-based protocol; JSON schema; AskUserQuestion blocking
- [Commands](features/commands.md) — slash command palette, auto-complete, built-in vs project commands, skill discovery
- [Message Filters](features/message-filters.md) — All/Chat/No Thinking/Tools; how filtering works; persistence
- [File Upload](features/file-upload.md) — uploading files for Claude to analyze; supported types; security
- [Wiki](features/wiki.md) — in-app documentation; search; writing docs; how the backend serves them
- [Export](features/export.md) — downloading conversations as Markdown, JSON, or plain text

## Configuration

- [Environment Variables](configuration/env-variables.md) — complete reference for all 16 config variables

## Architecture

- [Architecture Overview](architecture/overview.md) — system diagram, data flows (4 detailed flows), component details, WebSocket protocol summary
- [Protocol Reference](architecture/protocol.md) — complete WebSocket and REST API specification with examples
- [Design Plan](architecture/design-plan.md) — original design plan with all decisions and rationale
- [V2 Roadmap](architecture/v2-roadmap.md) — deferred features by category
- [Deferred Items Grid](architecture/deferred-items.md) — prioritized grid of 27 deferred items with effort/usefulness estimates
- [Session History](architecture/session-history.md) — build session history, review process, what a new developer needs to know

## Troubleshooting

- [Common Issues](troubleshooting/common-issues.md) — FAQ: sessions not appearing, WebSocket issues, messages missing, etc.
- The [Full Setup Guide](getting-started/full-setup-guide.md#troubleshooting) also has a dedicated troubleshooting section covering 12 specific scenarios
