import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ZernioApiError,
  assertPublicMediaUrl,
  buildPublicationBody,
  createZernioClient,
  sanitizeForOutput,
} from "../src/zernio-client.mjs";

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

test("auth is sent to API requests and secrets are absent from structured errors", async () => {
  const apiKey = "test-api-key-not-for-output";
  let receivedInit;
  const client = createZernioClient({
    apiKey,
    fetchImpl: async (_url, init) => {
      receivedInit = init;
      return response(401, {
        error: `invalid key ${apiKey}`,
        authorization: `Bearer ${apiKey}`,
        uploadUrl: "https://storage.example/upload?X-Amz-Signature=secret",
      });
    },
  });

  await assert.rejects(client.listAccounts(), (error) => {
    assert.ok(error instanceof ZernioApiError);
    assert.equal(error.status, 401);
    assert.match(receivedInit.headers.Authorization, new RegExp(`^Bearer ${apiKey}$`));
    assert.doesNotMatch(error.message, new RegExp(apiKey));
    assert.doesNotMatch(JSON.stringify(error), new RegExp(apiKey));
    assert.doesNotMatch(JSON.stringify(error), /X-Amz-Signature=secret/);
    return true;
  });
});

test("unauthenticated request errors use the operation label as their endpoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-error-"));
  const filePath = join(directory, "sample.mp4");
  await writeFile(filePath, Buffer.from("synthetic test bytes"));

  try {
    const client = createZernioClient({
      apiKey: "operation-test-key",
      fetchImpl: async (url) => {
        if (url.endsWith("/media/presign")) {
          return response(200, {
            uploadUrl: "https://storage.example/upload",
            publicUrl: "https://media.zernio.com/temp/sample.mp4",
          });
        }
        return response(403, { error: "upload rejected" });
      },
    });

    await assert.rejects(client.uploadFile(filePath), (error) => {
      assert.ok(error instanceof ZernioApiError);
      assert.equal(error.endpoint, "media upload");
      return true;
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sanitizeForOutput handles circular arrays", () => {
  const circular = [];
  circular.push(circular);

  assert.deepEqual(sanitizeForOutput(circular), ["[Circular]"]);
});

test("sanitizeForOutput redacts upload URL key variants", () => {
  const sanitized = sanitizeForOutput({
    uploadUrl: "https://storage.example/upload?signature=camel-secret",
    upload_url: "https://storage.example/upload?signature=underscore-secret",
    "upload-url": "https://storage.example/upload?signature=dash-secret",
    signedUploadUrl: "https://storage.example/upload?signature=signed-camel-secret",
    signed_upload_url: "https://storage.example/upload?signature=signed-underscore-secret",
    "signed-upload-url": "https://storage.example/upload?signature=signed-dash-secret",
    presignedUploadUrl: "https://storage.example/upload?signature=presigned-camel-secret",
    presigned_upload_url: "https://storage.example/upload?signature=presigned-underscore-secret",
    "presigned-upload-url": "https://storage.example/upload?signature=presigned-dash-secret",
  });

  assert.deepEqual(sanitized, {
    uploadUrl: "[REDACTED]",
    upload_url: "[REDACTED]",
    "upload-url": "[REDACTED]",
    signedUploadUrl: "[REDACTED]",
    signed_upload_url: "[REDACTED]",
    "signed-upload-url": "[REDACTED]",
    presignedUploadUrl: "[REDACTED]",
    presigned_upload_url: "[REDACTED]",
    "presigned-upload-url": "[REDACTED]",
  });
});

test("assertPublicMediaUrl rejects literal non-public IP addresses", () => {
  const nonPublicUrls = [
    "http://0.0.0.0/video.mp4",
    "http://10.0.0.1/video.mp4",
    "http://172.16.0.1/video.mp4",
    "http://192.168.1.1/video.mp4",
    "http://127.0.0.1/video.mp4",
    "http://169.254.1.1/video.mp4",
    "http://224.0.0.1/video.mp4",
    "http://240.0.0.1/video.mp4",
    "https://[::]/video.mp4",
    "https://[::1]/video.mp4",
    "https://[fc00::1]/video.mp4",
    "https://[fe80::1]/video.mp4",
    "https://[ff02::1]/video.mp4",
    "https://[2001:db8::1]/video.mp4",
    "https://[::ffff:127.0.0.1]/video.mp4",
  ];

  for (const url of nonPublicUrls) {
    assert.throws(() => assertPublicMediaUrl(url), /publicly reachable/);
  }
});

test("assertPublicMediaUrl accepts public hostnames and IP addresses", () => {
  const publicUrls = [
    "https://cdn.example.com/video.mp4",
    "http://8.8.8.8/video.mp4",
    "https://[2001:4860:4860::8888]/video.mp4",
  ];

  for (const url of publicUrls) {
    assert.equal(assertPublicMediaUrl(url), url);
  }
});

test("upload presigns with video metadata, PUTs bytes without auth, and returns only publicUrl", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-poc-"));
  const filePath = join(directory, "sample.mp4");
  await writeFile(filePath, Buffer.from("synthetic test bytes"));
  const calls = [];
  const signedUploadUrl = "https://storage.example/upload?X-Amz-Signature=do-not-leak";
  const publicUrl = "https://media.zernio.com/temp/sample.mp4";

  try {
    const client = createZernioClient({
      apiKey: "upload-test-key",
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        if (url.endsWith("/media/presign")) {
          return response(200, { uploadUrl: signedUploadUrl, publicUrl });
        }
        assert.equal(url, signedUploadUrl);
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(init.headers["Content-Type"], "video/mp4");
        assert.equal(init.headers["Content-Length"], "20");
        assert.equal(init.duplex, "half");
        return response(200);
      },
    });

    const result = await client.uploadFile(filePath);
    assert.equal(result, publicUrl);
    assert.equal(calls.length, 2);
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      filename: "sample.mp4",
      contentType: "video/mp4",
      size: 20,
    });
    assert.doesNotMatch(result, /X-Amz-Signature/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("publication body has both platform settings and optional publishNow", () => {
  const validationBody = buildPublicationBody({
    mediaUrl: "https://media.example/video.mp4",
    caption: "A caption",
    youtubeTitle: "A title",
  });
  assert.equal(validationBody.publishNow, undefined);
  assert.deepEqual(validationBody.platforms, [
    {
      platform: "instagram",
      platformSpecificData: { shareToFeed: true },
    },
    {
      platform: "youtube",
      platformSpecificData: {
        title: "A title",
        visibility: "private",
        madeForKids: false,
      },
    },
  ]);

  const publishBody = buildPublicationBody({
    mediaUrl: "https://media.example/video.mp4",
    youtubeTitle: "A title",
    instagramAccountId: "ig-1",
    youtubeAccountId: "yt-1",
    publishNow: true,
  });
  assert.equal(publishBody.publishNow, true);
  assert.equal(publishBody.platforms[0].accountId, "ig-1");
  assert.equal(publishBody.platforms[1].accountId, "yt-1");
});
