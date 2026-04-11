"""CLI entry point for CCWeb.

Provides three subcommands:
  - ccweb: Start the web server (default)
  - ccweb install: Install SessionStart hook + global Claude commands
  - ccweb hook: Handle SessionStart hook (called by Claude Code)

Key function: main().
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"


def _setup_logging() -> None:
    """Configure logging for the application."""
    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
    )


def _cmd_serve() -> None:
    """Start the CCWeb server."""
    import uvicorn

    from .config import config
    from .server import create_app

    app = create_app()
    uvicorn.run(
        app,
        host=config.web_host,
        port=config.web_port,
        log_level="info",
    )


def _cmd_install() -> None:
    """Install SessionStart hook and global Claude Code commands."""
    # Install hook
    settings_path = Path.home() / ".claude" / "settings.json"
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    settings: dict = {}
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text())
        except json.JSONDecodeError:
            pass

    hooks = settings.setdefault("hooks", {})
    session_start = hooks.setdefault("SessionStart", [])

    # Check if ccweb hook already exists
    already_installed = False
    for entry in session_start:
        for hook in entry.get("hooks", []):
            if "ccweb hook" in hook.get("command", ""):
                already_installed = True
                break

    if not already_installed:
        session_start.append(
            {"hooks": [{"type": "command", "command": "ccweb hook", "timeout": 5}]}
        )
        settings_path.write_text(json.dumps(settings, indent=2))
        print(f"Installed SessionStart hook in {settings_path}")
    else:
        print("SessionStart hook already installed.")

    # Install global commands
    commands_dir = Path.home() / ".claude" / "commands"
    commands_dir.mkdir(parents=True, exist_ok=True)

    commands = {
        "option-grid.md": _OPTION_GRID_COMMAND,
        "checklist.md": _CHECKLIST_COMMAND,
        "status-report.md": _STATUS_REPORT_COMMAND,
        "confirm.md": _CONFIRM_COMMAND,
    }

    for filename, content in commands.items():
        path = commands_dir / filename
        path.write_text(content)
        print(f"Installed command: {path}")

    print("\nCCWeb installation complete!")


def _cmd_hook() -> None:
    """Handle SessionStart hook — write session_map.json."""
    from .core.hook import hook_main

    hook_main()


# ── Global command templates ─────────────────────────────────────────────

_OPTION_GRID_COMMAND = """\
# Option Grid

When called, research the topics provided and output an option grid for the user.

You MUST do these two steps in sequence:

Step 1: Write the grid as a JSON file using your Write tool. Create the directory
first if needed, then write to: {cwd}/.ccweb/pending/grid-{timestamp}.json

Use this schema:
{"id": "unique-id", "type": "ccweb:grid", "title": "...", "items": [
  {"topic": "...", "description": "...", "allow_custom": true,
   "options": [{"label": "...", "recommended": true}, ...]}
]}

Each item must have: topic, description, options (array with recommended flag),
allow_custom: true. Always include 2-4 options per topic with one marked as
recommended.

Step 2: IMMEDIATELY after writing the file, use AskUserQuestion to ask:
"I've prepared an option grid. Please review it in your CCWeb interface and
submit your selections. Your choices will appear here automatically."

This is critical — AskUserQuestion blocks you until the user responds via CCWeb.
Do NOT proceed without waiting. The user's selections will be sent back as text.
"""

_CHECKLIST_COMMAND = """\
# Checklist

When called, output an interactive checklist for the user.

Write the checklist as a JSON file:
  {cwd}/.ccweb/pending/checklist-{timestamp}.json

Schema: {"type": "ccweb:checklist", "title": "...", "items": [
  {"label": "...", "checked": false}, ...
]}

Then IMMEDIATELY use AskUserQuestion to wait for the user's response.
"""

_STATUS_REPORT_COMMAND = """\
# Status Report

When called, output a status dashboard. This is read-only (no user response needed).

Write the report as a JSON file:
  {cwd}/.ccweb/pending/status-{timestamp}.json

Schema: {"type": "ccweb:status", "title": "...", "items": [
  {"label": "...", "status": "pass|fail|warn", "detail": "..."}, ...
]}
"""

_CONFIRM_COMMAND = """\
# Confirm

When called, present a confirmation dialog for a critical action.

Write the dialog as a JSON file:
  {cwd}/.ccweb/pending/confirm-{timestamp}.json

Schema: {"type": "ccweb:confirm", "title": "...",
  "description": "...", "severity": "high|medium|low",
  "actions": [{"label": "...", "value": "..."}, ...]}

Then IMMEDIATELY use AskUserQuestion to wait for the user's response.
"""


def main() -> None:
    """CLI entry point."""
    _setup_logging()

    args = sys.argv[1:]

    if not args:
        _cmd_serve()
    elif args[0] == "install":
        _cmd_install()
    elif args[0] == "hook":
        _cmd_hook()
    else:
        print(f"Unknown command: {args[0]}")
        print("Usage: ccweb [install | hook]")
        sys.exit(1)


if __name__ == "__main__":
    main()
