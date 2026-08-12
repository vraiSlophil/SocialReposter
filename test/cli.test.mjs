import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { renderStatus, runCli } from "../src/cli.mjs";

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body === undefined ? "" : JSON.stringify(body);
    },
  };
}

function outputBuffer() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    value() {
      return value;
    },
  };
}

const env = { ZENRIO_API_KEY: "cli-test-key" };

test("validate calls media and post validation only, never the posts endpoint", async () => {
  const calls = [];
  const stdout = outputBuffer();
  await runCli([
    "validate",
    "--media-url",
    "https://media.example/video.mp4",
    "--caption",
    "Caption",
    "--youtube-title",
    "Title",
  ], {
    env,
    stdout,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/tools/validate/media")) {
        return response(200, { valid: true });
      }
      if (url.endsWith("/tools/validate/post")) {
        return response(200, { valid: true });
      }
      throw new Error(`unexpected endpoint ${url}`);
    },
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url }) => !url.endsWith("/posts")));
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.publishNow, undefined);
  assert.equal(body.platforms[0].platformSpecificData.shareToFeed, true);
  assert.deepEqual(body.platforms[1].platformSpecificData, {
    title: "Title",
    visibility: "private",
    madeForKids: false,
  });
  assert.match(stdout.value(), /"valid": true/);
});

test("upload CLI output contains only the reusable public URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-cli-poc-"));
  const filePath = join(directory, "sample.mp4");
  await writeFile(filePath, "synthetic upload bytes");
  const stdout = outputBuffer();
  const signedUploadUrl = "https://storage.example/upload?X-Amz-Signature=do-not-print";
  const publicUrl = "https://media.zernio.com/temp/sample.mp4";

  try {
    await runCli(["upload", filePath], {
      env,
      stdout,
      fetchImpl: async (url) => {
        if (url.endsWith("/media/presign")) {
          return response(200, { uploadUrl: signedUploadUrl, publicUrl });
        }
        return response(200);
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  assert.equal(stdout.value(), `${publicUrl}\n`);
  assert.doesNotMatch(stdout.value(), /uploadUrl|X-Amz-Signature/);
});

test("upload rejects a missing path before making any fetch calls", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-cli-missing-"));
  const filePath = join(directory, "missing.mp4");
  let calls = 0;

  try {
    await assert.rejects(
      runCli(["upload", filePath], {
        env,
        fetchImpl: async () => {
          calls += 1;
          return response(200, {});
        },
      }),
      (error) => {
        assert.equal(error.message, `Local media file was not found: ${filePath}`);
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  assert.equal(calls, 0);
});

test("publish cannot reach POST /posts without the exact confirmation", async () => {
  let calls = 0;
  await assert.rejects(
    runCli([
      "publish",
      "--media-url",
      "https://media.example/video.mp4",
      "--youtube-title",
      "Title",
      "--confirm",
      "publish",
    ], {
      env,
      fetchImpl: async () => {
        calls += 1;
        return response(200, {});
      },
    }),
    /exact confirmation/,
  );
  assert.equal(calls, 0);
});

test("publish rejects zero and multiple connected account matches", async (t) => {
  for (const accounts of [
    [],
    [
      { _id: "ig-1", platform: "instagram", isActive: true },
      { _id: "ig-2", platform: "instagram", isActive: true },
      { _id: "yt-1", platform: "youtube", isActive: true },
    ],
  ]) {
    await t.test(`rejects ${accounts.length === 0 ? "zero" : "multiple"} matches`, async () => {
      const calls = [];
      await assert.rejects(
        runCli([
          "publish",
          "--media-url",
          "https://media.example/video.mp4",
          "--youtube-title",
          "Title",
          "--confirm",
          "PUBLISH",
        ], {
          env,
          fetchImpl: async (url, init) => {
            calls.push({ url, init });
            return response(200, { accounts });
          },
        }),
        /expected exactly one connected account/,
      );
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.endsWith("/accounts"));
    });
  }
});

test("publish sends both targets, publishNow, and a UUID x-request-id", async () => {
  const calls = [];
  const stdout = outputBuffer();
  await runCli([
    "publish",
    "--media-url",
    "https://media.example/video.mp4",
    "--caption",
    "Caption",
    "--youtube-title",
    "Title",
    "--instagram-account-id",
    "ig-explicit",
    "--youtube-account-id",
    "yt-explicit",
    "--confirm",
    "PUBLISH",
  ], {
    env,
    stdout,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      assert.ok(url.endsWith("/posts"));
      return response(201, {
        post: {
          _id: "post-1",
          status: "published",
          platforms: [],
        },
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].init.headers["x-request-id"], /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.publishNow, true);
  assert.deepEqual(body.platforms, [
    {
      platform: "instagram",
      accountId: "ig-explicit",
      platformSpecificData: { shareToFeed: true },
    },
    {
      platform: "youtube",
      accountId: "yt-explicit",
      platformSpecificData: {
        title: "Title",
        visibility: "private",
        madeForKids: false,
      },
    },
  ]);
  assert.match(stdout.value(), /post-1/);
});

test("status renders overall partial state and per-platform failure details", () => {
  const rendered = renderStatus({
    post: {
      _id: "post-1",
      status: "partial",
      platforms: [
        {
          platform: "instagram",
          status: "published",
          platformPostUrl: "https://instagram.com/p/abc",
        },
        {
          platform: "youtube",
          status: "failed",
          errorMessage: "YouTube rejected the upload",
        },
      ],
    },
  });

  assert.match(rendered, /overall: partial/);
  assert.match(rendered, /instagram: published/);
  assert.match(rendered, /url: https:\/\/instagram\.com\/p\/abc/);
  assert.match(rendered, /youtube: failed/);
  assert.match(rendered, /error: YouTube rejected the upload/);
});

test("CLI validates public URL and non-empty YouTube title before network access", async () => {
  let calls = 0;
  await assert.rejects(
    runCli(["validate", "--media-url", "file:///tmp/video.mp4", "--youtube-title", "Title"], {
      env,
      fetchImpl: async () => {
        calls += 1;
        return response(200, {});
      },
    }),
    /public http\(s\) URL/,
  );
  await assert.rejects(
    runCli(["validate", "--media-url", "https://media.example/video.mp4", "--youtube-title", "   "], {
      env,
      fetchImpl: async () => {
        calls += 1;
        return response(200, {});
      },
    }),
    /non-empty --youtube-title/,
  );
  assert.equal(calls, 0);
});
