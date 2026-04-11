---
title: Installation
description: Prerequisites and setup instructions for CCWeb
order: 1
---

# Installation

## Prerequisites

- Python 3.12+
- Node.js 20+
- tmux
- Claude Code CLI installed and configured

## Install CCWeb

```bash
cd ccweb
pip install -e .
```

## Install Hook & Commands

```bash
ccweb install
```

This installs:
- The `SessionStart` hook in `~/.claude/settings.json`
- Global slash commands (`/option-grid`, `/checklist`, `/status-report`, `/confirm`) in `~/.claude/commands/`

## Configure

Create `~/.ccweb/.env` with your settings:

```bash
CCWEB_HOST=0.0.0.0
CCWEB_PORT=8765
TMUX_SESSION_NAME=ccbot
```

See [Environment Variables](../configuration/env-variables.md) for the full reference.

## Start

```bash
# Start tmux session first
tmux new -s ccbot

# In another terminal, start CCWeb
ccweb
```

Open your browser to `http://localhost:8765`.
