"""Structured UI parser — converts raw terminal text to interactive data.

terminal_parser.py detects interactive UIs and returns raw text content.
This module takes that raw text and attempts to parse it into structured
data (option labels, action descriptions, etc.) that the React frontend
can render as clickable components.

Parsing is fragile screen-scraping of Claude Code's terminal UI. The
parser is defensive: if parsing fails, it returns None and the frontend
falls back to displaying raw text with generic navigation buttons.

Key function: parse_interactive_ui().
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ParsedOption:
    """A single option in an interactive UI."""

    label: str
    checked: bool = False
    index: int = 0


@dataclass
class ParsedInteractiveUI:
    """Structured data extracted from an interactive terminal UI."""

    ui_name: str
    options: list[ParsedOption] = field(default_factory=list)
    description: str = ""
    command: str = ""  # For BashApproval

    def to_dict(self) -> dict[str, Any]:
        return {
            "ui_name": self.ui_name,
            "options": [
                {"label": o.label, "checked": o.checked, "index": o.index}
                for o in self.options
            ],
            "description": self.description,
            "command": self.command,
        }


# Checkbox markers used by Claude Code's AskUserQuestion UI
_RE_CHECKBOX = re.compile(r"^\s*(?:←\s+)?([☐✔☒])\s+(.+)$")

# Permission prompt action line
_RE_PERMISSION_ACTION = re.compile(
    r"^\s*Do you want to (proceed|make this edit|create|delete)\b"
)

# Numbered choice (e.g., "❯ 1. Yes, allow once")
_RE_NUMBERED_CHOICE = re.compile(r"^\s*[❯ ]\s*(\d+)\.\s+(.+)$")

# Bash command line
_RE_BASH_COMMAND = re.compile(r"^\s*(.+)$")


def parse_interactive_ui(
    raw_content: str,
    ui_name: str,
) -> ParsedInteractiveUI | None:
    """Parse raw terminal text into structured interactive UI data.

    Args:
        raw_content: The raw text content from terminal_parser
        ui_name: The UI type name ("AskUserQuestion", "PermissionPrompt", etc.)

    Returns:
        Parsed structure or None if parsing fails (frontend uses raw text fallback)
    """
    if not raw_content or not ui_name:
        return None

    lines = raw_content.strip().split("\n")

    if ui_name == "AskUserQuestion":
        return _parse_ask_user_question(lines)
    if ui_name == "ExitPlanMode":
        return _parse_exit_plan_mode(lines)
    if ui_name in ("PermissionPrompt", "BashApproval"):
        return _parse_permission_prompt(lines, ui_name)
    if ui_name == "RestoreCheckpoint":
        return _parse_restore_checkpoint(lines)

    return None


def _parse_ask_user_question(lines: list[str]) -> ParsedInteractiveUI | None:
    """Parse AskUserQuestion: extract checkbox options."""
    options: list[ParsedOption] = []
    idx = 0
    for line in lines:
        match = _RE_CHECKBOX.match(line)
        if match:
            marker = match.group(1)
            label = match.group(2).strip()
            checked = marker in ("✔", "☒")
            options.append(ParsedOption(label=label, checked=checked, index=idx))
            idx += 1

    if not options:
        return None

    return ParsedInteractiveUI(ui_name="AskUserQuestion", options=options)


def _parse_exit_plan_mode(lines: list[str]) -> ParsedInteractiveUI | None:
    """Parse ExitPlanMode: extract proceed/edit options."""
    description_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if (
            stripped
            and not stripped.startswith("ctrl-g")
            and not stripped.startswith("Esc")
        ):
            description_lines.append(stripped)

    return ParsedInteractiveUI(
        ui_name="ExitPlanMode",
        description="\n".join(description_lines),
        options=[
            ParsedOption(label="Proceed", index=0),
            ParsedOption(label="Edit Plan", index=1),
        ],
    )


def _parse_permission_prompt(
    lines: list[str], ui_name: str
) -> ParsedInteractiveUI | None:
    """Parse PermissionPrompt or BashApproval."""
    description_lines: list[str] = []
    command = ""
    options: list[ParsedOption] = []
    idx = 0

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check for numbered choices
        num_match = _RE_NUMBERED_CHOICE.match(line)
        if num_match:
            label = num_match.group(2).strip()
            options.append(ParsedOption(label=label, index=idx))
            idx += 1
            continue

        # Skip footer lines
        if stripped.startswith("Esc to"):
            continue

        description_lines.append(stripped)

    description = "\n".join(description_lines)

    # If no numbered choices found, provide default Allow/Deny
    if not options:
        options = [
            ParsedOption(label="Allow", index=0),
            ParsedOption(label="Deny", index=1),
        ]

    # For BashApproval, try to extract the command
    if ui_name == "BashApproval" and len(description_lines) > 1:
        # The command is typically the line after "Bash command"
        for i, line in enumerate(description_lines):
            if "bash command" in line.lower() or "requires approval" in line.lower():
                if i + 1 < len(description_lines):
                    command = description_lines[i + 1]
                break

    return ParsedInteractiveUI(
        ui_name=ui_name,
        description=description,
        options=options,
        command=command,
    )


def _parse_restore_checkpoint(lines: list[str]) -> ParsedInteractiveUI | None:
    """Parse RestoreCheckpoint: extract checkpoint options."""
    options: list[ParsedOption] = []
    idx = 0
    for line in lines:
        stripped = line.strip()
        if (
            not stripped
            or stripped.startswith("Enter to")
            or stripped.startswith("Esc")
        ):
            continue
        options.append(ParsedOption(label=stripped, index=idx))
        idx += 1

    if not options:
        return None

    return ParsedInteractiveUI(
        ui_name="RestoreCheckpoint",
        options=options,
    )
