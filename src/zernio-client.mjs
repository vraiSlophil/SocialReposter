import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { BlockList, isIP } from "node:net";

export const DEFAULT_BASE_URL = "https://zernio.com/api/v1";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const SENSITIVE_KEY_NAMES = new Set([
  "authorization",
  "apikey",
  "token",
  "uploadurl",
  "signeduploadurl",
  "presignedurl",
  "presigneduploadurl",
]);
const NON_PUBLIC_IPV4_BLOCK_LIST = new BlockList();
const NON_PUBLIC_IPV6_BLOCK_LIST = new BlockList();

for (const [address, prefix, type] of [
  ["0.0.0.0", 8, "ipv4"], // Unspecified and this-network addresses.
  ["10.0.0.0", 8, "ipv4"], // Private-use addresses.
  ["100.64.0.0", 10, "ipv4"], // Shared address space.
  ["127.0.0.0", 8, "ipv4"], // Loopback addresses.
  ["169.254.0.0", 16, "ipv4"], // Link-local addresses.
  ["172.16.0.0", 12, "ipv4"], // Private-use addresses.
  ["192.0.0.0", 24, "ipv4"], // IETF protocol assignments.
  ["192.0.2.0", 24, "ipv4"], // Documentation addresses.
  ["192.168.0.0", 16, "ipv4"], // Private-use addresses.
  ["198.18.0.0", 15, "ipv4"], // Benchmarking addresses.
  ["198.51.100.0", 24, "ipv4"], // Documentation addresses.
  ["203.0.113.0", 24, "ipv4"], // Documentation addresses.
  ["224.0.0.0", 4, "ipv4"], // Multicast addresses.
  ["240.0.0.0", 4, "ipv4"], // Reserved and broadcast addresses.
  ["::", 96, "ipv6"], // Unspecified, loopback, and IPv4-compatible addresses.
  ["::ffff:0:0", 96, "ipv6"], // IPv4-mapped addresses.
  ["100::", 64, "ipv6"], // Discard-only addresses.
  ["2001:2::", 48, "ipv6"], // Benchmarking addresses.
  ["2001:db8::", 32, "ipv6"], // Documentation addresses.
  ["fc00::", 7, "ipv6"], // Unique-local addresses.
  ["fe80::", 10, "ipv6"], // Link-local addresses.
  ["fec0::", 10, "ipv6"], // Deprecated site-local addresses.
  ["ff00::", 8, "ipv6"], // Multicast addresses.
]) {
  const blockList = type === "ipv4" ? NON_PUBLIC_IPV4_BLOCK_LIST : NON_PUBLIC_IPV6_BLOCK_LIST;
  blockList.addSubnet(address, prefix, type);
}

export class ZernioApiError extends Error {
  constructor({ status, method, endpoint, payload, apiKey, sensitiveUrls = [] }) {
    const safePayload = sanitizeForOutput(payload, { apiKey, sensitiveUrls });
    const detail = getErrorMessage(safePayload);
    super(`Zernio API error (${status})${detail ? `: ${detail}` : ""}`);
    this.name = "ZernioApiError";
    this.status = status;
    this.method = method;
    this.endpoint = endpoint;
    this.details = safePayload;
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      method: this.method,
      endpoint: this.endpoint,
      details: this.details,
    };
  }
}

export class ZernioNetworkError extends Error {
  constructor(operation) {
    super(`Zernio ${operation} failed: no response was received.`);
    this.name = "ZernioNetworkError";
  }
}

export function sanitizeForOutput(value, { apiKey = "", sensitiveUrls = [] } = {}) {
  return sanitizeValue(value, { apiKey, sensitiveUrls }, new WeakSet());
}

function sanitizeValue(value, context, seen) {
  if (typeof value === "string") {
    return redactString(value, context);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return value.map((item) => sanitizeValue(item, context, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeValue(item, context, seen);
      }
    }
    return output;
  }

  return value;
}

function isSensitiveKey(key) {
  const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_KEY_NAMES.has(normalizedKey);
}

function redactString(value, { apiKey, sensitiveUrls }) {
  let output = value;
  if (apiKey) {
    output = output.split(apiKey).join("[REDACTED]");
  }

  for (const sensitiveUrl of sensitiveUrls) {
    if (sensitiveUrl) {
      output = output.split(sensitiveUrl).join("[REDACTED_PRESIGNED_URL]");
    }
  }

  return output.replace(/https?:\/\/[^\s"'<>]+/gi, (candidate) => {
    if (isPresignedUrl(candidate)) {
      return "[REDACTED_PRESIGNED_URL]";
    }
    return candidate;
  });
}

function isPresignedUrl(candidate) {
  try {
    const url = new URL(candidate.replace(/[),.;]+$/, ""));
    const signedQueryKeys = new Set([
      "x-amz-signature",
      "x-amz-credential",
      "x-amz-algorithm",
      "x-amz-date",
      "x-amz-expires",
      "signature",
      "sig",
    ]);
    return [...url.searchParams.keys()].some((key) => signedQueryKeys.has(key.toLowerCase()));
  } catch {
    return false;
  }
}

function getErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" ? payload : "";
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }
  if (typeof payload.message === "string") {
    return payload.message;
  }
  return "";
}

export function assertPublicMediaUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("A public media URL is required.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Media URL must be a valid http(s) URL.");
  }

  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Media URL must be a public http(s) URL without embedded credentials.");
  }

  const hostname = url.hostname.toLowerCase();
  const ipAddress = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  const addressFamily = isIP(ipAddress);
  const blockList = addressFamily === 4 ? NON_PUBLIC_IPV4_BLOCK_LIST : NON_PUBLIC_IPV6_BLOCK_LIST;
  const isNonPublicIp = addressFamily > 0 && blockList.check(ipAddress, `ipv${addressFamily}`);

  if (hostname === "localhost" || hostname.endsWith(".local") || isNonPublicIp) {
    throw new Error("Media URL must be publicly reachable, not a local address.");
  }

  return value;
}

export function buildPublicationBody({
  mediaUrl,
  caption = "",
  instagramAccountId,
  youtubeAccountId,
  youtubeTitle,
  youtubeVisibility = "private",
  youtubeMadeForKids = false,
  publishNow = false,
}) {
  const instagram = {
    platform: "instagram",
    platformSpecificData: {
      shareToFeed: true,
    },
  };
  const youtube = {
    platform: "youtube",
    platformSpecificData: {
      title: youtubeTitle,
      visibility: youtubeVisibility,
      madeForKids: youtubeMadeForKids,
    },
  };

  if (instagramAccountId) {
    instagram.accountId = instagramAccountId;
  }
  if (youtubeAccountId) {
    youtube.accountId = youtubeAccountId;
  }

  const body = {
    mediaItems: [{ type: "video", url: mediaUrl }],
    platforms: [instagram, youtube],
  };

  if (caption.trim() !== "") {
    body.content = caption;
  }
  if (publishNow) {
    body.publishNow = true;
  }

  return body;
}

export function extractAccounts(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.accounts)) {
    return payload.accounts;
  }
  if (Array.isArray(payload?.data?.accounts)) {
    return payload.data.accounts;
  }
  return [];
}

export function isConnectedAccount(account) {
  return account?.status !== "disconnected" && account?.isActive !== false;
}

export class ZernioClient {
  #apiKey;
  #baseUrl;
  #fetch;
  #requestIdFactory;

  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch, requestIdFactory = randomUUID } = {}) {
    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new Error("ZENRIO_API_KEY is required.");
    }
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required.");
    }

    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = fetchImpl;
    this.#requestIdFactory = requestIdFactory;
  }

  async listAccounts() {
    return this.#request("accounts", { method: "GET" });
  }

  async presignMedia({ filename, contentType, size }) {
    return this.#request("media/presign", {
      method: "POST",
      json: { filename, contentType, size },
    });
  }

  async uploadFile(filePath) {
    let fileInfo;
    try {
      fileInfo = await stat(filePath);
    } catch {
      throw new Error(`Local media file was not found: ${filePath}`);
    }
    if (!fileInfo.isFile()) {
      throw new Error(`Local media path is not a file: ${filePath}`);
    }
    if (fileInfo.size > MAX_UPLOAD_BYTES) {
      throw new Error("Local media file exceeds Zernio's 5 GB presign limit.");
    }

    const presigned = await this.presignMedia({
      filename: filePath.split(/[\\/]/).pop(),
      contentType: "video/mp4",
      size: fileInfo.size,
    });
    const uploadUrl = presigned?.uploadUrl;
    const publicUrl = presigned?.publicUrl;
    if (typeof uploadUrl !== "string" || uploadUrl === "") {
      throw new Error("Zernio presign response did not include an upload URL.");
    }
    if (typeof publicUrl !== "string" || publicUrl === "") {
      throw new Error("Zernio presign response did not include a public URL.");
    }

    const stream = createReadStream(filePath);
    try {
      await this.#request(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(fileInfo.size),
        },
        body: stream,
        authenticated: false,
        sensitiveUrls: [uploadUrl],
        operation: "media upload",
      });
    } finally {
      stream.destroy();
    }

    return publicUrl;
  }

  async validateMedia(mediaUrl) {
    return this.#request("tools/validate/media", {
      method: "POST",
      json: { url: assertPublicMediaUrl(mediaUrl) },
    });
  }

  async validatePost(body) {
    return this.#request("tools/validate/post", {
      method: "POST",
      json: body,
    });
  }

  async createPost(body) {
    const requestId = this.#requestIdFactory();
    return this.#request("posts", {
      method: "POST",
      json: body,
      headers: { "x-request-id": requestId },
    });
  }

  async getPost(postId) {
    const safePostId = String(postId).trim();
    if (safePostId === "") {
      throw new Error("A post ID is required.");
    }
    return this.#request(`posts/${encodeURIComponent(safePostId)}`, { method: "GET" });
  }

  async #request(endpointOrUrl, {
    method = "GET",
    headers = {},
    json,
    body,
    authenticated = true,
    sensitiveUrls = [],
    operation = "request",
  } = {}) {
    const url = authenticated ? `${this.#baseUrl}/${endpointOrUrl}` : endpointOrUrl;
    const requestHeaders = { ...headers };
    const init = { method, headers: requestHeaders };

    if (authenticated) {
      requestHeaders.Authorization = `Bearer ${this.#apiKey}`;
    }
    if (json !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      init.body = JSON.stringify(json);
    } else if (body !== undefined) {
      init.body = body;
      if (typeof body?.pipe === "function") {
        init.duplex = "half";
      }
    }

    let response;
    try {
      response = await this.#fetch(url, init);
    } catch {
      throw new ZernioNetworkError(authenticated ? `${method} ${endpointOrUrl}` : operation);
    }

    const payload = await readResponsePayload(response);
    const ok = typeof response.ok === "boolean" ? response.ok : response.status >= 200 && response.status < 300;
    if (!ok) {
      throw new ZernioApiError({
        status: response.status,
        method,
        endpoint: authenticated ? endpointOrUrl : operation,
        payload,
        apiKey: this.#apiKey,
        sensitiveUrls,
      });
    }

    return payload;
  }
}

export function createZernioClient(options) {
  return new ZernioClient(options);
}

async function readResponsePayload(response) {
  if (typeof response.text === "function") {
    const text = await response.text();
    if (text === "") {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (typeof response.json === "function") {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  return undefined;
}
