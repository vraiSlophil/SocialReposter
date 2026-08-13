# Zernio publication proof of concept

This is a small operational POC for the Zernio intermediary workflow. It requires Node.js 20+ and has no runtime dependencies. It deliberately does not load `.env`; export the key in the shell that runs the command:

```sh
export ZENRIO_API_KEY='replace-with-your-zernio-key'
```

The stages are intentionally separate:

```sh
# 1. Inspect connected Instagram and YouTube accounts (safe, read-only)
npm run help
node src/cli.mjs accounts

# 2. Upload a local MP4. The command prints only the reusable public URL.
node src/cli.mjs upload /path/to/video.mp4

# 3. Validate content and media without publishing anything.
node src/cli.mjs validate \
  --media-url 'https://media.example/video.mp4' \
  --caption 'Caption shared to Instagram and YouTube description' \
  --youtube-title 'POC video'

# Validate one platform without supplying YouTube metadata.
node src/cli.mjs validate \
  --platform instagram \
  --media-url 'https://media.example/video.mp4' \
  --caption 'Instagram-only caption'

# A YouTube target always requires a non-empty title.
node src/cli.mjs validate \
  --platform youtube \
  --media-url 'https://media.example/video.mp4' \
  --youtube-title 'YouTube-only title'

# Optional explicit account IDs and YouTube settings:
node src/cli.mjs validate \
  --media-url 'https://media.example/video.mp4' \
  --youtube-title 'POC video' \
  --instagram-account-id 'instagram-account-id' \
  --youtube-account-id 'youtube-account-id' \
  --youtube-visibility private \
  --made-for-kids

# 4. Publish immediately. The exact confirmation is mandatory.
node src/cli.mjs publish \
  --media-url 'https://media.example/video.mp4' \
  --caption 'Caption' \
  --youtube-title 'POC video' \
  --confirm PUBLISH

# Publish to one connected Instagram account without supplying its account ID.
node src/cli.mjs publish \
  --platform instagram \
  --media-url 'https://media.example/video.mp4' \
  --caption 'Instagram-only caption' \
  --confirm PUBLISH

# Publish to one connected YouTube account without supplying its account ID.
node src/cli.mjs publish \
  --platform youtube \
  --media-url 'https://media.example/video.mp4' \
  --youtube-title 'YouTube-only title' \
  --confirm PUBLISH

# 5. Poll a returned Zernio post ID.
node src/cli.mjs status 'zernio-post-id'
```

`validate` calls only Zernio’s media and content-validation tools. It is content-only: it does not publish, verify actual media duration, validate account permissions, or prove that a platform account can accept the upload. Instagram publication is public; Instagram has no private visibility option. YouTube defaults to `private` in this POC. Publishing is the only command that calls `POST /api/v1/posts`, and it sends a fresh UUID `x-request-id` for that publication attempt.

Use `--platform instagram` or `--platform youtube` to select exactly one publication target. A YouTube target requires `--youtube-title` (or `--title`); an Instagram-only target does not. When `publish` has no `--platform`, it makes one `/accounts` request, discovers each connected supported platform with one unambiguous account, skips platforms with no match, and rejects ambiguous or empty selections. It then requires a YouTube title only when YouTube is among the resolved targets. Explicit account IDs are used directly, but an account ID for the other platform is rejected when `--platform` selects one platform.

Do not paste API keys or signed upload URLs into tickets or logs. The CLI reports connected account metadata, redacts sensitive error fields, and never prints the presigned `uploadUrl`.

Run the local tests with:

```sh
npm test
```
