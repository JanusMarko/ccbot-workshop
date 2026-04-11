---
title: Full Setup Guide
description: Complete setup from scratch on Windows 11 WSL — tmux, Claude Code, Tailscale, CCWeb
order: 0
---

# Full Setup Guide

This guide takes you from a fresh Windows 11 machine to a fully working CCWeb instance that you can access locally, from another computer on your network, or remotely from your Android phone — all from scratch.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Part 1: WSL Setup](#part-1-wsl-setup)
- [Part 2: Install tmux](#part-2-install-tmux)
- [Part 3: Install Claude Code](#part-3-install-claude-code)
- [Part 4: Install CCWeb](#part-4-install-ccweb)
- [Part 5: Run CCWeb](#part-5-run-ccweb)
- [Part 6: Access Locally](#part-6-access-locally)
- [Part 7: Install Tailscale](#part-7-install-tailscale)
- [Part 8: Access Remotely](#part-8-access-remotely)
- [Part 9: Access from Android](#part-9-access-from-android)
- [Troubleshooting](#troubleshooting)
- [Uninstalling](#uninstalling)
- [Reinstalling / Updating](#reinstalling--updating)

---

## Prerequisites

- Windows 11 (any edition)
- An Anthropic account with Claude Code access
- Internet connection

---

## Part 1: WSL Setup

If you already have WSL with Ubuntu, skip to [Part 2](#part-2-install-tmux).

### Install WSL

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

This installs Ubuntu by default. Restart your computer when prompted.

### First-time WSL setup

After reboot, Ubuntu will open and ask you to create a username and password. Complete that, then update packages:

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Python 3.12+

Ubuntu 24.04 includes Python 3.12. For older versions:

```bash
sudo apt install -y python3.12 python3.12-venv python3-pip
```

### Install Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
python3 --version   # Should be 3.12+
node --version      # Should be 20+
npm --version       # Should be 10+
```

### Install uv (recommended Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

---

## Part 2: Install tmux

```bash
sudo apt install -y tmux
```

Verify:

```bash
tmux -V   # Should show tmux 3.x
```

### Create the CCWeb tmux session

```bash
tmux new -s ccbot
```

You're now inside a tmux session named `ccbot`. This is where Claude Code sessions will run.

**Important tmux commands:**
- `Ctrl+B, D` — detach from tmux (session keeps running in background)
- `tmux attach -t ccbot` — reattach to the session
- `tmux ls` — list running sessions

Detach now with `Ctrl+B, D` — you'll run CCWeb from outside the tmux session.

---

## Part 3: Install Claude Code

### Install the Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### Log in

```bash
claude login
```

Follow the prompts to authenticate with your Anthropic account.

### Verify it works

```bash
claude --version
```

---

## Part 4: Install CCWeb

### Clone or copy the project

If you have CCWeb as a git repo:

```bash
git clone https://github.com/YOUR_USER/ccweb.git
cd ccweb
```

Or if copying from an existing location:

```bash
cp -r /path/to/ccweb ~/ccweb
cd ~/ccweb
```

### Install the Python backend

Modern Ubuntu/WSL protects the system Python and won't let you install packages globally. Use a virtual environment:

```bash
# Create a virtual environment
python3 -m venv ~/.ccweb-venv

# Activate it
source ~/.ccweb-venv/bin/activate

# Install CCWeb
pip install -e .
```

**Make the venv activate automatically** so `ccweb` is always available:

```bash
echo 'source ~/.ccweb-venv/bin/activate' >> ~/.bashrc
```

**Alternative: using uv** (if you installed it in Part 1):

```bash
uv pip install -e .
```

uv handles virtual environments automatically.

### Install the SessionStart hook and global commands

```bash
ccweb install
```

This does two things:
1. Adds the `SessionStart` hook to `~/.claude/settings.json` — this is how CCWeb tracks which Claude Code session is running in which tmux window
2. Installs global slash commands (`/option-grid`, `/checklist`, `/status-report`, `/confirm`) to `~/.claude/commands/`

### Install and build the frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates `frontend/dist/` which the backend serves as static files.

---

## Part 5: Run CCWeb

CCWeb needs two things running: a **tmux session** (where Claude Code windows live) and the **CCWeb server** (the web interface). Here's the step-by-step:

### Step 1: Start tmux

```bash
tmux new -s ccbot
```

You're now inside the tmux session. This is where Claude Code sessions will run.

### Step 2: Start the CCWeb server

Inside tmux, start the server:

```bash
ccweb
```

You should see:

```
INFO:     CCWeb started on 0.0.0.0:8765
INFO:     Uvicorn running on http://0.0.0.0:8765
```

### Step 3: Open in your browser

Open Chrome on Windows and go to:

```
http://localhost:8765
```

WSL automatically forwards ports, so `localhost:8765` reaches the CCWeb server inside WSL. You should see the CCWeb interface with a sidebar and "Select a session or create a new one".

### Step 4: Create your first session

Click **+ New** in the sidebar, browse to a project directory, and click **Create Session**. Claude Code will start in a new tmux window and you can begin chatting.

### tmux window management

The CCWeb server runs in one tmux window. Claude Code sessions each run in their own windows. Useful tmux shortcuts:

| Keys | Action |
|------|--------|
| `Ctrl+B, C` | Create a new tmux window (you won't need this — CCWeb creates them) |
| `Ctrl+B, N` | Next window |
| `Ctrl+B, P` | Previous window |
| `Ctrl+B, 0` | Go to window 0 (where CCWeb server runs) |
| `Ctrl+B, D` | Detach from tmux (everything keeps running in background) |
| `tmux attach -t ccbot` | Reattach to the session later |

### Stopping CCWeb

Press `Ctrl+C` in the tmux window running `ccweb` to stop the server. Your Claude Code sessions keep running in their tmux windows — CCWeb is just the interface.

### Running as a background service (optional)

Create a systemd user service:

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/ccweb.service << 'EOF'
[Unit]
Description=CCWeb Server
After=network.target

[Service]
Type=simple
ExecStart=%h/.local/bin/ccweb
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable ccweb
systemctl --user start ccweb
```

Check status: `systemctl --user status ccweb`

---

## Part 6: Access Locally

### From the same Windows machine

Open Chrome (or any browser) on your Windows machine and go to:

```
http://localhost:8765
```

WSL automatically forwards ports to Windows, so `localhost:8765` reaches the CCWeb server running inside WSL.

### From within WSL

If you need to test from within WSL itself (e.g., with curl):

```bash
curl http://localhost:8765/api/health
```

### Using the frontend dev server (for development)

If you're developing the frontend:

```bash
# Terminal 1: Backend
ccweb

# Terminal 2: Frontend dev server
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser. The Vite dev server proxies API and WebSocket calls to the backend on port 8765.

---

## Part 7: Install Tailscale

Tailscale creates a private network between your devices, so you can access CCWeb from anywhere.

### Install Tailscale on WSL

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Start Tailscale

```bash
sudo tailscale up
```

This will print a URL. Open it in your browser to authenticate with your Tailscale account (create one at [tailscale.com](https://tailscale.com) if you don't have one — it's free for personal use).

### Get your Tailscale IP

```bash
tailscale ip -4
```

This gives you an IP like `100.x.y.z`. This is your machine's address on the Tailscale network.

### Get your Tailscale hostname

```bash
tailscale status
```

Your machine will have a name like `your-machine.tail-net.ts.net`.

### Make Tailscale start automatically

```bash
sudo systemctl enable tailscaled
```

---

## Part 8: Access Remotely

### From another computer on your Tailscale network

1. Install Tailscale on the other computer ([tailscale.com/download](https://tailscale.com/download))
2. Log in with the same Tailscale account
3. Open Chrome and go to:

```
http://100.x.y.z:8765
```

Or using the hostname:

```
http://your-machine:8765
```

### Setting up HTTPS (optional but recommended)

For a secure connection (required for some browser features like notifications):

**Option A: Tailscale Serve (easiest)**

```bash
sudo tailscale serve --bg 8765
```

This gives you HTTPS at `https://your-machine.tail-net.ts.net/` with automatic certificates.

**Option B: Tailscale cert + manual HTTPS**

```bash
sudo tailscale cert your-machine.tail-net.ts.net
```

This creates certificate files. Configure uvicorn to use them:

```bash
# Add to ~/.ccweb/.env
CCWEB_HOST=0.0.0.0
CCWEB_PORT=8765
```

Then run uvicorn with SSL:

```bash
uvicorn ccweb.backend.main:app \
  --host 0.0.0.0 --port 8765 \
  --ssl-keyfile your-machine.tail-net.ts.net.key \
  --ssl-certfile your-machine.tail-net.ts.net.crt
```

---

## Part 9: Access from Android

### Install Tailscale on Android

1. Install the **Tailscale** app from the Google Play Store
2. Log in with the same Tailscale account
3. Enable the VPN connection when prompted

### Open CCWeb in Chrome

Open Chrome on your Android device and navigate to:

```
http://100.x.y.z:8765
```

Or the hostname:

```
http://your-machine:8765
```

If you set up HTTPS via Tailscale Serve:

```
https://your-machine.tail-net.ts.net/
```

### Tablet mode tips (Samsung Z Fold 7)

- The sidebar becomes a slide-out drawer on screens under 1024px
- Tap the hamburger menu (top-left) to open the sidebar
- Swipe right from the left edge to open the sidebar
- Swipe left to close it
- All buttons are 44px minimum for comfortable touch targets

### Add to home screen (optional)

In Chrome, tap the three-dot menu and select **"Add to Home screen"**. This creates an app-like shortcut that opens CCWeb without the browser chrome.

---

## Troubleshooting

### "tmux is not running"

The CCWeb health check shows this when it can't find a tmux session named `ccbot`.

```bash
# Check if tmux is running
tmux ls

# If not, create the session
tmux new -s ccbot -d
```

### "SessionStart hook not installed"

Run `ccweb install` and restart any running Claude Code sessions.

```bash
ccweb install

# Verify the hook exists
cat ~/.claude/settings.json | grep ccweb
```

### Sessions not appearing

Sessions only appear after Claude Code starts and the SessionStart hook fires. This writes to `~/.ccweb/session_map.json`.

1. Check the hook is installed: `cat ~/.claude/settings.json`
2. Check session_map exists: `cat ~/.ccweb/session_map.json`
3. Make sure Claude Code is running in the tmux window (not a bare shell)

### WebSocket won't connect

The browser needs to reach port 8765. Check:

1. Is CCWeb running? `curl http://localhost:8765/api/health`
2. Is the port open? `ss -tlnp | grep 8765`
3. For remote access: is Tailscale connected? `tailscale status`

### "Connection refused" on localhost:8765 from Windows

WSL port forwarding may not be working. Try:

```powershell
# In PowerShell (Windows)
wsl hostname -I
```

Use the IP shown instead of `localhost`.

### Messages not appearing

Messages are delivered via JSONL polling (2-second interval). If messages don't appear:

1. Click the session in the sidebar to rebind
2. Check that `~/.ccweb/session_map.json` has an entry for the window
3. Check the browser console for WebSocket errors (F12 → Console)

### File upload fails

The session needs a known working directory. Wait for the SessionStart hook to fire (a few seconds after Claude Code starts).

### Tailscale can't connect

```bash
# Check Tailscale status
tailscale status

# Restart Tailscale
sudo systemctl restart tailscaled
sudo tailscale up
```

### Browser notifications not working

- Notifications require HTTPS (except on localhost). Set up Tailscale Serve for remote access.
- Check browser notification permissions: Settings → Site Settings → Notifications
- Notifications only fire when the tab is not focused

### "Port 8765 already in use"

Another CCWeb instance is running. Kill it:

```bash
# Find the process
lsof -i :8765

# Kill it
kill <PID>

# Or change the port
echo "CCWEB_PORT=8766" >> ~/.ccweb/.env
```

---

## Uninstalling

### Remove CCWeb

```bash
# Stop the server (if running as a service)
systemctl --user stop ccweb
systemctl --user disable ccweb
rm ~/.config/systemd/user/ccweb.service

# Uninstall the Python package
pip uninstall ccweb

# Remove state files
rm -rf ~/.ccweb

# Remove global commands
rm -f ~/.claude/commands/option-grid.md
rm -f ~/.claude/commands/checklist.md
rm -f ~/.claude/commands/status-report.md
rm -f ~/.claude/commands/confirm.md

# Remove the hook from settings.json
# Edit ~/.claude/settings.json and remove the ccweb hook entry from
# hooks.SessionStart array

# Delete the source code
rm -rf ~/ccweb
```

### Remove Tailscale

```bash
sudo tailscale down
sudo apt remove tailscale
```

### Remove tmux session

```bash
tmux kill-session -t ccbot
```

---

## Reinstalling / Updating

### Updating CCWeb

```bash
cd ~/ccweb
git pull    # or copy new files over

# Reinstall backend
pip install -e .

# Reinstall hook + commands (picks up any new commands)
ccweb install

# Rebuild frontend
cd frontend
npm install
npm run build
cd ..

# Restart server
# If running as a service:
systemctl --user restart ccweb
# If running manually: stop and restart ccweb
```

### Full reinstall

```bash
# Uninstall (see above)
# Then follow the full setup guide from Part 4
```

### Preserving state across reinstall

Your sessions and state are stored in `~/.ccweb/`:
- `state.json` — window bindings and display names
- `session_map.json` — window-to-session mapping (regenerated by hook)
- `monitor_state.json` — byte offsets for JSONL polling

If you want a clean slate, delete `~/.ccweb/`. If you want to preserve your state, leave it in place during reinstall.

Your Claude Code sessions and history are in `~/.claude/projects/` — CCWeb never modifies these, only reads them.
