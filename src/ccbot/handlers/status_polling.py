"""Terminal status line polling for thread-bound windows.

Provides background polling of terminal status lines for all active users:
  - Detects Claude Code status (working, waiting, etc.)
  - Detects interactive UIs (permission prompts) not triggered via JSONL
  - Updates status messages in Telegram
  - Polls thread_bindings (each topic = one window)
  - Periodically probes topic existence via send_chat_action (TYPING);
    raises BadRequest on deleted topics; cleans up deleted topics (kills
    tmux window + unbinds thread)
  - Proactive OOM prevention: system-wide MemAvailable monitoring with
    escalating actions (warn → interrupt → kill highest-RSS window)

Key components:
  - STATUS_POLL_INTERVAL: Polling frequency (1 second)
  - TOPIC_CHECK_INTERVAL: Topic existence probe frequency (60 seconds)
  - status_poll_loop: Background polling task
  - update_status_message: Poll and enqueue status updates
  - _check_system_memory: Escalating system memory pressure response
"""

import asyncio
import logging
import time

from telegram import Bot
from telegram.constants import ChatAction
from telegram.error import BadRequest

from ..config import config
from ..process_info import (
    get_mem_available_mb,
    get_process_tree_pids,
    get_tree_rss_mb,
    was_pid_oom_killed,
)
from ..session import session_manager
from ..terminal_parser import is_interactive_ui, parse_status_line
from ..tmux_manager import tmux_manager
from .interactive_ui import (
    clear_interactive_msg,
    get_interactive_msg_id,
    get_interactive_window,
    handle_interactive_ui,
)
from .cleanup import clear_topic_state
from .message_queue import enqueue_status_update, get_message_queue
from .message_sender import safe_send

logger = logging.getLogger(__name__)

# Track pane PIDs so we can check OOM after window death
_window_pids: dict[str, int] = {}  # window_id → shell PID

# Per-window memory monitoring state
_last_memory_check: float = 0.0
_memory_warned: set[str] = set()  # window_ids that have been warned

# System-wide memory pressure escalation state
# Levels: 0=ok, 1=warned, 2=interrupted, 3=killed
_sys_mem_level: int = 0
_sys_mem_cycles_at_level: int = 0  # how many check cycles at current level
_last_sys_mem_check: float = 0.0

# Status polling interval
STATUS_POLL_INTERVAL = 1.0  # seconds - faster response (rate limiting at send layer)

# Topic existence probe interval
TOPIC_CHECK_INTERVAL = 60.0  # seconds


async def update_status_message(
    bot: Bot,
    user_id: int,
    window_id: str,
    thread_id: int | None = None,
    skip_status: bool = False,
) -> None:
    """Poll terminal and check for interactive UIs and status updates.

    UI detection always happens regardless of skip_status. When skip_status=True,
    only UI detection runs (used when message queue is non-empty to avoid
    flooding the queue with status updates).

    Also detects permission prompt UIs (not triggered via JSONL) and enters
    interactive mode when found.
    """
    w = await tmux_manager.find_window_by_id(window_id)
    if not w:
        # Window gone, enqueue clear (unless skipping status)
        if not skip_status:
            await enqueue_status_update(
                bot, user_id, window_id, None, thread_id=thread_id
            )
        return

    pane_text = await tmux_manager.capture_pane(w.window_id)
    if not pane_text:
        # Transient capture failure - keep existing status message
        return

    interactive_window = get_interactive_window(user_id, thread_id)
    should_check_new_ui = True

    if interactive_window == window_id:
        # User is in interactive mode for THIS window
        if is_interactive_ui(pane_text):
            # Interactive UI still showing — skip status update (user is interacting)
            return
        # Interactive UI gone — clear interactive mode, fall through to status check.
        # Don't re-check for new UI this cycle (the old one just disappeared).
        await clear_interactive_msg(user_id, bot, thread_id)
        should_check_new_ui = False
    elif interactive_window is not None:
        # User is in interactive mode for a DIFFERENT window (window switched)
        # Clear stale interactive mode
        await clear_interactive_msg(user_id, bot, thread_id)

    # Check for permission prompt (interactive UI not triggered via JSONL)
    # ALWAYS check UI, regardless of skip_status
    if should_check_new_ui and is_interactive_ui(pane_text):
        # Skip if another path (e.g. JSONL monitor) already sent an interactive
        # message for this user/thread — avoids duplicate messages
        if get_interactive_msg_id(user_id, thread_id):
            logger.debug(
                "Interactive UI already tracked for user=%d thread=%s, skipping",
                user_id,
                thread_id,
            )
            return
        logger.debug(
            "Interactive UI detected in polling (user=%d, window=%s, thread=%s)",
            user_id,
            window_id,
            thread_id,
        )
        await handle_interactive_ui(bot, user_id, window_id, thread_id)
        return

    # Normal status line check — skip if queue is non-empty
    if skip_status:
        return

    status_line = parse_status_line(pane_text)

    if status_line:
        await enqueue_status_update(
            bot,
            user_id,
            window_id,
            status_line,
            thread_id=thread_id,
        )
    # If no status line, keep existing status message (don't clear on transient state)


async def status_poll_loop(bot: Bot) -> None:
    """Background task to poll terminal status for all thread-bound windows."""
    logger.info("Status polling started (interval: %ss)", STATUS_POLL_INTERVAL)
    last_topic_check = 0.0
    while True:
        try:
            # Periodic topic existence probe
            now = time.monotonic()
            if now - last_topic_check >= TOPIC_CHECK_INTERVAL:
                last_topic_check = now
                for user_id, thread_id, wid in session_manager.all_thread_bindings():
                    try:
                        await bot.send_chat_action(
                            chat_id=session_manager.resolve_chat_id(user_id, thread_id),
                            message_thread_id=thread_id,
                            action=ChatAction.TYPING,
                        )
                    except BadRequest as e:
                        if "Topic_id_invalid" in str(e):
                            # Topic deleted — kill window, unbind, and clean up state
                            w = await tmux_manager.find_window_by_id(wid)
                            if w:
                                await tmux_manager.kill_window(w.window_id)
                            session_manager.unbind_thread(user_id, thread_id)
                            await clear_topic_state(user_id, thread_id, bot)
                            logger.info(
                                "Topic deleted: killed window_id '%s' and "
                                "unbound thread %d for user %d",
                                wid,
                                thread_id,
                                user_id,
                            )
                        else:
                            logger.debug(
                                "Topic probe error for %s: %s",
                                wid,
                                e,
                            )
                    except Exception as e:
                        logger.debug(
                            "Topic probe error for %s: %s",
                            wid,
                            e,
                        )

            # Fresh snapshot — reflects any unbinds from the topic probe above,
            # so bindings cleaned there are naturally excluded.
            for user_id, thread_id, wid in session_manager.all_thread_bindings():
                try:
                    # Clean up stale bindings (window no longer exists)
                    w = await tmux_manager.find_window_by_id(wid)
                    if not w:
                        display_name = session_manager.get_display_name(wid)
                        shell_pid = _window_pids.pop(wid, None)
                        _memory_warned.discard(wid)

                        # Check if the window was killed by OOM
                        reason = "Session ended"
                        if shell_pid:
                            try:
                                descendants = await get_process_tree_pids(shell_pid)
                            except Exception:
                                descendants = []
                            oom_info = await was_pid_oom_killed(shell_pid, descendants)
                            if oom_info:
                                rss_kb = oom_info.get("rss_kb")
                                rss_str = (
                                    f", RSS: {int(str(rss_kb)) // 1024}MB"
                                    if rss_kb
                                    else ""
                                )
                                reason = (
                                    f"Session killed by OOM killer "
                                    f"(process: {oom_info['process_name']}"
                                    f"{rss_str})"
                                )
                                logger.warning(
                                    "OOM kill detected for window %s (pid=%d): %s",
                                    wid,
                                    shell_pid,
                                    oom_info.get("line", ""),
                                )

                        # Extract last-activity context from JSONL
                        death_context = ""
                        try:
                            death_context = (
                                await session_manager.get_session_death_context(wid)
                            )
                        except Exception as e:
                            logger.debug(
                                "Failed to get death context for %s: %s",
                                wid,
                                e,
                            )

                        # Notify user in the topic
                        try:
                            chat_id = session_manager.resolve_chat_id(
                                user_id, thread_id
                            )
                            msg = f"\u26a0\ufe0f {reason}: {display_name}"
                            if death_context:
                                msg += f"\n\n{death_context}"
                            await safe_send(
                                bot,
                                chat_id,
                                msg,
                                message_thread_id=thread_id,
                            )
                        except Exception as e:
                            logger.debug(
                                "Failed to send session-end notification: %s",
                                e,
                            )

                        session_manager.unbind_thread(user_id, thread_id)
                        await clear_topic_state(user_id, thread_id, bot)
                        logger.info(
                            "Cleaned up stale binding: user=%d thread=%d window_id=%s",
                            user_id,
                            thread_id,
                            wid,
                        )
                        continue

                    # Track pane PID for OOM detection on death
                    if wid not in _window_pids:
                        pid = await tmux_manager.get_pane_pid(wid)
                        if pid:
                            _window_pids[wid] = pid

                    # UI detection happens unconditionally in update_status_message.
                    # Status enqueue is skipped inside update_status_message when
                    # interactive UI is detected (returns early) or when queue is non-empty.
                    queue = get_message_queue(user_id)
                    skip_status = queue is not None and not queue.empty()

                    await update_status_message(
                        bot,
                        user_id,
                        wid,
                        thread_id=thread_id,
                        skip_status=skip_status,
                    )
                except Exception as e:
                    logger.debug(
                        f"Status update error for user {user_id} "
                        f"thread {thread_id}: {e}"
                    )

            # Periodic memory monitoring
            await _check_memory_usage(bot)
            await _check_system_memory(bot)
        except Exception as e:
            logger.error(f"Status poll loop error: {e}")

        await asyncio.sleep(STATUS_POLL_INTERVAL)


async def _check_memory_usage(bot: Bot) -> None:
    """Check memory usage of all tracked windows and warn if above threshold."""
    global _last_memory_check

    if not config.memory_monitor_enabled:
        return

    now = time.monotonic()
    if now - _last_memory_check < config.memory_check_interval:
        return
    _last_memory_check = now

    for user_id, thread_id, wid in session_manager.all_thread_bindings():
        pid = _window_pids.get(wid)
        if not pid:
            continue
        try:
            rss_mb = await get_tree_rss_mb(pid)
            if rss_mb is None:
                continue

            if rss_mb > config.memory_warning_mb and wid not in _memory_warned:
                _memory_warned.add(wid)
                display_name = session_manager.get_display_name(wid)
                chat_id = session_manager.resolve_chat_id(user_id, thread_id)
                await safe_send(
                    bot,
                    chat_id,
                    f"\u26a0\ufe0f High memory usage: {display_name} "
                    f"is using {rss_mb:.0f}MB RSS",
                    message_thread_id=thread_id,
                )
                logger.warning(
                    "Memory warning for window %s (pid=%d): %.0fMB",
                    wid,
                    pid,
                    rss_mb,
                )
            elif rss_mb <= config.memory_warning_mb * 0.8 and wid in _memory_warned:
                # Reset warning when memory drops to 80% of threshold
                _memory_warned.discard(wid)
        except Exception as e:
            logger.debug("Memory check error for window %s: %s", wid, e)


async def _find_highest_rss_window() -> (
    tuple[str, int, int, float] | None
):
    """Find the window with the highest process tree RSS.

    Returns (window_id, user_id, thread_id, rss_mb) or None.
    """
    highest: tuple[str, int, int, float] | None = None
    for user_id, thread_id, wid in session_manager.all_thread_bindings():
        pid = _window_pids.get(wid)
        if not pid:
            continue
        try:
            rss_mb = await get_tree_rss_mb(pid)
            if rss_mb is not None and (highest is None or rss_mb > highest[3]):
                highest = (wid, user_id, thread_id, rss_mb)
        except Exception:
            continue
    return highest


# Cooldown constants (in check cycles, not seconds — cycle = memory_check_interval)
# With default CCBOT_MEMORY_CHECK_INTERVAL=10: 2 cycles ≈ 20s, 3 cycles ≈ 30s
_INTERRUPT_COOLDOWN_CYCLES = 2  # wait 2 cycles after interrupt before kill
_KILL_COOLDOWN_CYCLES = 3  # wait 3 cycles after kill before another kill


async def _check_system_memory(bot: Bot) -> None:
    """Check system-wide MemAvailable and escalate if memory is critically low.

    Escalation levels (advances at most one level per check cycle):
      0 → normal
      1 → warn (notify all topics)
      2 → interrupt (send Escape to highest-RSS window)
      3 → kill (kill highest-RSS window)
    """
    global _sys_mem_level, _sys_mem_cycles_at_level, _last_sys_mem_check

    if not config.memory_monitor_enabled:
        return

    now = time.monotonic()
    if now - _last_sys_mem_check < config.memory_check_interval:
        return
    _last_sys_mem_check = now

    available = await get_mem_available_mb()
    if available is None:
        return  # /proc/meminfo not readable (non-Linux)

    # Determine target level based on available memory
    if available <= config.mem_avail_kill_mb:
        target_level = 3
    elif available <= config.mem_avail_interrupt_mb:
        target_level = 2
    elif available <= config.mem_avail_warn_mb:
        target_level = 1
    else:
        target_level = 0

    # Recovery: reset when memory is well above warn threshold (hysteresis)
    if available > config.mem_avail_warn_mb * 1.5:
        if _sys_mem_level > 0:
            logger.info(
                "System memory recovered: %.0fMB available, resetting escalation",
                available,
            )
        _sys_mem_level = 0
        _sys_mem_cycles_at_level = 0
        return

    # No escalation needed
    if target_level == 0:
        _sys_mem_level = 0
        _sys_mem_cycles_at_level = 0
        return

    # Track cycles at current level
    _sys_mem_cycles_at_level += 1

    # Advance at most one level per cycle
    new_level = min(target_level, _sys_mem_level + 1)

    # Enforce cooldowns before escalating
    if new_level == 3 and _sys_mem_level == 2:
        if _sys_mem_cycles_at_level < _INTERRUPT_COOLDOWN_CYCLES:
            logger.debug(
                "Interrupt cooldown: %d/%d cycles",
                _sys_mem_cycles_at_level,
                _INTERRUPT_COOLDOWN_CYCLES,
            )
            return
    if new_level == 3 and _sys_mem_level == 3:
        if _sys_mem_cycles_at_level < _KILL_COOLDOWN_CYCLES:
            logger.debug(
                "Kill cooldown: %d/%d cycles",
                _sys_mem_cycles_at_level,
                _KILL_COOLDOWN_CYCLES,
            )
            return

    # Downgrade level when pressure has eased
    if new_level < _sys_mem_level:
        _sys_mem_level = new_level
        _sys_mem_cycles_at_level = 0
        return

    # Only act when level actually changes (or kill repeats)
    if new_level <= _sys_mem_level and new_level < 3:
        return

    # Reset cycle counter on level change
    if new_level != _sys_mem_level:
        _sys_mem_cycles_at_level = 0
    _sys_mem_level = new_level

    # === Level 1: Warn all topics ===
    if new_level == 1:
        logger.warning("System memory low: %.0fMB available", available)
        for user_id, thread_id, _wid in session_manager.all_thread_bindings():
            try:
                chat_id = session_manager.resolve_chat_id(user_id, thread_id)
                await safe_send(
                    bot,
                    chat_id,
                    f"\u26a0\ufe0f System memory low: {available:.0f}MB available. "
                    "Consider reducing parallel workloads.",
                    message_thread_id=thread_id,
                )
            except Exception as e:
                logger.debug("Failed to send memory warning: %s", e)

    # === Level 2: Interrupt highest-RSS window ===
    elif new_level == 2:
        target = await _find_highest_rss_window()
        if not target:
            logger.warning(
                "Memory critical (%.0fMB available) but no windows to interrupt",
                available,
            )
            return
        wid, user_id, thread_id, rss_mb = target
        display_name = session_manager.get_display_name(wid)
        logger.warning(
            "Memory critical (%.0fMB available) — interrupting %s (%.0fMB RSS)",
            available,
            display_name,
            rss_mb,
        )
        await tmux_manager.send_keys(wid, "Escape", enter=False, literal=False)
        try:
            chat_id = session_manager.resolve_chat_id(user_id, thread_id)
            await safe_send(
                bot,
                chat_id,
                f"\u26a0\ufe0f Memory critical ({available:.0f}MB available) "
                f"\u2014 interrupted {display_name} ({rss_mb:.0f}MB RSS)",
                message_thread_id=thread_id,
            )
        except Exception as e:
            logger.debug("Failed to send interrupt notification: %s", e)

    # === Level 3: Kill highest-RSS window ===
    elif new_level == 3:
        target = await _find_highest_rss_window()
        if not target:
            logger.warning(
                "Memory emergency (%.0fMB available) but no windows to kill",
                available,
            )
            _sys_mem_level = 0
            _sys_mem_cycles_at_level = 0
            return
        wid, user_id, thread_id, rss_mb = target
        display_name = session_manager.get_display_name(wid)
        logger.error(
            "Memory emergency (%.0fMB available) — killing %s (%.0fMB RSS)",
            available,
            display_name,
            rss_mb,
        )
        await tmux_manager.kill_window(wid)
        _window_pids.pop(wid, None)
        _memory_warned.discard(wid)
        try:
            chat_id = session_manager.resolve_chat_id(user_id, thread_id)
            await safe_send(
                bot,
                chat_id,
                f"\U0001f6a8 Memory emergency ({available:.0f}MB available) "
                f"\u2014 killed {display_name} ({rss_mb:.0f}MB RSS) "
                "to prevent system OOM",
                message_thread_id=thread_id,
            )
        except Exception as e:
            logger.debug("Failed to send kill notification: %s", e)
        session_manager.unbind_thread(user_id, thread_id)
        await clear_topic_state(user_id, thread_id, bot)
        _sys_mem_cycles_at_level = 0  # reset for next kill cooldown
