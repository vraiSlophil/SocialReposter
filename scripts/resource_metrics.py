#!/usr/bin/env python3
"""Measure one feasibility run with cgroup v2, with a portable fallback."""

from __future__ import annotations

import resource
import time
from pathlib import Path
from typing import Any

CGROUP_ROOT = Path("/sys/fs/cgroup")


def _read_integer(path: Path) -> int | None:
    try:
        raw_value = path.read_text(encoding="utf-8").strip()
        return int(raw_value) if raw_value != "max" else None
    except (OSError, ValueError):
        return None


def _read_cpu_usage_usec() -> int | None:
    try:
        values = {
            key: int(value)
            for key, value in (
                line.split(maxsplit=1)
                for line in (CGROUP_ROOT / "cpu.stat").read_text(encoding="utf-8").splitlines()
            )
        }
    except (OSError, ValueError):
        return None
    return values.get("usage_usec")


def _read_io_bytes() -> tuple[int, int] | None:
    read_bytes = 0
    write_bytes = 0
    try:
        for line in (CGROUP_ROOT / "io.stat").read_text(encoding="utf-8").splitlines():
            fields = line.split()[1:]
            values = dict(field.split("=", maxsplit=1) for field in fields)
            read_bytes += int(values.get("rbytes", 0))
            write_bytes += int(values.get("wbytes", 0))
    except (OSError, ValueError):
        return None
    return read_bytes, write_bytes


def _process_cpu_seconds() -> float:
    own = resource.getrusage(resource.RUSAGE_SELF)
    children = resource.getrusage(resource.RUSAGE_CHILDREN)
    return own.ru_utime + own.ru_stime + children.ru_utime + children.ru_stime


def _process_peak_memory_bytes() -> int:
    own = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    children = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss
    # ru_maxrss est exprime en Kio sous Linux. On conserve le plus grand pic,
    # car les pics du processus parent et de ses enfants ne sont pas simultanes.
    return max(own, children) * 1024


class ResourceMonitor:
    """Collect comparable resource metrics for one fresh Docker container."""

    def __init__(self) -> None:
        self._wall_started = time.perf_counter()
        self._cgroup_cpu_started = _read_cpu_usage_usec()
        self._cgroup_io_started = _read_io_bytes()
        self._process_cpu_started = _process_cpu_seconds()
        self._result: dict[str, Any] | None = None

    def finish(self) -> dict[str, Any]:
        if self._result is not None:
            return self._result

        wall_seconds = max(time.perf_counter() - self._wall_started, 0.0)
        cgroup_cpu_finished = _read_cpu_usage_usec()
        cgroup_io_finished = _read_io_bytes()

        if self._cgroup_cpu_started is not None and cgroup_cpu_finished is not None:
            cpu_seconds = max(cgroup_cpu_finished - self._cgroup_cpu_started, 0) / 1_000_000
            source = "cgroup-v2"
        else:
            cpu_seconds = max(_process_cpu_seconds() - self._process_cpu_started, 0.0)
            source = "process-rusage"

        io_read_bytes: int | None = None
        io_write_bytes: int | None = None
        if self._cgroup_io_started is not None and cgroup_io_finished is not None:
            io_read_bytes = max(cgroup_io_finished[0] - self._cgroup_io_started[0], 0)
            io_write_bytes = max(cgroup_io_finished[1] - self._cgroup_io_started[1], 0)

        peak_memory_bytes = _read_integer(CGROUP_ROOT / "memory.peak")
        if peak_memory_bytes is None:
            peak_memory_bytes = _process_peak_memory_bytes()

        average_cpu_percent = (cpu_seconds / wall_seconds * 100) if wall_seconds else 0.0
        self._result = {
            "source": source,
            "wall_time_seconds": round(wall_seconds, 3),
            "cpu_time_seconds": round(cpu_seconds, 3),
            "average_cpu_percent": round(average_cpu_percent, 1),
            "peak_memory_bytes": peak_memory_bytes,
            "io_read_bytes": io_read_bytes,
            "io_write_bytes": io_write_bytes,
            "energy_proxy": {
                "metric": "cpu_time_seconds",
                "value": round(cpu_seconds, 3),
                "unit": "CPU-seconds",
                "is_electrical_power_measurement": False,
            },
        }
        return self._result
