ARG BASE_IMAGE=unclecode/crawl4ai:0.9.0
FROM ${BASE_IMAGE}

ARG YT_DLP_VERSION

USER root

RUN python3 -m pip install --no-cache-dir "yt-dlp==${YT_DLP_VERSION}"

ENV CHROMIUM_EXECUTABLE_PATH=/home/appuser/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome \
    HOME=/tmp

WORKDIR /app

COPY --chmod=755 docker/feasibility/entrypoint.sh /app/entrypoint.sh
COPY scripts/download_with_browser.py /app/download_with_browser.py
COPY scripts/download_with_ytdlp.py /app/download_with_ytdlp.py
COPY scripts/compare_downloads.py /app/compare_downloads.py
COPY scripts/resource_metrics.py /app/resource_metrics.py
COPY scripts/media_inspection.py /app/media_inspection.py
COPY scripts/tiktok_page_candidates.py /app/tiktok_page_candidates.py

USER 1000:1000

ENTRYPOINT ["/app/entrypoint.sh"]
