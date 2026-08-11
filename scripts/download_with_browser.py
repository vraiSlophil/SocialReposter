#!/usr/bin/env python3
"""Download and validate the main media declared by a public TikTok post."""

from __future__ import annotations

from resource_metrics import ResourceMonitor

RUN_MONITOR = ResourceMonitor()

import asyncio
import ipaddress
import json
import os
import re
import shutil
import socket
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse
from urllib.request import Request, urlopen

from playwright.async_api import Page, Response, Route, async_playwright

from media_inspection import inspect_mp4
from tiktok_page_candidates import extract_structured_candidates

NAVIGATION_TIMEOUT_MS = 60_000
MEDIA_DISCOVERY_TIMEOUT_MS = 30_000
DOWNLOAD_TIMEOUT_SECONDS = 90


def fail(message: str, exit_code: int = 1) -> None:
    print(f"Erreur : {message}", file=sys.stderr)
    raise SystemExit(exit_code)


def video_id_from_url(source_url: str) -> str:
    match = re.search(r"/video/(\d+)", source_url)
    return match.group(1) if match else "browser"


def is_safe_https_url(raw_url: str) -> bool:
    try:
        parsed = urlparse(raw_url)
        if parsed.scheme != "https" or not parsed.hostname:
            return False
        if parsed.hostname.lower() == "localhost":
            return False
        try:
            address = ipaddress.ip_address(parsed.hostname)
        except ValueError:
            return True
        return not (address.is_private or address.is_loopback or address.is_link_local)
    except (TypeError, ValueError):
        return False


def is_media_url(url: str, content_type: str = "") -> bool:
    lowered_url = url.lower()
    lowered_type = content_type.lower()
    return (
        lowered_type.startswith("video/")
        or "mime_type=video" in lowered_url
        or "/video/tos/" in lowered_url
        or ".mp4" in lowered_url
    )


def redacted_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def browser_candidate(
    url: str,
    source: str,
    trust: int,
    **details: Any,
) -> dict[str, Any]:
    return {"url": url, "source": source, "trust": trust, **details}


async def collect_dom_video_candidates(page: Page) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = await page.locator("video").evaluate_all(
        """
        elements => elements.map(video => ({
          currentSrc: video.currentSrc,
          src: video.src,
          width: video.videoWidth || null,
          height: video.videoHeight || null,
          duration_seconds: Number.isFinite(video.duration) ? video.duration : null,
        }))
        """
    )
    candidates: list[dict[str, Any]] = []
    for value in values:
        for key in ("currentSrc", "src"):
            url = value.get(key)
            if isinstance(url, str) and is_safe_https_url(url):
                candidates.append(
                    browser_candidate(
                        url,
                        "dom:video",
                        40,
                        width=value.get("width"),
                        height=value.get("height"),
                        duration_seconds=value.get("duration_seconds"),
                    )
                )
    return candidates


async def collect_meta_candidates(page: Page) -> list[dict[str, Any]]:
    values: list[str] = await page.locator(
        'meta[property="og:video"], meta[property="og:video:url"], '
        'meta[property="og:video:secure_url"], meta[name="twitter:player:stream"]'
    ).evaluate_all("elements => elements.map(element => element.content)")
    return [
        browser_candidate(url, "meta:video", 50)
        for url in values
        if isinstance(url, str) and is_safe_https_url(url)
    ]


async def collect_structured_page_candidates(
    page: Page,
    video_id: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    payloads: list[tuple[str, Any]] = []
    diagnostics: dict[str, Any] = {"scripts_found": [], "parse_errors": {}}
    for script_id in (
        "__UNIVERSAL_DATA_FOR_REHYDRATION__",
        "SIGI_STATE",
        "__NEXT_DATA__",
    ):
        locator = page.locator(f"script#{script_id}")
        if await locator.count() == 0:
            continue
        diagnostics["scripts_found"].append(script_id)
        try:
            raw_payload = await locator.first.text_content(timeout=2_000)
            if raw_payload:
                payloads.append((script_id, json.loads(raw_payload)))
        except Exception as error:
            diagnostics["parse_errors"][script_id] = str(error)

    candidates = extract_structured_candidates(payloads, video_id)
    diagnostics["candidate_count"] = len(candidates)
    return candidates, diagnostics


async def wait_for_media_candidates(
    page: Page,
    video_id: str,
    response_candidates: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + (MEDIA_DISCOVERY_TIMEOUT_MS / 1_000)
    fallback_seen_at: float | None = None
    structured_candidates: list[dict[str, Any]] = []
    fallback_candidates: list[dict[str, Any]] = []
    structured_diagnostics: dict[str, Any] = {}

    while loop.time() < deadline:
        structured_candidates, structured_diagnostics = await collect_structured_page_candidates(
            page, video_id
        )
        dom_candidates = await collect_dom_video_candidates(page)
        meta_candidates = await collect_meta_candidates(page)
        fallback_candidates = meta_candidates + dom_candidates + response_candidates
        if structured_candidates:
            break
        if fallback_candidates and fallback_seen_at is None:
            fallback_seen_at = loop.time()
        if fallback_seen_at is not None and loop.time() - fallback_seen_at >= 5:
            break
        await page.wait_for_timeout(500)

    return structured_candidates, fallback_candidates, structured_diagnostics


async def write_failure_diagnostics(
    page: Page,
    output_dir: Path,
    original_error: Exception,
    response_candidates: list[dict[str, Any]],
    main_response_status: int | None,
    source_url: str,
    monitor: ResourceMonitor,
) -> tuple[Path, Path | None]:
    output_dir.mkdir(parents=True, exist_ok=True)
    video_id = video_id_from_url(page.url) if "/video/" in page.url else video_id_from_url(source_url)
    diagnostics_path = output_dir / f"{video_id}.failure.json"
    screenshot_path = output_dir / f"{video_id}.failure.png"

    diagnostics: dict[str, Any] = {
        "error_type": type(original_error).__name__,
        "error": str(original_error),
        "source_url": source_url,
        "video_id": video_id,
        "page_url": page.url,
        "main_response_status": main_response_status,
        "media_candidate_count": len(response_candidates),
        "captured_at": datetime.now(UTC).isoformat(),
    }
    try:
        diagnostics["page_title"] = await page.title()
        diagnostics["video_element_count"] = await page.locator("video").count()
        body_text = await page.locator("body").inner_text(timeout=3_000)
        diagnostics["body_excerpt"] = body_text[:2_000]
    except Exception as diagnostic_error:
        diagnostics["page_inspection_error"] = str(diagnostic_error)

    saved_screenshot: Path | None = None
    try:
        await page.screenshot(path=str(screenshot_path), full_page=False, timeout=5_000)
        saved_screenshot = screenshot_path
    except Exception as screenshot_error:
        diagnostics["screenshot_error"] = str(screenshot_error)

    resource_usage = monitor.finish()
    diagnostics["download_duration_seconds"] = resource_usage["wall_time_seconds"]
    diagnostics["resource_usage"] = resource_usage
    diagnostics_path.write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return diagnostics_path, saved_screenshot


def download_media(
    candidates: list[dict[str, Any]],
    headers: dict[str, str],
    destination: Path,
) -> tuple[str, int, dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    attempts: list[dict[str, Any]] = []

    for index, media_candidate in enumerate(candidates[:8]):
        media_url = media_candidate["url"]
        temporary_path = destination.with_name(f"{destination.stem}.candidate-{index}.mp4")
        temporary_path.unlink(missing_ok=True)
        request = Request(media_url, headers=headers)
        try:
            with urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
                final_url = response.geturl()
                if not is_safe_https_url(final_url):
                    attempts.append(
                        {
                            "source": media_candidate["source"],
                            "url": redacted_url(media_url),
                            "accepted": False,
                            "reason": "redirection media non sure",
                        }
                    )
                    continue
                content_type = response.headers.get_content_type()
                with temporary_path.open("wb") as output_file:
                    shutil.copyfileobj(response, output_file, length=1024 * 1024)

            size = temporary_path.stat().st_size
            if size == 0:
                temporary_path.unlink(missing_ok=True)
                attempts.append(
                    {
                        "source": media_candidate["source"],
                        "url": redacted_url(media_url),
                        "accepted": False,
                        "reason": "fichier vide",
                    }
                )
                continue

            media_details = inspect_mp4(temporary_path)
            accepted, validation = validate_downloaded_media(media_candidate, media_details)
            attempt = {
                "source": media_candidate["source"],
                "url": redacted_url(media_url),
                "content_type": content_type,
                "size_bytes": size,
                "media": media_details,
                "validation": validation,
                "accepted": accepted,
            }
            attempts.append(attempt)
            if not accepted:
                temporary_path.unlink(missing_ok=True)
                continue

            temporary_path.replace(destination)
            selected = {
                key: value
                for key, value in media_candidate.items()
                if key != "url"
            }
            selected["url"] = redacted_url(final_url)
            return content_type, size, media_details, selected, attempts
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            temporary_path.unlink(missing_ok=True)
            attempts.append(
                {
                    "source": media_candidate["source"],
                    "url": redacted_url(media_url),
                    "accepted": False,
                    "reason": str(error),
                }
            )

    details = "; ".join(
        str(attempt.get("reason") or attempt.get("validation") or "candidat refuse")
        for attempt in attempts[-3:]
    ) or "aucune URL media exploitable"
    raise MediaSelectionError(
        f"aucun candidat ne correspond de maniere fiable au post ({details}).",
        attempts,
    )


class MediaSelectionError(RuntimeError):
    def __init__(self, message: str, attempts: list[dict[str, Any]]) -> None:
        super().__init__(message)
        self.attempts = attempts


def close_enough(actual: float, expected: float) -> bool:
    return abs(actual - expected) <= max(2.0, expected * 0.15)


def validate_downloaded_media(
    media_candidate: dict[str, Any],
    media_details: dict[str, Any],
) -> tuple[bool, dict[str, Any]]:
    checks: dict[str, bool] = {}
    actual_width = media_details.get("width")
    actual_height = media_details.get("height")
    expected_width = media_candidate.get("width")
    expected_height = media_candidate.get("height")
    if all(
        isinstance(value, (int, float))
        for value in (actual_width, actual_height, expected_width, expected_height)
    ):
        checks["dimensions_match_post"] = (actual_width, actual_height) in {
            (expected_width, expected_height),
            (expected_height, expected_width),
        }

    actual_duration = media_details.get("duration_seconds")
    expected_duration = media_candidate.get("duration_seconds")
    if isinstance(actual_duration, (int, float)) and isinstance(
        expected_duration, (int, float)
    ):
        checks["duration_matches_post"] = close_enough(actual_duration, expected_duration)

    structured = str(media_candidate.get("source", "")).startswith("structured:")
    has_audio = media_details.get("has_audio") is True
    if structured and checks:
        accepted = all(checks.values())
        reason = "correspond aux metadonnees structurees du post"
    elif structured:
        accepted = has_audio
        reason = "candidat structure confirme par une piste audio" if has_audio else "candidat structure non verifiable"
    else:
        accepted = has_audio
        reason = "candidat de repli confirme par une piste audio" if has_audio else "flux de repli sans audio refuse"

    return accepted, {
        "structured_candidate": structured,
        "checks": checks,
        "has_audio": media_details.get("has_audio"),
        "decision": reason,
    }


def rank_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_url: dict[str, dict[str, Any]] = {}
    for media_candidate in candidates:
        url = media_candidate.get("url")
        if not isinstance(url, str) or not is_safe_https_url(url):
            continue
        previous = by_url.get(url)
        if previous is None or media_candidate.get("trust", 0) > previous.get("trust", 0):
            by_url[url] = media_candidate

    def sort_key(media_candidate: dict[str, Any]) -> tuple[float, float, float]:
        width = media_candidate.get("width") or 0
        height = media_candidate.get("height") or 0
        return (
            float(media_candidate.get("trust") or 0),
            float(width * height),
            float(media_candidate.get("bit_rate") or 0),
        )

    return sorted(by_url.values(), key=sort_key, reverse=True)


async def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: download_with_browser.py <URL_TIKTOK> <DOSSIER_SORTIE>", 64)

    source_url = sys.argv[1]
    output_dir = Path(sys.argv[2])
    response_candidates: list[dict[str, Any]] = []
    monitor = RUN_MONITOR

    def observe_response(response: Response) -> None:
        content_type = response.headers.get("content-type", "")
        if is_media_url(response.url, content_type) and is_safe_https_url(response.url):
            response_candidates.append(
                browser_candidate(response.url, "network:video-response", 20)
            )

    async def block_fonts(route: Route) -> None:
        if route.request.resource_type == "font":
            await route.abort()
        else:
            await route.continue_()

    async with async_playwright() as playwright:
        chromium_path = os.environ.get("CHROMIUM_EXECUTABLE_PATH", "").strip()
        if not chromium_path or not Path(chromium_path).is_file():
            fail("l'executable Chromium local configure est introuvable.")

        browser = await playwright.chromium.launch(
            headless=True,
            executable_path=chromium_path,
            args=["--disable-dev-shm-usage"],
        )
        chromium_version = browser.version
        user_agent = (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{chromium_version} Safari/537.36"
        )
        context = await browser.new_context(
            locale="fr-FR",
            timezone_id="Europe/Paris",
            user_agent=user_agent,
            viewport={"width": 1280, "height": 900},
            extra_http_headers={"Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"},
        )
        page = await context.new_page()
        page.on("response", observe_response)
        await page.route("**/*", block_fonts)

        main_response_status: int | None = None
        navigation_error: Exception | None = None

        try:
            try:
                main_response = await page.goto(
                    source_url,
                    wait_until="domcontentloaded",
                    timeout=NAVIGATION_TIMEOUT_MS,
                )
                main_response_status = main_response.status if main_response else None
            except Exception as error:
                # Une navigation peut expirer alors que le lecteur et son flux sont déjà chargés.
                navigation_error = error

            final_page_url = page.url
            resolved_video_id = video_id_from_url(final_page_url)
            if resolved_video_id == "browser":
                resolved_video_id = video_id_from_url(source_url)
            structured_candidates, fallback_candidates, structured_diagnostics = (
                await wait_for_media_candidates(
                    page,
                    resolved_video_id,
                    response_candidates,
                )
            )
            candidates = rank_candidates(structured_candidates + fallback_candidates)
            if not candidates:
                details = f" Navigation : {navigation_error}" if navigation_error else ""
                raise RuntimeError(f"aucun flux video detecte en 30 secondes.{details}")

            cookies = await context.cookies()
        except Exception as error:
            diagnostics_path, screenshot_path = await write_failure_diagnostics(
                page,
                output_dir,
                error,
                response_candidates,
                main_response_status,
                source_url,
                monitor,
            )
            screenshot_note = f" Capture : {screenshot_path}." if screenshot_path else ""
            fail(
                f"Chromium n'a pas trouve de video ({error}). "
                f"Diagnostic : {diagnostics_path}.{screenshot_note}"
            )
        finally:
            await browser.close()

    video_id = resolved_video_id if resolved_video_id != "browser" else "tiktok-video"

    cookie_header = "; ".join(
        f"{cookie['name']}={cookie['value']}" for cookie in cookies
    )
    request_headers = {
        "User-Agent": str(user_agent),
        "Referer": final_page_url,
        "Accept": "video/*,*/*;q=0.8",
    }
    if cookie_header:
        request_headers["Cookie"] = cookie_header

    output_dir.mkdir(parents=True, exist_ok=True)
    video_path = output_dir / f"{video_id}.mp4"
    metadata_path = output_dir / f"{video_id}.info.json"
    try:
        content_type, size, media_details, selected_candidate, candidate_attempts = (
            download_media(candidates, request_headers, video_path)
        )
    except Exception as error:
        resource_usage = monitor.finish()
        failure_path = output_dir / f"{video_id}.failure.json"
        candidate_attempts = error.attempts if isinstance(error, MediaSelectionError) else []
        failure_path.write_text(
            json.dumps(
                {
                    "error_type": type(error).__name__,
                    "error": str(error),
                    "source_url": source_url,
                    "video_id": video_id,
                    "page_url": final_page_url,
                    "structured_data": structured_diagnostics,
                    "candidate_count": len(candidates),
                    "candidate_attempts": candidate_attempts,
                    "download_duration_seconds": resource_usage["wall_time_seconds"],
                    "resource_usage": resource_usage,
                    "failed_at": datetime.now(UTC).isoformat(),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        fail(f"{error} Diagnostic : {failure_path}")

    resource_usage = monitor.finish()

    metadata = {
        "source_url": source_url,
        "resolved_tiktok_url": final_page_url,
        "video_id": video_id,
        "content_type": content_type,
        "size_bytes": size,
        "candidate_count": len(candidates),
        "structured_data": structured_diagnostics,
        "selected_candidate": selected_candidate,
        "candidate_attempts": candidate_attempts,
        "width": media_details.get("width"),
        "height": media_details.get("height"),
        "has_audio": media_details.get("has_audio"),
        "media_duration_seconds": media_details.get("duration_seconds"),
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


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, socket.timeout):
        fail("operation interrompue ou expiree.")
