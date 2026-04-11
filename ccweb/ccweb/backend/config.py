"""Application configuration — reads env vars and exposes a singleton.

Loads web server settings, tmux/Claude paths, and monitoring intervals
from environment variables (with .env support).
.env loading priority: local .env (cwd) > $CCWEB_DIR/.env (default ~/.ccweb).

The module-level `config` instance is imported by nearly every other module.
Attribute names match those expected by forked ccbot core modules.

Key class: Config (singleton instantiated as `config`).
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from .core.utils import ccweb_dir

logger = logging.getLogger(__name__)

# Env vars that must not leak to child processes (e.g. Claude Code via tmux)
SENSITIVE_ENV_VARS: set[str] = {"CCWEB_AUTH_TOKEN"}


class Config:
    """Application configuration loaded from environment variables.

    Exposes the same attribute names as ccbot's Config so that forked
    core modules (tmux_manager, session_monitor, etc.) work unchanged.
    """

    def __init__(self) -> None:
        self.config_dir = ccweb_dir()
        self.config_dir.mkdir(parents=True, exist_ok=True)

        # Load .env: local (cwd) takes priority over config_dir
        local_env = Path(".env")
        global_env = self.config_dir / ".env"
        if local_env.is_file():
            load_dotenv(local_env)
            logger.debug("Loaded env from %s", local_env.resolve())
        if global_env.is_file():
            load_dotenv(global_env)
            logger.debug("Loaded env from %s", global_env)

        # --- Web server settings ---
        self.web_host: str = os.getenv("CCWEB_HOST", "0.0.0.0")
        self.web_port: int = int(os.getenv("CCWEB_PORT", "8765"))
        self.web_auth_token: str = os.getenv("CCWEB_AUTH_TOKEN", "")

        # --- Tmux settings (same attr names as ccbot) ---
        self.tmux_session_name: str = os.getenv("TMUX_SESSION_NAME", "ccbot")
        self.tmux_main_window_name: str = "__main__"

        # Claude command to run in new windows
        self.claude_command: str = os.getenv("CLAUDE_COMMAND", "claude")

        # --- State files (all under config_dir) ---
        self.state_file: Path = self.config_dir / "state.json"
        self.session_map_file: Path = self.config_dir / "session_map.json"
        self.monitor_state_file: Path = self.config_dir / "monitor_state.json"

        # --- Claude Code session monitoring ---
        custom_projects_path = os.getenv("CCWEB_CLAUDE_PROJECTS_PATH")
        claude_config_dir = os.getenv("CLAUDE_CONFIG_DIR")

        if custom_projects_path:
            self.claude_projects_path: Path = Path(custom_projects_path)
        elif claude_config_dir:
            self.claude_projects_path = Path(claude_config_dir) / "projects"
        else:
            self.claude_projects_path = Path.home() / ".claude" / "projects"

        self.monitor_poll_interval: float = float(
            os.getenv("MONITOR_POLL_INTERVAL", "2.0")
        )

        # Display user messages in history and real-time notifications
        self.show_user_messages: bool = True

        # Directory browser settings
        self.show_hidden_dirs: bool = (
            os.getenv("CCWEB_SHOW_HIDDEN_DIRS", "").lower() == "true"
        )
        self.browse_root: str = os.getenv("CCWEB_BROWSE_ROOT", "")

        # --- Memory monitoring ---
        self.memory_monitor_enabled: bool = (
            os.getenv("CCWEB_MEMORY_MONITOR", "true").lower() != "false"
        )
        self.memory_warning_mb: float = float(
            os.getenv("CCWEB_MEMORY_WARNING_MB", "2048")
        )
        self.memory_check_interval: float = float(
            os.getenv("CCWEB_MEMORY_CHECK_INTERVAL", "10")
        )
        self.mem_avail_warn_mb: float = float(
            os.getenv("CCWEB_MEM_AVAIL_WARN_MB", "1024")
        )
        self.mem_avail_interrupt_mb: float = float(
            os.getenv("CCWEB_MEM_AVAIL_INTERRUPT_MB", "512")
        )
        self.mem_avail_kill_mb: float = float(
            os.getenv("CCWEB_MEM_AVAIL_KILL_MB", "256")
        )

        # Scrub sensitive vars from os.environ
        for var in SENSITIVE_ENV_VARS:
            os.environ.pop(var, None)

        logger.debug(
            "Config initialized: dir=%s, host=%s, port=%d, "
            "tmux_session=%s, claude_projects_path=%s",
            self.config_dir,
            self.web_host,
            self.web_port,
            self.tmux_session_name,
            self.claude_projects_path,
        )


# Lazy singleton — instantiated on first import. Tests can replace this.
config = Config()
