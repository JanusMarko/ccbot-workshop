"""Tests for process_info module — OOM detection and memory utilities."""

from unittest.mock import AsyncMock, patch

import pytest

from ccbot.process_info import (
    _parse_dmesg_for_oom_kills,
    get_mem_available_mb,
    get_process_rss_mb,
    was_pid_oom_killed,
)


class TestParseDmesgForOomKills:
    """Test dmesg OOM-kill line parsing."""

    def test_standard_oom_kill_line(self) -> None:
        line = (
            "[12345.678] Out of memory: Killed process 1234 (python3) "
            "total-vm:15000000kB, anon-rss:14800000kB, file-rss:1234kB"
        )
        results = _parse_dmesg_for_oom_kills(line)
        assert len(results) == 1
        assert results[0]["pid"] == 1234
        assert results[0]["process_name"] == "python3"
        assert results[0]["total_vm_kb"] == 15000000
        assert results[0]["rss_kb"] == 14800000

    def test_minimal_oom_kill_line(self) -> None:
        line = "[12345.678] Killed process 5678 (node)"
        results = _parse_dmesg_for_oom_kills(line)
        assert len(results) == 1
        assert results[0]["pid"] == 5678
        assert results[0]["process_name"] == "node"
        assert results[0]["total_vm_kb"] is None
        assert results[0]["rss_kb"] is None

    def test_multiple_oom_kills(self) -> None:
        text = (
            "[100.0] Killed process 111 (a)\n"
            "[200.0] some other log line\n"
            "[300.0] Killed process 222 (b)\n"
        )
        results = _parse_dmesg_for_oom_kills(text)
        assert len(results) == 2
        assert results[0]["pid"] == 111
        assert results[1]["pid"] == 222

    def test_no_oom_kills(self) -> None:
        text = "some normal log output\nanother line\n"
        results = _parse_dmesg_for_oom_kills(text)
        assert len(results) == 0

    def test_empty_input(self) -> None:
        assert _parse_dmesg_for_oom_kills("") == []


class TestGetProcessRssMb:
    """Test reading process RSS from /proc."""

    @pytest.mark.asyncio
    async def test_reads_vmrss(self, tmp_path: object) -> None:
        status_content = (
            "Name:\tpython3\n"
            "VmPeak:\t1000000 kB\n"
            "VmRSS:\t512000 kB\n"
            "VmSize:\t800000 kB\n"
        )
        with patch("ccbot.process_info.Path") as mock_path:
            mock_file = mock_path.return_value
            mock_file.exists.return_value = True
            mock_file.read_text.return_value = status_content
            result = await get_process_rss_mb(1234)
        assert result is not None
        assert abs(result - 500.0) < 0.1  # 512000 kB = 500 MB

    @pytest.mark.asyncio
    async def test_returns_none_for_missing_process(self) -> None:
        with patch("ccbot.process_info.Path") as mock_path:
            mock_file = mock_path.return_value
            mock_file.exists.return_value = False
            result = await get_process_rss_mb(99999)
        assert result is None


class TestWasPidOomKilled:
    """Test OOM-kill correlation with specific PIDs."""

    @pytest.mark.asyncio
    async def test_detects_oom_for_matching_pid(self) -> None:
        oom_kills = [
            {
                "pid": 1234,
                "process_name": "python3",
                "total_vm_kb": 15000000,
                "rss_kb": 14800000,
                "line": "Killed process 1234 (python3)",
            }
        ]
        with patch(
            "ccbot.process_info.check_recent_oom_kills",
            new_callable=AsyncMock,
            return_value=oom_kills,
        ):
            result = await was_pid_oom_killed(1234)
        assert result is not None
        assert result["pid"] == 1234

    @pytest.mark.asyncio
    async def test_detects_oom_for_descendant_pid(self) -> None:
        oom_kills = [
            {
                "pid": 5678,
                "process_name": "node",
                "total_vm_kb": None,
                "rss_kb": None,
                "line": "Killed process 5678 (node)",
            }
        ]
        with patch(
            "ccbot.process_info.check_recent_oom_kills",
            new_callable=AsyncMock,
            return_value=oom_kills,
        ):
            result = await was_pid_oom_killed(1234, descendants=[5678, 9999])
        assert result is not None
        assert result["pid"] == 5678

    @pytest.mark.asyncio
    async def test_returns_none_when_no_match(self) -> None:
        oom_kills = [
            {
                "pid": 9999,
                "process_name": "other",
                "total_vm_kb": None,
                "rss_kb": None,
                "line": "Killed process 9999 (other)",
            }
        ]
        with patch(
            "ccbot.process_info.check_recent_oom_kills",
            new_callable=AsyncMock,
            return_value=oom_kills,
        ):
            result = await was_pid_oom_killed(1234, descendants=[5678])
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_no_oom_kills(self) -> None:
        with patch(
            "ccbot.process_info.check_recent_oom_kills",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await was_pid_oom_killed(1234)
        assert result is None


class TestGetMemAvailableMb:
    """Test reading MemAvailable from /proc/meminfo."""

    @pytest.mark.asyncio
    async def test_parses_standard_meminfo(self) -> None:
        meminfo_content = (
            "MemTotal:       16384000 kB\n"
            "MemFree:         2048000 kB\n"
            "MemAvailable:    8192000 kB\n"
            "Buffers:          512000 kB\n"
        )
        with patch("ccbot.process_info.Path") as mock_path:
            mock_file = mock_path.return_value
            mock_file.exists.return_value = True
            mock_file.read_text.return_value = meminfo_content
            result = await get_mem_available_mb()
        assert result is not None
        assert abs(result - 8000.0) < 0.1  # 8192000 kB = 8000 MB

    @pytest.mark.asyncio
    async def test_returns_none_when_file_missing(self) -> None:
        with patch("ccbot.process_info.Path") as mock_path:
            mock_file = mock_path.return_value
            mock_file.exists.return_value = False
            result = await get_mem_available_mb()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_for_malformed_input(self) -> None:
        meminfo_content = "MemTotal:       16384000 kB\nMemFree: garbage\n"
        with patch("ccbot.process_info.Path") as mock_path:
            mock_file = mock_path.return_value
            mock_file.exists.return_value = True
            mock_file.read_text.return_value = meminfo_content
            result = await get_mem_available_mb()
        # MemAvailable line is absent entirely → None
        assert result is None
