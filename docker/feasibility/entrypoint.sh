#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  docker compose run --rm tiktok-downloader yt-dlp <URL_TIKTOK>
  docker compose run --rm tiktok-downloader browser <URL_TIKTOK>
  docker compose run --rm tiktok-downloader compare <URL_TIKTOK_OU_ID>

Les fichiers sont ecrits dans :
  downloads/yt-dlp/
  downloads/browser/
  downloads/comparison/
EOF
}

if [ "$#" -ne 2 ]; then
  usage >&2
  exit 64
fi

method="$1"
value="$2"

case "$method" in
  yt-dlp)
    case "$value" in
      https://www.tiktok.com/*|https://m.tiktok.com/*|https://vm.tiktok.com/*|https://vt.tiktok.com/*) ;;
      *) echo "Erreur : une URL HTTPS TikTok publique est attendue." >&2; exit 64 ;;
    esac
    exec python3 /app/download_with_ytdlp.py "$value" /downloads/yt-dlp
    ;;
  browser)
    case "$value" in
      https://www.tiktok.com/*|https://m.tiktok.com/*|https://vm.tiktok.com/*|https://vt.tiktok.com/*) ;;
      *) echo "Erreur : une URL HTTPS TikTok publique est attendue." >&2; exit 64 ;;
    esac
    exec python3 /app/download_with_browser.py "$value" /downloads/browser
    ;;
  compare)
    exec python3 /app/compare_downloads.py "$value" /downloads
    ;;
  *)
    echo "Erreur : methode inconnue '$method'." >&2
    usage >&2
    exit 64
    ;;
esac
