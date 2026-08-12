import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ZernioApiError,
  buildPublicationBody,
  createZernioClient,
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
