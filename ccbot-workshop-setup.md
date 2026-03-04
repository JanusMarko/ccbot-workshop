# CCBot Workshop Setup Guide

Complete setup from a fresh Windows machine to running CCBot with Claude Code sessions accessible via Telegram.

---

## Prerequisites

Before you begin, you'll need:

- Windows 10 (version 2004+) or Windows 11
- A Telegram account
- A Claude Code subscription (Claude Pro/Team/Enterprise)
- Your project repositories cloned into `C:\GitHub\`

---

## Part 1: Install WSL and Ubuntu

Open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

This installs WSL 2 with Ubuntu. Restart your computer when prompted.

After restart, Ubuntu will open automatically and ask you to create a username and password. Remember these — you'll need the password for `sudo` commands.

Once you're at the Ubuntu prompt, update everything:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Part 2: Install Core Tools

### Node.js (required for Claude Code)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node --version
npm --version
```

### Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Add npm global bin to your PATH if not already there:

```bash
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Verify Claude Code works:

```bash
claude --version
```

### tmux

```bash
sudo apt install -y tmux
```

### uv (Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then:

```bash
source ~/.bashrc
```

---

## Part 3: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Follow the prompts to name your bot
4. BotFather gives you a **bot token** — save it (looks like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Get your Telegram user ID

1. Search for **@userinfobot** in Telegram
2. Start a chat with it
3. It replies with your numeric user ID — save it

### Create a Telegram group

1. Create a new group in Telegram
2. Name it something like "Workshop Sessions"
3. Add your bot to the group
4. Go to group settings → **Topics** → Enable topics (use list format)
5. Make the bot an **admin** of the group

---

## Part 4: Install CCBot Workshop

```bash
uv tool install git+https://github.com/JanusMarko/ccbot-workshop.git
```

Verify it installed:

```bash
which ccbot
```

If it's not found, add the path:

```bash
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

### Configure CCBot

Create the config directory and environment file:

```bash
mkdir -p ~/.ccbot
nano ~/.ccbot/.env
```

Paste the following, replacing the placeholder values with your actual token and user ID:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
ALLOWED_USERS=your_telegram_user_id_here
TMUX_SESSION_NAME=ccbot
CLAUDE_COMMAND=claude --dangerously-skip-permissions
CCBOT_BROWSE_ROOT=/mnt/c/GitHub
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

The `CCBOT_BROWSE_ROOT` setting ensures the directory browser always starts from your `C:\GitHub\` folder when creating new sessions.

### Install the Claude Code hook

This lets CCBot track which Claude session runs in which tmux window:

```bash
ccbot hook --install
```

Or manually add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "ccbot hook", "timeout": 5 }]
      }
    ]
  }
}
```

---

## Part 5: Starting CCBot

### First time startup

```bash
tmux new -s ccbot
```

Inside the tmux session:

```bash
ccbot
```

You should see log output confirming the bot started, including your allowed users and Claude projects path.

### Detach from tmux

Press `Ctrl+b`, release, then press `d`. CCBot keeps running in the background. You can close the terminal — it stays alive.

### Start a session from Telegram

1. Open your Telegram group
2. Create a new topic (name it after your project, e.g. "PAIOS")
3. Send a message in the topic
4. CCBot shows a directory browser starting from `C:\GitHub\` — tap your project folder
5. Tap **Select** to confirm
6. A new tmux window is created with Claude Code running in that directory
7. Your message is forwarded to Claude Code

### View sessions in the terminal

```bash
tmux attach -t ccbot
```

Switch between windows using `Ctrl+b` then the window number (shown in the bottom bar). For example:

- `Ctrl+b` then `1` → ccbot process (don't close this)
- `Ctrl+b` then `2` → first Claude Code session
- `Ctrl+b` then `3` → second Claude Code session

Detach again with `Ctrl+b` then `d`.

---

## Part 6: Daily Usage

### Starting CCBot after a reboot

```bash
tmux new -s ccbot || tmux attach -t ccbot
ccbot
```

Then `Ctrl+b` then `d` to detach.

### Useful Telegram commands

Send these in a topic:

- `/screenshot` — see what the terminal looks like right now
- `/history` — browse conversation history
- `/esc` — send Escape key (toggles plan mode, same as Shift+Tab)
- `/cost` — check token usage
- `/kill` — kill the session and delete the topic

### Ending a session

Close or delete the topic in Telegram. The tmux window is automatically killed.

### Multiple projects

Create a new topic for each project. CCBot's design is **1 topic = 1 window = 1 session**. Each topic can run a separate Claude Code session in a different project directory.

### Switching between phone and desktop

From your phone, just use Telegram — all interaction goes through topics.

To switch to your desktop terminal:

```bash
tmux attach -t ccbot
```

Navigate to the right window with `Ctrl+b` then the window number. You're in the same session with full scrollback.

---

## Part 7: Uninstall and Reinstall

Use this after pushing updates to your fork.

### Stop CCBot

```bash
tmux attach -t ccbot
```

Press `Ctrl+C` to stop ccbot. Stay in the tmux session.

### Uninstall the current version

```bash
uv tool uninstall ccbot
```

### Install the updated version

```bash
uv tool install git+https://github.com/JanusMarko/ccbot-workshop.git
```

If you're getting a cached version and not seeing your changes, force a fresh install:

```bash
uv tool install --force git+https://github.com/JanusMarko/ccbot-workshop.git
```

### Verify and restart

```bash
which ccbot
ccbot
```

Then `Ctrl+b` then `d` to detach.

Your `~/.ccbot/.env` configuration and `~/.ccbot/state.json` session state are preserved across reinstalls — you don't need to reconfigure anything.
