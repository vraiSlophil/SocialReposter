#!/usr/bin/env python3
"""Run yt-dlp and add feasibility timing data to its metadata file."""

from __future__ import annotations

from resource_metrics import ResourceMonitor

RUN_MONITOR = ResourceMonitor()

import json
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path


def fail(message: str, exit_code: int = 1) -> None:
    print(f"Erreur : {message}", file=sys.stderr)
    raise SystemExit(exit_code)


def video_id_from_url(source_url: str) -> str:
    parts = source_url.split("/video/", maxsplit=1)
    if len(parts) == 2:
        candidate = parts[1].split("?", maxsplit=1)[0].split("/", maxsplit=1)[0]
        if candidate.isdigit():
            return candidate
    return "yt-dlp"


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: download_with_ytdlp.py <URL_TIKTOK> <DOSSIER_SORTIE>", 64)

    source_url = sys.argv[1]
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(mode="w", delete=False) as record:
        record_path = Path(record.name)

    command = [
        "yt-dlp",
        "--no-playlist",
        "--write-info-json",
        "--no-write-playlist-metafiles",
        "--paths",
        str(output_dir),
        "--output",
        "%(id)s.%(ext)s",
        "--print-to-file",
        "after_move:filepath",
        str(record_path),
        source_url,
    ]

    monitor = RUN_MONITOR
    try:
        result = subprocess.run(command, check=False)
        resource_usage = monitor.finish()
    except OSError as error:
        resource_usage = monitor.finish()
        failure_path = output_dir / f"{video_id_from_url(source_url)}.failure.json"
        failure_path.write_text(
            json.dumps(
                {
                    "source_url": source_url,
                    "error": str(error),
                    "resource_usage": resource_usage,
                    "failed_at": datetime.now(UTC).isoformat(),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        record_path.unlink(missing_ok=True)
        fail(f"impossible de lancer yt-dlp ({error}). Diagnostic : {failure_path}")

    try:
        if result.returncode != 0:
            failure_path = output_dir / f"{video_id_from_url(source_url)}.failure.json"
            failure_path.write_text(
                json.dumps(
                    {
                        "source_url": source_url,
                        "return_code": result.returncode,
                        "error": f"yt-dlp s'est termine avec le code {result.returncode}",
                        "resource_usage": resource_usage,
                        "failed_at": datetime.now(UTC).isoformat(),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            raise SystemExit(result.returncode)

        paths = [line.strip() for line in record_path.read_text().splitlines() if line.strip()]
        if not paths:
            fail("yt-dlp a termine sans indiquer le fichier telecharge.")

        video_path = Path(paths[-1])
        metadata_path = video_path.with_suffix(".info.json")
        if not video_path.is_file() or video_path.stat().st_size == 0:
            fail("yt-dlp n'a produit aucun fichier video exploitable.")
        if not metadata_path.is_file():
            fail(f"metadonnees yt-dlp introuvables : {metadata_path}")

        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["_feasibility"] = {
            "source_url": source_url,
            "download_duration_seconds": resource_usage["wall_time_seconds"],
            "resource_usage": resource_usage,
            "downloaded_at": datetime.now(UTC).isoformat(),
        }
        metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(video_path)
        print(metadata_path)
    finally:
        record_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
