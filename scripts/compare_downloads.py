#!/usr/bin/env python3
"""Compare result quality and resource usage for two TikTok download methods."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import textwrap
from pathlib import Path
from typing import Any

from media_inspection import inspect_mp4

METHODS = ("yt-dlp", "browser")
SCORE_WEIGHTS = {
    "result": 40,
    "speed": 25,
    "cpu": 20,
    "memory": 10,
    "disk_io": 5,
}


def fail(message: str, exit_code: int = 1) -> None:
    print(f"Erreur : {message}", file=sys.stderr)
    raise SystemExit(exit_code)


def extract_video_id(value: str) -> str:
    if re.fullmatch(r"\d+", value):
        return value
    match = re.search(r"/video/(\d+)", value)
    if match:
        return match.group(1)
    fail("fournis un identifiant numerique TikTok ou une URL contenant /video/<id>.", 64)


def read_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def number(value: Any) -> float | int | None:
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def find_video(directory: Path, video_id: str) -> Path | None:
    excluded_suffixes = {".json", ".part", ".png"}
    candidates = [
        path
        for path in directory.glob(f"{video_id}.*")
        if path.is_file()
        and ".candidate-" not in path.name
        and path.suffix.lower() not in excluded_suffixes
        and path.stat().st_size > 0
    ]
    return max(candidates, key=lambda path: path.stat().st_mtime) if candidates else None


def method_result(method: str, root: Path, video_id: str) -> dict[str, Any]:
    directory = root / method
    metadata_path = directory / f"{video_id}.info.json"
    failure_path = directory / f"{video_id}.failure.json"
    metadata = read_json(metadata_path)
    failure = read_json(failure_path)
    video_path = find_video(directory, video_id)
    success_mtime = max(
        (path.stat().st_mtime for path in (video_path, metadata_path) if path and path.is_file()),
        default=0.0,
    )
    latest_attempt_failed = failure_path.is_file() and failure_path.stat().st_mtime > success_mtime
    if latest_attempt_failed:
        video_path = None
        metadata = {}
    media = inspect_mp4(video_path) if video_path else {}
    browser_attempts = metadata.get("candidate_attempts")
    browser_verified = (
        isinstance(metadata.get("selected_candidate"), dict)
        and isinstance(browser_attempts, list)
        and any(
            isinstance(attempt, dict) and attempt.get("accepted") is True
            for attempt in browser_attempts
        )
    )
    result_verified = method == "yt-dlp" or browser_verified

    if method == "yt-dlp":
        feasibility = metadata.get("_feasibility", {})
        feasibility = feasibility if isinstance(feasibility, dict) else {}
        width = media.get("width") or metadata.get("width")
        height = media.get("height") or metadata.get("height")
        has_audio = media.get("has_audio")
        if has_audio is None and metadata:
            acodec = metadata.get("acodec")
            has_audio = bool(acodec and acodec != "none")
        duration = feasibility.get("download_duration_seconds")
        resource_usage = feasibility.get("resource_usage")
    else:
        width = media.get("width") or metadata.get("width")
        height = media.get("height") or metadata.get("height")
        has_audio = media.get("has_audio")
        if has_audio is None:
            has_audio = metadata.get("has_audio")
        duration = metadata.get("download_duration_seconds")
        resource_usage = metadata.get("resource_usage")

    if latest_attempt_failed and failure:
        resource_usage = failure.get("resource_usage")
        duration = failure.get("download_duration_seconds")
        if duration is None and isinstance(resource_usage, dict):
            duration = resource_usage.get("wall_time_seconds")

    resources = resource_usage if isinstance(resource_usage, dict) else {}
    size_bytes = video_path.stat().st_size if video_path else None
    cpu_seconds = number(resources.get("cpu_time_seconds"))
    size_mib = size_bytes / (1024 * 1024) if size_bytes else None
    success = video_path is not None and result_verified
    error = failure.get("error") if latest_attempt_failed else None
    if video_path is not None and not result_verified:
        error = "ancien résultat navigateur non validé ; relancer la méthode"
    return {
        "success": success,
        "result_verified": result_verified,
        "file": str(video_path) if video_path else None,
        "size_bytes": size_bytes,
        "width": width,
        "height": height,
        "has_audio": has_audio,
        "watermark": "manual_check_required" if success else "not_applicable",
        "download_duration_seconds": number(duration),
        "resource_usage": resources or None,
        "cpu_seconds_per_output_mib": round(cpu_seconds / size_mib, 3)
        if cpu_seconds is not None and size_mib
        else None,
        "metadata_file": str(metadata_path) if metadata_path.is_file() else None,
        "failure_file": str(failure_path) if latest_attempt_failed else None,
        "error": error,
    }


def resource_value(result: dict[str, Any], key: str) -> float | int | None:
    resources = result.get("resource_usage")
    return number(resources.get(key)) if isinstance(resources, dict) else None


def quality_factor(result: dict[str, Any], maximum_pixels: int | None) -> float:
    if not result["success"]:
        return 0.0
    factor = 0.6
    factor += 0.2 if result["has_audio"] is True else 0.1 if result["has_audio"] is None else 0.0
    pixels = (
        result["width"] * result["height"]
        if isinstance(result["width"], int) and isinstance(result["height"], int)
        else None
    )
    factor += 0.2 * pixels / maximum_pixels if pixels and maximum_pixels else 0.1
    return min(factor, 1.0)


def lower_is_better_factors(values: dict[str, float | int]) -> dict[str, float]:
    best = min(values.values())
    if best == 0:
        return {method: 1.0 if value == 0 else 0.0 for method, value in values.items()}
    return {method: best / value for method, value in values.items()}


def build_comparison(methods: dict[str, dict[str, Any]]) -> dict[str, Any]:
    pixels = [
        result["width"] * result["height"]
        for result in methods.values()
        if result["success"]
        and isinstance(result["width"], int)
        and isinstance(result["height"], int)
    ]
    maximum_pixels = max(pixels) if pixels else None
    category_values: dict[str, dict[str, float | int]] = {
        "result": {method: quality_factor(result, maximum_pixels) for method, result in methods.items()}
    }
    metric_sources = {
        "speed": lambda result: number(result["download_duration_seconds"]),
        "cpu": lambda result: resource_value(result, "cpu_time_seconds"),
        "memory": lambda result: resource_value(result, "peak_memory_bytes"),
        "disk_io": lambda result: (
            resource_value(result, "io_read_bytes") + resource_value(result, "io_write_bytes")
            if resource_value(result, "io_read_bytes") is not None
            and resource_value(result, "io_write_bytes") is not None
            else None
        ),
    }
    omitted_categories: list[str] = []
    for category, extractor in metric_sources.items():
        values = {method: extractor(result) for method, result in methods.items()}
        if all(value is not None for value in values.values()):
            category_values[category] = values  # type: ignore[assignment]
        else:
            omitted_categories.append(category)

    factors = {"result": category_values["result"]}
    for category in metric_sources:
        if category in category_values:
            factors[category] = lower_is_better_factors(category_values[category])

    active_weight = sum(SCORE_WEIGHTS[category] for category in factors)
    scores: dict[str, Any] = {}
    for method in METHODS:
        details = {
            category: {
                "weight": SCORE_WEIGHTS[category],
                "factor": round(values[method], 4),
                "points_before_normalization": round(SCORE_WEIGHTS[category] * values[method], 3),
            }
            for category, values in factors.items()
        }
        points = sum(item["points_before_normalization"] for item in details.values())
        scores[method] = {
            "score_out_of_100": round(points / active_weight * 100, 1)
            if methods[method]["success"]
            else 0.0,
            "details": details,
        }

    successes = [method for method, result in methods.items() if result["success"]]
    if len(successes) == 1:
        recommended_method = successes[0]
        verdict = f"{successes[0]} est retenu : c'est la seule méthode ayant réussi."
    elif not successes:
        recommended_method = None
        verdict = "Aucune méthode n'a réussi ; aucun choix fiable n'est possible."
    else:
        comparable_metrics = {
            "result": {method: category_values["result"][method] for method in METHODS},
            "file_size": {method: number(methods[method]["size_bytes"]) for method in METHODS},
            "duration": {method: number(methods[method]["download_duration_seconds"]) for method in METHODS},
            "cpu": {method: resource_value(methods[method], "cpu_time_seconds") for method in METHODS},
            "average_cpu": {
                method: resource_value(methods[method], "average_cpu_percent")
                for method in METHODS
            },
            "memory": {method: resource_value(methods[method], "peak_memory_bytes") for method in METHODS},
            "disk_read": {
                method: resource_value(methods[method], "io_read_bytes")
                for method in METHODS
            },
            "disk_write": {
                method: resource_value(methods[method], "io_write_bytes")
                for method in METHODS
            },
            "cpu_per_output": {
                method: number(methods[method]["cpu_seconds_per_output_mib"])
                for method in METHODS
            },
        }
        usable = {
            metric: values
            for metric, values in comparable_metrics.items()
            if all(value is not None for value in values.values())
        }
        dominant = None
        for candidate in METHODS:
            other = METHODS[1] if candidate == METHODS[0] else METHODS[0]
            no_worse = all(
                values[candidate] >= values[other]
                if metric == "result"
                else values[candidate] <= values[other]
                for metric, values in usable.items()
            )
            strictly_better = any(
                values[candidate] > values[other]
                if metric == "result"
                else values[candidate] < values[other]
                for metric, values in usable.items()
            )
            if usable and no_worse and strictly_better:
                dominant = candidate
                break
        recommended_method = dominant
        verdict = (
            f"{dominant} domine sur tous les indicateurs comparables, résultat inclus."
            if dominant
            else "Aucune méthode ne domine : le choix dépend du compromis qualité/vitesse/consommation."
        )

    weighted_winner = (
        max(successes, key=lambda method: scores[method]["score_out_of_100"])
        if successes
        else None
    )
    return {
        "score_status": "complete" if not omitted_categories else "partial",
        "weights": SCORE_WEIGHTS,
        "omitted_categories": omitted_categories,
        "scores": scores,
        "weighted_winner": weighted_winner,
        "recommended_method_by_success_and_dominance": recommended_method,
        "verdict": verdict,
    }


def human_size(value: int | float | None) -> str:
    if value is None:
        return "—"
    size = float(value)
    for unit in ("o", "Kio", "Mio", "Gio"):
        if size < 1024 or unit == "Gio":
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{value} o"


def display_bool(value: bool | None) -> str:
    return "oui" if value is True else "non" if value is False else "inconnu"


def display_resolution(result: dict[str, Any]) -> str:
    width, height = result.get("width"), result.get("height")
    return f"{width}×{height}" if width and height else "inconnue"


def display_seconds(value: Any) -> str:
    return f"{float(value):.3f} s" if number(value) is not None else "indisponible (relancer)"


def display_percent(value: Any) -> str:
    return f"{float(value):.1f} %" if number(value) is not None else "indisponible (relancer)"


def comparison_label(methods: dict[str, dict[str, Any]], extractor) -> str:
    values = {method: extractor(result) for method, result in methods.items()}
    if not all(value is not None for value in values.values()):
        return "comparaison impossible"
    winner = min(values, key=values.get)
    return f"plus faible : {winner}"


def terminal_color_enabled() -> bool:
    if "NO_COLOR" in os.environ:
        return False
    return os.environ.get("FORCE_COLOR") == "1" or (
        sys.stdout.isatty() and os.environ.get("TERM", "") != "dumb"
    )


def numeric_winners(
    first: Any,
    second: Any,
    *,
    higher_is_better: bool,
) -> tuple[bool, bool]:
    first_number = number(first)
    second_number = number(second)
    if first_number is None or second_number is None:
        return False, False
    best = max(first_number, second_number) if higher_is_better else min(first_number, second_number)
    return first_number == best, second_number == best


def success_winners(first: bool, second: bool) -> tuple[bool, bool]:
    if first and second:
        return True, True
    return first, second


def audio_winners(first: bool | None, second: bool | None) -> tuple[bool, bool]:
    if first is True and second is True:
        return True, True
    return first is True, second is True


def resolution_pixels(result: dict[str, Any]) -> int | None:
    width = result.get("width")
    height = result.get("height")
    return width * height if isinstance(width, int) and isinstance(height, int) else None


def terminal_seconds(value: Any) -> str:
    return f"{float(value):.3f} s" if number(value) is not None else "—"


def terminal_percent(value: Any) -> str:
    return f"{float(value):.1f} %" if number(value) is not None else "—"


def build_terminal_report(
    video_id: str,
    methods: dict[str, dict[str, Any]],
    comparison: dict[str, Any],
    markdown_path: Path,
    json_path: Path,
) -> str:
    ytdlp = methods["yt-dlp"]
    browser = methods["browser"]
    color_enabled = terminal_color_enabled()
    terminal_width = max(80, min(shutil.get_terminal_size((100, 24)).columns, 120))
    criterion_width = 31
    value_width = 20
    separator = "─" * min(terminal_width, criterion_width + (value_width * 2) + 4)

    reset = "\033[0m"
    bold = "\033[1m"
    cyan = "\033[1;36m"
    green = "\033[1;32m"

    def styled(text: str, style: str) -> str:
        return f"{style}{text}{reset}" if color_enabled else text

    def cell(value: str, is_best: bool) -> str:
        padded = f"{value:<{value_width}}"
        return styled(padded, green) if is_best else padded

    def section(
        title: str,
        rows: list[tuple[str, str, str, tuple[bool, bool]]],
    ) -> list[str]:
        rendered = [styled(title, cyan)]
        rendered.append(
            f"{'Critère':<{criterion_width}}  {'yt-dlp':<{value_width}}  {'navigateur':<{value_width}}"
        )
        rendered.append(separator)
        for label, first, second, winners in rows:
            rendered.append(
                f"{label:<{criterion_width}}  {cell(first, winners[0])}  {cell(second, winners[1])}"
            )
        return rendered

    disk_total = lambda result: (
        resource_value(result, "io_read_bytes") + resource_value(result, "io_write_bytes")
        if resource_value(result, "io_read_bytes") is not None
        and resource_value(result, "io_write_bytes") is not None
        else None
    )
    result_rows = [
        (
            "Résultat validé",
            "oui" if ytdlp["success"] else "non",
            "oui" if browser["success"] else "non",
            success_winners(ytdlp["success"], browser["success"]),
        ),
        (
            "Taille fichier (stockage)",
            human_size(ytdlp["size_bytes"]),
            human_size(browser["size_bytes"]),
            numeric_winners(ytdlp["size_bytes"], browser["size_bytes"], higher_is_better=False),
        ),
        (
            "Résolution",
            display_resolution(ytdlp),
            display_resolution(browser),
            numeric_winners(
                resolution_pixels(ytdlp),
                resolution_pixels(browser),
                higher_is_better=True,
            ),
        ),
        (
            "Piste audio",
            display_bool(ytdlp["has_audio"]),
            display_bool(browser["has_audio"]),
            audio_winners(ytdlp["has_audio"], browser["has_audio"]),
        ),
        (
            "Filigrane",
            "à vérifier" if ytdlp["success"] else "—",
            "à vérifier" if browser["success"] else "—",
            (False, False),
        ),
    ]

    performance_specs = [
        (
            "Temps réel",
            ytdlp["download_duration_seconds"],
            browser["download_duration_seconds"],
            terminal_seconds,
        ),
        (
            "Temps CPU (proxy énergie)",
            resource_value(ytdlp, "cpu_time_seconds"),
            resource_value(browser, "cpu_time_seconds"),
            terminal_seconds,
        ),
        (
            "CPU moyen (100 % = 1 cœur)",
            resource_value(ytdlp, "average_cpu_percent"),
            resource_value(browser, "average_cpu_percent"),
            terminal_percent,
        ),
        (
            "Pic mémoire",
            resource_value(ytdlp, "peak_memory_bytes"),
            resource_value(browser, "peak_memory_bytes"),
            human_size,
        ),
        (
            "Lectures disque",
            resource_value(ytdlp, "io_read_bytes"),
            resource_value(browser, "io_read_bytes"),
            human_size,
        ),
        (
            "Écritures disque",
            resource_value(ytdlp, "io_write_bytes"),
            resource_value(browser, "io_write_bytes"),
            human_size,
        ),
        ("I/O disque total", disk_total(ytdlp), disk_total(browser), human_size),
        (
            "CPU par Mio produit",
            ytdlp["cpu_seconds_per_output_mib"],
            browser["cpu_seconds_per_output_mib"],
            terminal_seconds,
        ),
    ]
    performance_rows = [
        (
            label,
            formatter(first),
            formatter(second),
            numeric_winners(first, second, higher_is_better=False),
        )
        for label, first, second, formatter in performance_specs
    ]

    first_score = comparison["scores"]["yt-dlp"]["score_out_of_100"]
    second_score = comparison["scores"]["browser"]["score_out_of_100"]
    score_rows = [
        (
            "Score indicatif / 100",
            f"{first_score:.1f}",
            f"{second_score:.1f}",
            numeric_winners(first_score, second_score, higher_is_better=True),
        )
    ]

    lines = [styled("COMPARAISON TIKTOK", bold), f"Vidéo : {video_id}", separator, ""]
    lines.extend(section("QUALITÉ DU RÉSULTAT", result_rows))
    lines.append("")
    lines.extend(section("PERFORMANCES", performance_rows))
    lines.append("")
    lines.extend(section("ÉVALUATION", score_rows))
    lines.append("")

    verdict = comparison["verdict"].replace("browser", "navigateur")
    lines.append(styled("CONCLUSION", cyan))
    lines.extend(textwrap.wrap(verdict, width=terminal_width, initial_indent="  ", subsequent_indent="  "))

    weighted_winner = comparison["weighted_winner"]
    if weighted_winner:
        weighted_winner = weighted_winner.replace("browser", "navigateur")
        lines.append(f"  Meilleur score pondéré : {weighted_winner}")

    score_status = "complet"
    if comparison["score_status"] != "complete":
        omitted_names = {
            "speed": "vitesse",
            "cpu": "CPU",
            "memory": "mémoire",
            "disk_io": "I/O disque",
        }
        omitted = ", ".join(
            omitted_names.get(category, category)
            for category in comparison["omitted_categories"]
        )
        score_status = f"partiel — données absentes : {omitted}"
    lines.append(f"  Score : {score_status}")
    lines.append(
        "  Pondération : résultat 40 %, vitesse 25 %, CPU 20 %, mémoire 10 %, I/O disque 5 %."
    )
    lines.append("")
    lines.append(styled("NOTES", cyan))
    notes = (
        "Le temps CPU est un proxy de consommation, pas une mesure électrique. "
        "Le filigrane doit être contrôlé visuellement. Pour une comparaison plus fiable, "
        "répéter chaque méthode dans des conditions comparables."
    )
    lines.extend(textwrap.wrap(notes, width=terminal_width, initial_indent="  ", subsequent_indent="  "))
    lines.append("")
    lines.append(styled("RAPPORTS ENREGISTRÉS", cyan))
    lines.append(f"  Texte : {markdown_path}")
    lines.append(f"  JSON  : {json_path}")
    return "\n".join(lines)


def build_markdown(
    video_id: str,
    methods: dict[str, dict[str, Any]],
    comparison: dict[str, Any],
) -> str:
    ytdlp = methods["yt-dlp"]
    browser = methods["browser"]
    both_succeeded = ytdlp["success"] and browser["success"]
    if both_succeeded and ytdlp["size_bytes"]:
        difference = browser["size_bytes"] - ytdlp["size_bytes"]
        size_comparison = f"écart navigateur : {difference / ytdlp['size_bytes']:+.1%}"
    else:
        size_comparison = "comparaison impossible"

    same_resolution = (
        both_succeeded
        and ytdlp["width"]
        and ytdlp["height"]
        and (ytdlp["width"], ytdlp["height"]) == (browser["width"], browser["height"])
    )
    get_resource = lambda key: lambda result: resource_value(result, key)
    get_disk_total = lambda result: (
        resource_value(result, "io_read_bytes") + resource_value(result, "io_write_bytes")
        if resource_value(result, "io_read_bytes") is not None
        and resource_value(result, "io_write_bytes") is not None
        else None
    )
    omitted = ", ".join(comparison["omitted_categories"]) or "aucune"
    score_note = "complet" if comparison["score_status"] == "complete" else f"partiel ; catégories omises : {omitted}"

    lines = [
        f"# Comparaison TikTok — {video_id}",
        "",
        "| Critère | yt-dlp | navigateur | Comparaison |",
        "|---|---:|---:|---|",
        f"| Réussite | {'oui' if ytdlp['success'] else 'non'} | {'oui' if browser['success'] else 'non'} | {'deux méthodes opérationnelles' if both_succeeded else 'au moins une méthode en échec'} |",
        f"| Taille | {human_size(ytdlp['size_bytes'])} | {human_size(browser['size_bytes'])} | {size_comparison} |",
        f"| Résolution | {display_resolution(ytdlp)} | {display_resolution(browser)} | {'identique' if same_resolution else 'différente ou inconnue'} |",
        f"| Audio | {display_bool(ytdlp['has_audio'])} | {display_bool(browser['has_audio'])} | {'présent dans les deux' if ytdlp['has_audio'] is True and browser['has_audio'] is True else 'à examiner'} |",
        f"| Filigrane | {'à vérifier' if ytdlp['success'] else '—'} | {'à vérifier' if browser['success'] else '—'} | contrôle visuel obligatoire |",
        f"| Temps réel | {display_seconds(ytdlp['download_duration_seconds'])} | {display_seconds(browser['download_duration_seconds'])} | {comparison_label(methods, lambda result: number(result['download_duration_seconds']))} |",
        f"| Temps CPU (proxy énergie) | {display_seconds(resource_value(ytdlp, 'cpu_time_seconds'))} | {display_seconds(resource_value(browser, 'cpu_time_seconds'))} | {comparison_label(methods, get_resource('cpu_time_seconds'))} |",
        f"| CPU moyen (100 % = 1 cœur) | {display_percent(resource_value(ytdlp, 'average_cpu_percent'))} | {display_percent(resource_value(browser, 'average_cpu_percent'))} | {comparison_label(methods, get_resource('average_cpu_percent'))} |",
        f"| Pic mémoire | {human_size(resource_value(ytdlp, 'peak_memory_bytes'))} | {human_size(resource_value(browser, 'peak_memory_bytes'))} | {comparison_label(methods, get_resource('peak_memory_bytes'))} |",
        f"| Lectures disque | {human_size(resource_value(ytdlp, 'io_read_bytes'))} | {human_size(resource_value(browser, 'io_read_bytes'))} | {comparison_label(methods, get_resource('io_read_bytes'))} |",
        f"| Écritures disque | {human_size(resource_value(ytdlp, 'io_write_bytes'))} | {human_size(resource_value(browser, 'io_write_bytes'))} | {comparison_label(methods, get_resource('io_write_bytes'))} |",
        f"| I/O disque total | {human_size(get_disk_total(ytdlp))} | {human_size(get_disk_total(browser))} | {comparison_label(methods, get_disk_total)} |",
        f"| CPU par Mio produit | {display_seconds(ytdlp['cpu_seconds_per_output_mib'])} | {display_seconds(browser['cpu_seconds_per_output_mib'])} | {comparison_label(methods, lambda result: number(result['cpu_seconds_per_output_mib']))} |",
        f"| Score indicatif /100 | {comparison['scores']['yt-dlp']['score_out_of_100']:.1f} | {comparison['scores']['browser']['score_out_of_100']:.1f} | gagnant pondéré : {comparison['weighted_winner'] or 'aucun'} ({score_note}) |",
        "",
        f"**Conclusion factuelle :** {comparison['verdict']}",
        "",
        "Le score indicatif pondère le résultat à 40 %, la vitesse à 25 %, le temps CPU à 20 %, la mémoire à 10 % et les I/O disque à 5 %. Dans la note de résultat, la réussite vaut 60 %, l'audio 20 % et la résolution relative 20 %. Une catégorie indisponible est retirée pour les deux méthodes, puis le score est renormalisé. Une méthode en échec reçoit un score global nul, même si sa consommation avant échec était faible.",
        "",
        "> Le temps CPU est un proxy de consommation, pas une mesure électrique en watts ou en joules. Le filigrane exige un contrôle visuel. Répéter idéalement chaque méthode au moins trois fois, sur la même machine et dans des conditions réseau comparables.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: compare_downloads.py <URL_TIKTOK_OU_ID> <DOSSIER_DOWNLOADS>", 64)

    video_id = extract_video_id(sys.argv[1])
    root = Path(sys.argv[2])
    methods = {method: method_result(method, root, video_id) for method in METHODS}
    comparison = build_comparison(methods)
    report = {"video_id": video_id, "methods": methods, "comparison": comparison}

    output_dir = root / "comparison"
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / f"{video_id}.json"
    markdown_path = output_dir / f"{video_id}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    markdown = build_markdown(video_id, methods, comparison)
    markdown_path.write_text(markdown, encoding="utf-8")

    print(
        build_terminal_report(
            video_id,
            methods,
            comparison,
            markdown_path,
            json_path,
        )
    )


if __name__ == "__main__":
    main()
