---
title: Installation
description: Quick install steps for CCWeb
order: 1
---

# Installation

Quick install for those who already have WSL, tmux, and Claude Code set up. For a complete from-scratch guide, see the [Full Setup Guide](full-setup-guide.md).

## Prerequisites

- Python 3.12+
- Node.js 20+
- tmux
- Claude Code CLI installed and configured

## Install CCWeb

```bash
cd ccweb

# Create a virtual environment (required on modern Ubuntu/WSL)
python3 -m venv ~/.ccweb-venv
source ~/.ccweb-venv/bin/activate

# Install
pip install -e .

# Make the venv auto-activate on login
echo 'source ~/.ccweb-venv/bin/activate' >> ~/.bashrc
```

## Install Hook & Commands

```bash
ccweb install
```

This installs:
- The `SessionStart` hook in `~/.claude/settings.json`
- Global slash commands (`/option-grid`, `/checklist`, `/status-report`, `/confirm`) in `~/.claude/commands/`

## Build the Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

## Configure (optional)

Create `~/.ccweb/.env` with your settings:

```bash
CCWEB_HOST=0.0.0.0
CCWEB_PORT=8765
TMUX_SESSION_NAME=ccbot
```

See [Environment Variables](../configuration/env-variables.md) for the full reference.

## Run

```bash
# Start tmux
tmux new -s ccbot

# Inside tmux, start CCWeb
ccweb
```

Open Chrome to `http://localhost:8765`.
