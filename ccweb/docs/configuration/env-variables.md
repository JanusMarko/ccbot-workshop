---
title: Environment Variables
description: Complete reference for all CCWeb configuration variables
order: 1
---

# Environment Variables

CCWeb is configured via environment variables, loaded from `~/.ccweb/.env` or the shell environment. Local `.env` (in the current directory) takes priority.

## Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CCWEB_HOST` | `0.0.0.0` | Bind address for the web server |
| `CCWEB_PORT` | `8765` | Port for the web server |
| `CCWEB_AUTH_TOKEN` | (empty) | Optional bearer token for authentication. Empty = no auth (rely on Tailscale/network security) |

## tmux Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `TMUX_SESSION_NAME` | `ccbot` | Name of the tmux session to manage. All Claude Code windows are created in this session. |
| `CLAUDE_COMMAND` | `claude` | Command to start Claude Code in new windows |

## Claude Code Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `CCWEB_CLAUDE_PROJECTS_PATH` | (auto) | Override path to Claude's projects directory. Default: auto-detected from `CLAUDE_CONFIG_DIR` or `~/.claude/projects` |
| `CLAUDE_CONFIG_DIR` | (none) | If set, CCWeb uses `{CLAUDE_CONFIG_DIR}/projects` for session files |

## Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `MONITOR_POLL_INTERVAL` | `2.0` | Seconds between JSONL file polls. Lower = faster response but more CPU. |

## Directory Browser

| Variable | Default | Description |
|----------|---------|-------------|
| `CCWEB_BROWSE_ROOT` | (home dir) | Starting directory for the session directory browser. Also acts as a containment boundary — browsing is restricted to this directory and its children. |
| `CCWEB_SHOW_HIDDEN_DIRS` | `false` | Show dot-directories (`.git`, `.venv`, etc.) in the browser |

## Memory Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `CCWEB_MEMORY_MONITOR` | `true` | Enable system memory monitoring |
| `CCWEB_MEMORY_WARNING_MB` | `2048` | Per-process memory warning threshold (MB) |
| `CCWEB_MEMORY_CHECK_INTERVAL` | `10` | Seconds between memory checks |
| `CCWEB_MEM_AVAIL_WARN_MB` | `1024` | System MemAvailable warning threshold |
| `CCWEB_MEM_AVAIL_INTERRUPT_MB` | `512` | System MemAvailable interrupt threshold (sends Escape to Claude) |
| `CCWEB_MEM_AVAIL_KILL_MB` | `256` | System MemAvailable kill threshold (kills highest-RSS window) |

## State Directory

| Variable | Default | Description |
|----------|---------|-------------|
| `CCWEB_DIR` | `~/.ccweb` | Override the state directory location |

## Example `.env` File

Create at `~/.ccweb/.env`:

```bash
CCWEB_HOST=0.0.0.0
CCWEB_PORT=8765
TMUX_SESSION_NAME=ccbot
CCWEB_BROWSE_ROOT=/home/user/projects
MONITOR_POLL_INTERVAL=2.0
CCWEB_SHOW_HIDDEN_DIRS=false
```
