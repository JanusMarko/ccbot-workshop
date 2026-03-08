"""Tests for system-wide memory pressure detection and escalation.

Verifies the warn → interrupt → kill escalation in _check_system_memory:
  - Warn sends notifications to all bound topics
  - Interrupt sends Escape to highest-RSS window
  - Kill removes highest-RSS window and cleans up bindings
  - Escalation advances at most one level per check cycle
  - Cooldowns prevent rapid successive kills
  - Hysteresis resets escalation when memory recovers
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from ccbot.handlers import status_polling
from ccbot.handlers.status_polling import (
    _check_system_memory,
    _find_highest_rss_window,
)


@pytest.fixture(autouse=True)
def _reset_escalation_state():
    """Reset module-level escalation state before and after each test."""
    status_polling._sys_mem_level = 0
    status_polling._sys_mem_cycles_at_level = 0
    status_polling._last_sys_mem_check = 0.0
    status_polling._window_pids.clear()
    status_polling._memory_warned.clear()
    yield
    status_polling._sys_mem_level = 0
    status_polling._sys_mem_cycles_at_level = 0
    status_polling._last_sys_mem_check = 0.0
    status_polling._window_pids.clear()
    status_polling._memory_warned.clear()


@pytest.fixture
def mock_bot():
    return AsyncMock()


@pytest.fixture
def mock_config():
    """Patch config with test thresholds."""
    with patch("ccbot.handlers.status_polling.config") as cfg:
        cfg.memory_monitor_enabled = True
        cfg.memory_check_interval = 0  # no throttle in tests
        cfg.mem_avail_warn_mb = 1024.0
        cfg.mem_avail_interrupt_mb = 512.0
        cfg.mem_avail_kill_mb = 256.0
        yield cfg


@pytest.fixture
def one_binding():
    """Set up one thread binding with a tracked PID."""
    status_polling._window_pids["@0"] = 1234
    with (
        patch(
            "ccbot.handlers.status_polling.session_manager"
        ) as mock_sm,
        patch("ccbot.handlers.status_polling.tmux_manager") as mock_tmux,
        patch(
            "ccbot.handlers.status_polling.safe_send",
            new_callable=AsyncMock,
        ) as mock_send,
        patch(
            "ccbot.handlers.status_polling.clear_topic_state",
            new_callable=AsyncMock,
        ),
    ):
        mock_sm.all_thread_bindings.return_value = [(100, 42, "@0")]
        mock_sm.resolve_chat_id.return_value = 100
        mock_sm.get_display_name.return_value = "test-session"
        mock_tmux.send_keys = AsyncMock(return_value=True)
        mock_tmux.kill_window = AsyncMock(return_value=True)
        yield {
            "session_manager": mock_sm,
            "tmux_manager": mock_tmux,
            "safe_send": mock_send,
        }


class TestCheckSystemMemory:
    """Test _check_system_memory escalation logic."""

    @pytest.mark.asyncio
    async def test_no_action_when_memory_ok(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """MemAvailable > warn threshold → no notification."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=4000.0,
        ):
            await _check_system_memory(mock_bot)
        one_binding["safe_send"].assert_not_called()
        assert status_polling._sys_mem_level == 0

    @pytest.mark.asyncio
    async def test_warn_on_low_memory(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """MemAvailable <= warn threshold → warn notification to all topics."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=800.0,
        ):
            await _check_system_memory(mock_bot)
        one_binding["safe_send"].assert_called_once()
        msg = one_binding["safe_send"].call_args[0][2]
        assert "System memory low" in msg
        assert "800" in msg
        assert status_polling._sys_mem_level == 1

    @pytest.mark.asyncio
    async def test_one_level_per_cycle(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """Even with kill-level pressure, first cycle only warns."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=100.0,  # below kill threshold
        ), patch(
            "ccbot.handlers.status_polling.get_tree_rss_mb",
            new_callable=AsyncMock,
            return_value=3000.0,
        ):
            await _check_system_memory(mock_bot)
        # Should only be at warn level, not kill
        assert status_polling._sys_mem_level == 1
        msg = one_binding["safe_send"].call_args[0][2]
        assert "System memory low" in msg

    @pytest.mark.asyncio
    async def test_escalates_to_interrupt(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """Warn → interrupt on continued pressure."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=400.0,
        ), patch(
            "ccbot.handlers.status_polling.get_tree_rss_mb",
            new_callable=AsyncMock,
            return_value=3000.0,
        ):
            # Cycle 1: warn
            await _check_system_memory(mock_bot)
            assert status_polling._sys_mem_level == 1

            # Cycle 2: interrupt
            status_polling._last_sys_mem_check = 0.0  # bypass throttle
            await _check_system_memory(mock_bot)
            assert status_polling._sys_mem_level == 2
            one_binding["tmux_manager"].send_keys.assert_called_once_with(
                "@0", "Escape", enter=False, literal=False
            )

    @pytest.mark.asyncio
    async def test_interrupt_cooldown_before_kill(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """After interrupt, must wait cooldown cycles before kill."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=200.0,
        ), patch(
            "ccbot.handlers.status_polling.get_tree_rss_mb",
            new_callable=AsyncMock,
            return_value=3000.0,
        ):
            # Cycle 1: warn
            await _check_system_memory(mock_bot)
            assert status_polling._sys_mem_level == 1

            # Cycle 2: interrupt
            status_polling._last_sys_mem_check = 0.0
            await _check_system_memory(mock_bot)
            assert status_polling._sys_mem_level == 2

            # Cycle 3: cooldown (should NOT kill yet)
            status_polling._last_sys_mem_check = 0.0
            await _check_system_memory(mock_bot)
            one_binding["tmux_manager"].kill_window.assert_not_called()

            # Cycle 4: cooldown satisfied → kill
            status_polling._last_sys_mem_check = 0.0
            await _check_system_memory(mock_bot)
            one_binding["tmux_manager"].kill_window.assert_called_once_with("@0")
            assert status_polling._sys_mem_level == 3

    @pytest.mark.asyncio
    async def test_kill_cleans_up_bindings(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """Kill action unbinds thread and clears topic state."""
        # Fast-track to kill level
        status_polling._sys_mem_level = 2
        status_polling._sys_mem_cycles_at_level = 10  # past cooldown

        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=200.0,
        ), patch(
            "ccbot.handlers.status_polling.get_tree_rss_mb",
            new_callable=AsyncMock,
            return_value=3000.0,
        ):
            await _check_system_memory(mock_bot)

        one_binding["tmux_manager"].kill_window.assert_called_once_with("@0")
        one_binding["session_manager"].unbind_thread.assert_called_once_with(100, 42)
        assert "@0" not in status_polling._window_pids

    @pytest.mark.asyncio
    async def test_hysteresis_reset(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """Memory recovery above warn*1.5 resets escalation to level 0."""
        status_polling._sys_mem_level = 2  # was at interrupt

        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=2000.0,  # well above 1024 * 1.5 = 1536
        ):
            await _check_system_memory(mock_bot)

        assert status_polling._sys_mem_level == 0
        assert status_polling._sys_mem_cycles_at_level == 0

    @pytest.mark.asyncio
    async def test_level_downgrade_when_pressure_partially_relieves(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """If at kill level but memory rises to interrupt level, level downgrades."""
        status_polling._sys_mem_level = 3
        status_polling._sys_mem_cycles_at_level = 0

        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=400.0,  # interrupt level, not kill
        ):
            await _check_system_memory(mock_bot)

        assert status_polling._sys_mem_level == 2
        assert status_polling._sys_mem_cycles_at_level == 0

    @pytest.mark.asyncio
    async def test_disabled_monitor_skips(
        self, mock_bot: AsyncMock, mock_config: MagicMock
    ) -> None:
        """When memory_monitor_enabled=False, no action taken."""
        mock_config.memory_monitor_enabled = False
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
        ) as mock_mem:
            await _check_system_memory(mock_bot)
        mock_mem.assert_not_called()

    @pytest.mark.asyncio
    async def test_none_mem_available_skips(
        self, mock_bot: AsyncMock, mock_config: MagicMock, one_binding: dict
    ) -> None:
        """Non-Linux (MemAvailable=None) → no action."""
        with patch(
            "ccbot.handlers.status_polling.get_mem_available_mb",
            new_callable=AsyncMock,
            return_value=None,
        ):
            await _check_system_memory(mock_bot)
        one_binding["safe_send"].assert_not_called()


class TestFindHighestRssWindow:
    """Test _find_highest_rss_window helper."""

    @pytest.mark.asyncio
    async def test_finds_highest_rss(self) -> None:
        status_polling._window_pids = {"@0": 100, "@1": 200}
        rss_map = {100: 1500.0, 200: 3000.0}

        with (
            patch(
                "ccbot.handlers.status_polling.session_manager"
            ) as mock_sm,
            patch(
                "ccbot.handlers.status_polling.get_tree_rss_mb",
                new_callable=AsyncMock,
                side_effect=lambda pid: rss_map.get(pid),
            ),
        ):
            mock_sm.all_thread_bindings.return_value = [
                (1, 10, "@0"),
                (1, 20, "@1"),
            ]
            result = await _find_highest_rss_window()

        assert result is not None
        wid, user_id, thread_id, rss_mb = result
        assert wid == "@1"
        assert rss_mb == 3000.0

    @pytest.mark.asyncio
    async def test_returns_none_when_no_pids(self) -> None:
        status_polling._window_pids = {}
        with patch(
            "ccbot.handlers.status_polling.session_manager"
        ) as mock_sm:
            mock_sm.all_thread_bindings.return_value = [(1, 10, "@0")]
            result = await _find_highest_rss_window()
        assert result is None
