#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import {
  assertPublicMediaUrl,
  buildPublicationBody,
  createZernioClient,
  extractAccounts,
  isConnectedAccount,
  sanitizeForOutput,
} from "./zernio-client.mjs";

const PLATFORMS = ["instagram", "youtube"];
const VISIBILITIES = new Set(["private", "public", "unlisted"]);

export class CliInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliInputError";
  }
}

export const HELP_TEXT = `Zernio publication proof of concept (Node.js 20+)

Staged workflow:
  1. accounts  Inspect connected Instagram and YouTube accounts.
  2. upload    Presign and upload a local MP4; print only its reusable public URL.
  3. validate  Validate media and post content only; never publishes.
  4. publish   Resolve accounts and publish immediately after --confirm PUBLISH.
  5. status    Inspect overall and per-platform publication status.

Authentication:
  export ZENRIO_API_KEY='your-key'
  The CLI reads this process environment variable only; it does not load .env.

Usage:
  node src/cli.mjs accounts
  node src/cli.mjs upload <local-video.mp4>
  node src/cli.mjs validate --media-url <public-url> --youtube-title <title> [options]
  node src/cli.mjs publish --media-url <public-url> --youtube-title <title> --confirm PUBLISH [options]
  node src/cli.mjs status <post-id>

Content options for validate/publish:
  --caption <text>                       Optional shared Instagram caption/YouTube description
  --youtube-title <text>                 Required, non-empty YouTube title (alias: --title)
  --youtube-visibility <value>           private (default), public, or unlisted
  --made-for-kids                        Set YouTube madeForKids to true (default: false)
  --instagram-account-id <id>            Optional explicit Instagram account ID
  --youtube-account-id <id>              Optional explicit YouTube account ID
  --confirm PUBLISH                      Required by publish, exact literal confirmation

Examples:
  node src/cli.mjs accounts
  node src/cli.mjs upload ./video.mp4
  node src/cli.mjs validate --media-url https://cdn.example/video.mp4 --caption 'Hello' --youtube-title 'Demo'
  node src/cli.mjs publish --media-url https://cdn.example/video.mp4 --youtube-title 'Demo' --confirm PUBLISH
  node src/cli.mjs status 65f1c0a9e2b5af0012ab34cd
`;

export async function runCli(argv, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  client,
  stdout = process.stdout,
} = {}) {
  const parsed = parseCommand(argv);
  if (parsed.help) {
    stdout.write(HELP_TEXT);
    return;
  }

  const apiKey = env?.ZENRIO_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new CliInputError("ZENRIO_API_KEY is required; export it in the shell before running the CLI.");
  }

  const zernio = client ?? createZernioClient({ apiKey, fetchImpl });
  switch (parsed.command) {
    case "accounts":
      return runAccounts(zernio, stdout, apiKey);
    case "upload":
      return runUpload(zernio, parsed.file, stdout);
    case "validate":
      return runValidate(zernio, parsed.metadata, stdout, apiKey);
    case "publish":
      return runPublish(zernio, parsed.metadata, stdout, apiKey);
    case "status":
      return runStatus(zernio, parsed.postId, stdout, apiKey);
    default:
      throw new CliInputError(`Unknown command: ${parsed.command}`);
  }
}

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { help: true };
  }

  const [command, ...tokens] = argv;
  if (!["accounts", "upload", "validate", "publish", "status"].includes(command)) {
    throw new CliInputError(`Unknown command: ${command}. Use --help for usage.`);
  }

  if (command === "accounts") {
    if (tokens.length > 0) {
      throw new CliInputError("accounts does not accept positional arguments. Use --help for usage.");
    }
    return { command };
  }

  if (command === "upload") {
    if (tokens.length !== 1 || tokens[0].startsWith("-")) {
      throw new CliInputError("upload requires exactly one local file path.");
    }
    return { command, file: tokens[0] };
  }

  if (command === "status") {
    if (tokens.length !== 1 || tokens[0].startsWith("-")) {
      throw new CliInputError("status requires exactly one post ID.");
    }
    if (tokens[0].trim() === "") {
      throw new CliInputError("status requires a non-empty post ID.");
    }
    return { command, postId: tokens[0] };
  }

  const flags = parseFlags(tokens);
  const metadata = parseMetadata(flags, command === "publish");
  return { command, metadata };
}

function parseFlags(tokens) {
  const values = new Map();
  const booleanNames = new Set(["made-for-kids"]);
  const valueNames = new Set([
    "media-url",
    "caption",
    "title",
    "youtube-title",
    "youtube-visibility",
    "instagram-account-id",
    "youtube-account-id",
    "confirm",
  ]);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      throw new CliInputError(`Unexpected positional argument: ${token}`);
    }

    const withoutPrefix = token.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    const name = equalsIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalsIndex);
    let value = equalsIndex === -1 ? undefined : withoutPrefix.slice(equalsIndex + 1);

    if (name === "help") {
      return new Map([["help", true]]);
    }
    if (!valueNames.has(name) && !booleanNames.has(name)) {
      throw new CliInputError(`Unknown option: --${name}`);
    }
    if (values.has(name)) {
      throw new CliInputError(`Option --${name} was provided more than once.`);
    }

    if (booleanNames.has(name)) {
      if (value === undefined) {
        value = true;
      } else if (!["true", "false"].includes(value.toLowerCase())) {
        throw new CliInputError(`Option --${name} expects true or false.`);
      } else {
        value = value.toLowerCase() === "true";
      }
    } else {
      if (value === undefined) {
        const next = tokens[index + 1];
        if (next === undefined || next.startsWith("--")) {
          throw new CliInputError(`Option --${name} requires a value.`);
        }
        value = next;
        index += 1;
      }
    }
    values.set(name, value);
  }

  return values;
}

function parseMetadata(flags, publishing) {
  if (flags.get("help")) {
    return { help: true };
  }

  const mediaUrl = flags.get("media-url");
  if (mediaUrl === undefined) {
    throw new CliInputError("--media-url is required.");
  }
  try {
    assertPublicMediaUrl(mediaUrl);
  } catch (error) {
    throw new CliInputError(error.message);
  }

  const title = flags.get("youtube-title") ?? flags.get("title");
  if (title === undefined || title.trim() === "") {
    throw new CliInputError("A non-empty --youtube-title (or --title) is required.");
  }
  if (flags.has("youtube-title") && flags.has("title") && flags.get("youtube-title") !== flags.get("title")) {
    throw new CliInputError("--youtube-title and --title must match when both are provided.");
  }

  const visibility = flags.get("youtube-visibility") ?? "private";
  if (!VISIBILITIES.has(visibility)) {
    throw new CliInputError("--youtube-visibility must be private, public, or unlisted.");
  }

  if (publishing && flags.get("confirm") !== "PUBLISH") {
    throw new CliInputError("Publishing requires the exact confirmation: --confirm PUBLISH");
  }

  return {
    mediaUrl,
    caption: flags.get("caption") ?? "",
    youtubeTitle: title,
    youtubeVisibility: visibility,
    youtubeMadeForKids: flags.get("made-for-kids") ?? false,
    instagramAccountId: optionalTrimmed(flags.get("instagram-account-id"), "--instagram-account-id"),
    youtubeAccountId: optionalTrimmed(flags.get("youtube-account-id"), "--youtube-account-id"),
  };
}

function optionalTrimmed(value, optionName) {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new CliInputError(`${optionName} requires a non-empty value.`);
  }
  return trimmed;
}

async function runAccounts(client, stdout, apiKey) {
  const payload = await client.listAccounts();
  const accounts = extractAccounts(payload)
    .filter((account) => PLATFORMS.includes(account?.platform) && isConnectedAccount(account))
    .map((account) => ({
      id: account._id ?? account.id ?? null,
      platform: account.platform,
      username: account.username ?? null,
      displayName: account.displayName ?? null,
      profileUrl: account.profileUrl ?? null,
      isActive: account.isActive ?? null,
    }));
  writeJson(stdout, { accounts }, apiKey);
}

async function runUpload(client, filePath, stdout) {
  const publicUrl = await client.uploadFile(filePath);
  stdout.write(`${publicUrl}\n`);
}

async function runValidate(client, metadata, stdout, apiKey) {
  const body = buildPublicationBody({ ...metadata, publishNow: false });
  const media = await client.validateMedia(metadata.mediaUrl);
  const post = await client.validatePost(body);
  writeJson(stdout, { media, post }, apiKey);
}

async function runPublish(client, metadata, stdout, apiKey) {
  const accountIds = await resolveAccountIds(client, metadata);
  const body = buildPublicationBody({ ...metadata, ...accountIds, publishNow: true });
  const result = await client.createPost(body);
  writeJson(stdout, result, apiKey);
}

async function runStatus(client, postId, stdout, apiKey) {
  const result = await client.getPost(postId);
  stdout.write(`${renderStatus(result, postId, apiKey)}\n`);
}

export async function resolveAccountIds(client, metadata) {
  const resolved = {
    instagramAccountId: metadata.instagramAccountId,
    youtubeAccountId: metadata.youtubeAccountId,
  };
  const missingPlatforms = PLATFORMS.filter((platform) => {
    return platform === "instagram" ? !resolved.instagramAccountId : !resolved.youtubeAccountId;
  });

  if (missingPlatforms.length === 0) {
    return resolved;
  }

  const accounts = extractAccounts(await client.listAccounts());
  for (const platform of missingPlatforms) {
    const matches = accounts.filter((account) => account?.platform === platform && isConnectedAccount(account));
    if (matches.length !== 1) {
      throw new CliInputError(
        `Cannot publish to ${platform}: expected exactly one connected account, found ${matches.length}. ` +
        `Pass --${platform}-account-id explicitly or fix the connected accounts.`,
      );
    }
    const accountId = matches[0]._id ?? matches[0].id;
    if (typeof accountId !== "string" || accountId.trim() === "") {
      throw new CliInputError(`Cannot publish to ${platform}: the connected account has no ID.`);
    }
    if (platform === "instagram") {
      resolved.instagramAccountId = accountId;
    } else {
      resolved.youtubeAccountId = accountId;
    }
  }

  return resolved;
}

export function renderStatus(result, requestedPostId = "unknown", apiKey = "") {
  const post = result?.post ?? result?.data?.post ?? result?.data ?? result ?? {};
  const lines = [
    `post: ${post._id ?? post.id ?? requestedPostId}`,
    `overall: ${post.status ?? "unknown"}`,
  ];
  const overallError = getTargetError(post);
  if (overallError) {
    lines.push(`error: ${formatValue(overallError, apiKey)}`);
  }

  const targets = Array.isArray(post.platforms) ? post.platforms : [];
  if (targets.length === 0) {
    lines.push("platforms: none reported");
    return lines.join("\n");
  }

  lines.push("platforms:");
  for (const target of targets) {
    lines.push(`  ${target.platform ?? "unknown"}: ${target.status ?? "unknown"}`);
    const error = getTargetError(target);
    if (error) {
      lines.push(`    error: ${formatValue(error, apiKey)}`);
    }
    const url = target.platformPostUrl ?? target.publicPostUrl ?? target.url;
    if (typeof url === "string" && url !== "") {
      lines.push(`    url: ${sanitizeForOutput(url, { apiKey })}`);
    }
  }
  return lines.join("\n");
}

function getTargetError(value) {
  return value?.errorMessage ?? value?.error ?? value?.platformError?.message ?? value?.platformError ?? null;
}

function formatValue(value, apiKey) {
  const safe = sanitizeForOutput(value, { apiKey });
  return typeof safe === "string" ? safe : JSON.stringify(safe);
}

function writeJson(stdout, value, apiKey) {
  stdout.write(`${JSON.stringify(sanitizeForOutput(value, { apiKey }), null, 2)}\n`);
}

export async function main(argv = process.argv.slice(2), dependencies = {}) {
  try {
    await runCli(argv, dependencies);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected CLI error.";
    const stderr = dependencies.stderr ?? process.stderr;
    stderr.write(`Error: ${message}\n`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main();
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
