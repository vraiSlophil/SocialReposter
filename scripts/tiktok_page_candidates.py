#!/usr/bin/env python3
"""Extract main-post media candidates from TikTok hydration JSON."""

from __future__ import annotations

from typing import Any, Iterator


def walk_dicts(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def numeric(value: Any) -> int | float | None:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def first_case_insensitive(mapping: dict[str, Any], key: str) -> Any:
    lowered_key = key.lower()
    return next((value for name, value in mapping.items() if name.lower() == lowered_key), None)


def urls_from_value(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value] if value.startswith("https://") else []
    if isinstance(value, list):
        return [url for item in value for url in urls_from_value(item)]
    if isinstance(value, dict):
        url_list = first_case_insensitive(value, "urlList")
        if url_list is not None:
            return urls_from_value(url_list)
    return []


def find_video_objects(payload: Any, video_id: str) -> list[dict[str, Any]]:
    videos: list[dict[str, Any]] = []
    seen: set[int] = set()
    for value in walk_dicts(payload):
        item_id = value.get("id") or value.get("itemId")
        video = value.get("video")
        if str(item_id) != video_id or not isinstance(video, dict) or id(video) in seen:
            continue
        seen.add(id(video))
        videos.append(video)
    return videos


def candidate(
    url: str,
    source: str,
    trust: int,
    video: dict[str, Any],
    variant: dict[str, Any] | None = None,
) -> dict[str, Any]:
    variant = variant or {}
    play_address = first_case_insensitive(variant, "playAddr")
    address_details = play_address if isinstance(play_address, dict) else {}
    return {
        "url": url,
        "source": source,
        "trust": trust,
        "bit_rate": numeric(first_case_insensitive(variant, "bitrate")),
        "width": numeric(first_case_insensitive(address_details, "width"))
        or numeric(video.get("width")),
        "height": numeric(first_case_insensitive(address_details, "height"))
        or numeric(video.get("height")),
        "duration_seconds": numeric(video.get("duration")),
        "expected_size_bytes": numeric(first_case_insensitive(address_details, "dataSize")),
    }


def candidates_from_video(video: dict[str, Any], script_id: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    bitrate_info = first_case_insensitive(video, "bitrateInfo")
    if isinstance(bitrate_info, list):
        for variant in bitrate_info:
            if not isinstance(variant, dict):
                continue
            play_address = first_case_insensitive(variant, "playAddr")
            for url in urls_from_value(play_address):
                candidates.append(
                    candidate(url, f"structured:{script_id}:bitrateInfo", 120, video, variant)
                )

    direct_keys = {
        "playaddr": ("playAddr", 110),
        "playaddrh264": ("playAddrH264", 110),
        "downloadaddr": ("downloadAddr", 100),
    }
    for key, value in video.items():
        details = direct_keys.get(key.lower())
        if not details:
            continue
        source_name, trust = details
        for url in urls_from_value(value):
            candidates.append(
                candidate(url, f"structured:{script_id}:{source_name}", trust, video)
            )
    return candidates


def extract_structured_candidates(
    payloads: list[tuple[str, Any]],
    video_id: str,
) -> list[dict[str, Any]]:
    by_url: dict[str, dict[str, Any]] = {}
    for script_id, payload in payloads:
        for video in find_video_objects(payload, video_id):
            for media_candidate in candidates_from_video(video, script_id):
                url = media_candidate["url"]
                previous = by_url.get(url)
                if previous is None or media_candidate["trust"] > previous["trust"]:
                    by_url[url] = media_candidate

    def sort_key(media_candidate: dict[str, Any]) -> tuple[float, float, float]:
        width = numeric(media_candidate.get("width")) or 0
        height = numeric(media_candidate.get("height")) or 0
        return (
            float(media_candidate.get("trust") or 0),
            float(width * height),
            float(media_candidate.get("bit_rate") or 0),
        )

    return sorted(by_url.values(), key=sort_key, reverse=True)
