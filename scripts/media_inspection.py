#!/usr/bin/env python3
"""Read the small subset of MP4 metadata needed by the feasibility study."""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Any, BinaryIO, Iterator

Box = tuple[bytes, int, int]


def iter_boxes(file: BinaryIO, start: int, end: int) -> Iterator[Box]:
    offset = start
    while offset + 8 <= end:
        file.seek(offset)
        header = file.read(8)
        if len(header) != 8:
            return
        size, box_type = struct.unpack(">I4s", header)
        header_size = 8
        if size == 1:
            extended = file.read(8)
            if len(extended) != 8:
                return
            size = struct.unpack(">Q", extended)[0]
            header_size = 16
        elif size == 0:
            size = end - offset
        if size < header_size or offset + size > end:
            return
        yield box_type, offset + header_size, offset + size
        offset += size


def child_boxes(file: BinaryIO, parent: Box, wanted: bytes) -> list[Box]:
    _, start, end = parent
    return [box for box in iter_boxes(file, start, end) if box[0] == wanted]


def read_duration(file: BinaryIO, moov: Box) -> float | None:
    boxes = child_boxes(file, moov, b"mvhd")
    if not boxes:
        return None
    _, start, end = boxes[0]
    if end - start < 20:
        return None
    file.seek(start)
    version = file.read(1)
    if version == b"\x01":
        if end - start < 32:
            return None
        file.seek(start + 20)
        timescale = struct.unpack(">I", file.read(4))[0]
        duration = struct.unpack(">Q", file.read(8))[0]
    else:
        file.seek(start + 12)
        timescale, duration = struct.unpack(">II", file.read(8))
    return duration / timescale if timescale else None


def inspect_mp4(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "width": None,
        "height": None,
        "has_audio": None,
        "duration_seconds": None,
    }
    if not path.is_file() or path.stat().st_size == 0:
        return result

    try:
        with path.open("rb") as file:
            top_level = list(iter_boxes(file, 0, path.stat().st_size))
            moov = next((box for box in top_level if box[0] == b"moov"), None)
            if not moov:
                return result

            try:
                result["duration_seconds"] = read_duration(file, moov)
            except (OSError, struct.error):
                result["duration_seconds"] = None
            has_audio = False
            for trak in child_boxes(file, moov, b"trak"):
                handler_type = None
                dimensions = None
                tkhd_boxes = child_boxes(file, trak, b"tkhd")
                if tkhd_boxes:
                    _, payload_start, payload_end = tkhd_boxes[0]
                    if payload_end - payload_start >= 8:
                        file.seek(payload_end - 8)
                        width_raw, height_raw = struct.unpack(">II", file.read(8))
                        dimensions = (width_raw >> 16, height_raw >> 16)

                mdia_boxes = child_boxes(file, trak, b"mdia")
                if mdia_boxes:
                    hdlr_boxes = child_boxes(file, mdia_boxes[0], b"hdlr")
                    if hdlr_boxes:
                        _, payload_start, payload_end = hdlr_boxes[0]
                        if payload_end - payload_start >= 12:
                            file.seek(payload_start + 8)
                            handler_type = file.read(4)

                if handler_type == b"soun":
                    has_audio = True
                elif handler_type == b"vide" and dimensions:
                    result["width"], result["height"] = dimensions

            result["has_audio"] = has_audio
    except (OSError, struct.error):
        return result
    return result
