"""Process tree inspection, memory usage, and OOM-kill detection.

Provides Linux-specific helpers that read /proc and dmesg to:
  - Walk a process's descendant tree
  - Read RSS memory (VmRSS) for a process or its entire tree
  - Detect recent OOM kills and correlate them with specific PIDs

All functions are async-friendly (blocking I/O wrapped in to_thread).
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


async def get_child_pids(pid: int) -> list[int]:
    """Get direct child PIDs of a process via /proc/[pid]/task/[tid]/children."""
    children: list[int] = []
    task_dir = Path(f"/proc/{pid}/task")
    try:
        if not task_dir.exists():
            return children
        for tid_dir in task_dir.iterdir():
            children_file = tid_dir / "children"
            if children_file.exists():
                text = children_file.read_text().strip()
                if text:
                    children.extend(int(p) for p in text.split())
    except (OSError, ValueError):
        pass
    return children


async def get_process_tree_pids(root_pid: int) -> list[int]:
    """Get all descendant PIDs of a process (breadth-first)."""
    all_pids: list[int] = []
    queue = [root_pid]
    while queue:
        pid = queue.pop(0)
        kids = await get_child_pids(pid)
        all_pids.extend(kids)
        queue.extend(kids)
    return all_pids


async def get_process_rss_mb(pid: int) -> float | None:
    """Read VmRSS from /proc/[pid]/status. Returns MB or None if unavailable."""
    try:
        status_file = Path(f"/proc/{pid}/status")
        if not status_file.exists():
            return None
        text = await asyncio.to_thread(status_file.read_text)
        for line in text.splitlines():
            if line.startswith("VmRSS:"):
                # Format: "VmRSS:    12345 kB"
                parts = line.split()
                if len(parts) >= 2:
                    return int(parts[1]) / 1024.0
    except (OSError, ValueError):
        pass
    return None


async def get_tree_rss_mb(root_pid: int) -> float | None:
    """Sum RSS of a process and all its descendants. Returns MB or None."""
    root_rss = await get_process_rss_mb(root_pid)
    if root_rss is None:
        return None

    total = root_rss
    descendants = await get_process_tree_pids(root_pid)
    for pid in descendants:
        rss = await get_process_rss_mb(pid)
        if rss is not None:
            total += rss
    return total


def _parse_dmesg_for_oom_kills(dmesg_output: str) -> list[dict[str, object]]:
    """Parse dmesg text for OOM kill entries.

    Returns list of dicts with keys: pid, process_name, total_pages, rss_kb.
    """
    results: list[dict[str, object]] = []
    # Kernel OOM killer log pattern (varies by kernel version):
    #   "Killed process 1234 (python3) total-vm:123456kB, ..."
    #   "Out of memory: Killed process 1234 (python3) ..."
    pattern = re.compile(
        r"Killed process (\d+) \(([^)]+)\)"
        r"(?:.*?total-vm:(\d+)kB)?"
        r"(?:.*?anon-rss:(\d+)kB)?",
    )
    for line in dmesg_output.splitlines():
        m = pattern.search(line)
        if m:
            results.append(
                {
                    "pid": int(m.group(1)),
                    "process_name": m.group(2),
                    "total_vm_kb": int(m.group(3)) if m.group(3) else None,
                    "rss_kb": int(m.group(4)) if m.group(4) else None,
                    "line": line.strip(),
                }
            )
    return results


async def check_recent_oom_kills() -> list[dict[str, object]]:
    """Check dmesg for OOM kill entries.

    Returns all OOM kills found in the current dmesg buffer.
    Best-effort: returns empty list if dmesg is inaccessible.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            "dmesg",
            "--level=err,warn,info",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            # Try without --level flag (older dmesg versions)
            proc = await asyncio.create_subprocess_exec(
                "dmesg",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            if proc.returncode != 0:
                return []
        return _parse_dmesg_for_oom_kills(stdout.decode("utf-8", errors="replace"))
    except Exception as e:
        logger.debug("Failed to check dmesg for OOM kills: %s", e)
        return []


async def get_mem_available_mb() -> float | None:
    """Read MemAvailable from /proc/meminfo. Returns MB or None if unavailable.

    MemAvailable is the kernel's estimate of memory available for new
    allocations without swapping — more accurate than MemFree alone.
    """
    meminfo = Path("/proc/meminfo")
    try:
        if not meminfo.exists():
            return None
        text = await asyncio.to_thread(meminfo.read_text)
        for line in text.splitlines():
            if line.startswith("MemAvailable:"):
                # Format: "MemAvailable:   12345678 kB"
                parts = line.split()
                if len(parts) >= 2:
                    return int(parts[1]) / 1024.0
    except (OSError, ValueError):
        pass
    return None


async def was_pid_oom_killed(
    shell_pid: int,
    descendants: list[int] | None = None,
) -> dict[str, object] | None:
    """Check if a PID or any of its descendants were OOM-killed.

    Returns the matching OOM kill info dict, or None.
    """
    pids_to_check = {shell_pid}
    if descendants:
        pids_to_check.update(descendants)

    oom_kills = await check_recent_oom_kills()
    for kill in oom_kills:
        if kill["pid"] in pids_to_check:
            return kill
    return None
