import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { renderStatus, resolvePublicationTargets, runCli } from "../src/cli.mjs";

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
const MEDIA_URL = "https://media.example/video.mp4";
const CONNECTED_INSTAGRAM = { _id: "ig-connected", platform: "instagram", isActive: true };
const CONNECTED_YOUTUBE = { _id: "yt-connected", platform: "youtube", isActive: true };

function publishArgs(...options) {
  return ["publish", "--media-url", MEDIA_URL, ...options, "--confirm", "PUBLISH"];
}

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

test("validate --platform instagram builds only Instagram without YouTube metadata", async () => {
  const calls = [];
  await runCli(["validate", "--platform", "instagram", "--media-url", MEDIA_URL], {
    env,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { valid: true });
    },
  });

  assert.deepEqual(calls.map(({ url }) => url.split("/api/v1/")[1]), [
    "tools/validate/media",
    "tools/validate/post",
  ]);
  assert.deepEqual(JSON.parse(calls[1].init.body).platforms, [
    {
      platform: "instagram",
      platformSpecificData: { shareToFeed: true },
    },
  ]);
});

test("validate --platform youtube builds only YouTube and requires its title", async () => {
  let calls = 0;
  await assert.rejects(
    runCli(["validate", "--platform", "youtube", "--media-url", MEDIA_URL], {
      env,
      fetchImpl: async () => {
        calls += 1;
        return response(200, { valid: true });
      },
    }),
    /non-empty --youtube-title/,
  );
  assert.equal(calls, 0);

  const validationCalls = [];
  await runCli([
    "validate",
    "--platform",
    "youtube",
    "--media-url",
    MEDIA_URL,
    "--youtube-title",
    "YouTube title",
  ], {
    env,
    fetchImpl: async (url, init) => {
      validationCalls.push({ url, init });
      return response(200, { valid: true });
    },
  });

  assert.deepEqual(JSON.parse(validationCalls[1].init.body).platforms, [
    {
      platform: "youtube",
      platformSpecificData: {
        title: "YouTube title",
        visibility: "private",
        madeForKids: false,
      },
    },
  ]);
});

test("upload CLI output contains only the reusable public URL", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-cli-poc-"));
  const filePath = join(directory, "sample.mp4");
  await writeFile(filePath, "synthetic upload bytes");
  const stdout = outputBuffer();
  const signedUploadUrl = "https://storage.example/upload?X-Amz-Signature=do-not-print";
  const publicUrl = "https://media.zernio.com/temp/sample.mp4?sig=reusable-public-signature";

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

test("upload CLI rejects a local public URL without printing it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zernio-cli-invalid-public-url-"));
  const filePath = join(directory, "sample.mp4");
  await writeFile(filePath, "synthetic upload bytes");
  const stdout = outputBuffer();

  try {
    await assert.rejects(
      runCli(["upload", filePath], {
        env,
        stdout,
        fetchImpl: async (url) => {
          if (url.endsWith("/media/presign")) {
            return response(200, {
              uploadUrl: "https://storage.example/upload",
              publicUrl: "http://localhost/video.mp4",
            });
          }
          return response(200);
        },
      }),
      /publicly reachable/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  assert.equal(stdout.value(), "");
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

test("publish rejects whitespace-only explicit account IDs before fetching accounts", async (t) => {
  for (const option of ["--instagram-account-id", "--youtube-account-id"]) {
    await t.test(option, async () => {
      let calls = 0;
      await assert.rejects(
        runCli([
          "publish",
          "--media-url",
          "https://media.example/video.mp4",
          "--youtube-title",
          "Title",
          option,
          " \t ",
          "--confirm",
          "PUBLISH",
        ], {
          env,
          fetchImpl: async () => {
            calls += 1;
            return response(200, {});
          },
        }),
        new RegExp(`${option} requires a non-empty value\\.`),
      );
      assert.equal(calls, 0);
    });
  }
});

test("publish rejects invalid and empty --platform values before network access", async (t) => {
  for (const scenario of [
    { name: "invalid value", options: ["--platform", "tiktok"], error: /must be instagram or youtube/ },
    { name: "empty value", options: ["--platform="], error: /--platform requires a non-empty value/ },
  ]) {
    await t.test(scenario.name, async () => {
      let calls = 0;
      await assert.rejects(
        runCli(publishArgs(...scenario.options), {
          env,
          fetchImpl: async () => {
            calls += 1;
            return response(200, {});
          },
        }),
        scenario.error,
      );
      assert.equal(calls, 0);
    });
  }
});

test("publish without --platform discovers one connected target and skips zero-match platforms", async () => {
  const calls = [];
  await runCli(publishArgs(), {
    env,
    stdout: outputBuffer(),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/accounts")) {
        return response(200, { accounts: [CONNECTED_INSTAGRAM] });
      }
      assert.ok(url.endsWith("/posts"));
      return response(201, { post: { _id: "post-instagram-only" } });
    },
  });

  assert.equal(calls.filter(({ url }) => url.endsWith("/accounts")).length, 1);
  assert.equal(calls.filter(({ url }) => url.endsWith("/posts")).length, 1);
  assert.deepEqual(JSON.parse(calls[1].init.body).platforms, [
    {
      platform: "instagram",
      accountId: "ig-connected",
      platformSpecificData: { shareToFeed: true },
    },
  ]);
});

test("publish without --platform discovers both connected targets with one accounts request", async () => {
  const calls = [];
  await runCli(publishArgs("--youtube-title", "Supplied title"), {
    env,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/accounts")) {
        return response(200, { accounts: [CONNECTED_INSTAGRAM, CONNECTED_YOUTUBE] });
      }
      assert.ok(url.endsWith("/posts"));
      return response(201, { post: { _id: "post-both-platforms" } });
    },
  });

  assert.equal(calls.filter(({ url }) => url.endsWith("/accounts")).length, 1);
  assert.equal(calls.filter(({ url }) => url.endsWith("/posts")).length, 1);
  assert.deepEqual(JSON.parse(calls.find(({ url }) => url.endsWith("/posts")).init.body).platforms, [
    {
      platform: "instagram",
      accountId: "ig-connected",
      platformSpecificData: { shareToFeed: true },
    },
    {
      platform: "youtube",
      accountId: "yt-connected",
      platformSpecificData: {
        title: "Supplied title",
        visibility: "private",
        madeForKids: false,
      },
    },
  ]);
});

test("resolvePublicationTargets returns account IDs together with exact publication targets", async () => {
  let accountRequests = 0;
  const targets = await resolvePublicationTargets({
    listAccounts: async () => {
      accountRequests += 1;
      return { accounts: [CONNECTED_INSTAGRAM] };
    },
  }, {
    platform: undefined,
    instagramAccountId: undefined,
    youtubeAccountId: "yt-explicit",
  });

  assert.equal(accountRequests, 1);
  assert.deepEqual(targets, {
    instagramAccountId: "ig-connected",
    youtubeAccountId: "yt-explicit",
    targetPlatforms: ["instagram", "youtube"],
  });
});

test("publish --platform instagram discovers its sole connected account and sends only Instagram", async () => {
  const calls = [];
  await runCli(publishArgs("--platform", "instagram"), {
    env,
    stdout: outputBuffer(),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/accounts")) {
        assert.equal(init.method, "GET");
        return response(200, { accounts: [CONNECTED_INSTAGRAM] });
      }
      assert.ok(url.endsWith("/posts"));
      assert.equal(init.method, "POST");
      return response(201, { post: { _id: "post-instagram-only" } });
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(({ url, init }) => [url.split("/api/v1/")[1], init.method]), [
    ["accounts", "GET"],
    ["posts", "POST"],
  ]);
  assert.deepEqual(JSON.parse(calls[1].init.body).platforms, [
    {
      platform: "instagram",
      accountId: "ig-connected",
      platformSpecificData: { shareToFeed: true },
    },
  ]);
});

test("publish without --platform rejects ambiguity and no available targets without POST", async (t) => {
  for (const scenario of [
    {
      name: "ambiguous connected Instagram accounts",
      accounts: [
        { ...CONNECTED_INSTAGRAM, _id: "ig-1" },
        { ...CONNECTED_INSTAGRAM, _id: "ig-2" },
        CONNECTED_YOUTUBE,
      ],
      error: /expected at most one connected account/,
    },
    {
      name: "no connected supported accounts",
      accounts: [],
      error: /no connected Instagram or YouTube account is available/,
    },
  ]) {
    await t.test(scenario.name, async () => {
      const calls = [];
      await assert.rejects(
        runCli(publishArgs(), {
          env,
          fetchImpl: async (url, init) => {
            calls.push({ url, init });
            return response(url.endsWith("/accounts") ? 200 : 201, {
              accounts: scenario.accounts,
              post: { _id: "unexpected-post" },
            });
          },
        }),
        scenario.error,
      );
      assert.equal(calls.filter(({ url }) => url.endsWith("/accounts")).length, 1);
      assert.equal(calls.filter(({ url }) => url.endsWith("/posts")).length, 0);
    });
  }
});

test("YouTube title is required before POST only when discovery resolves YouTube", async () => {
  const calls = [];
  await assert.rejects(
    runCli(publishArgs(), {
      env,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return response(url.endsWith("/accounts") ? 200 : 201, {
          accounts: [CONNECTED_YOUTUBE],
          post: { _id: "unexpected-post" },
        });
      },
    }),
    /non-empty --youtube-title/,
  );
  assert.equal(calls.filter(({ url }) => url.endsWith("/accounts")).length, 1);
  assert.equal(calls.filter(({ url }) => url.endsWith("/posts")).length, 0);
});

test("publish --platform youtube requires title before network and sends only YouTube", async () => {
  let calls = 0;
  await assert.rejects(
    runCli(publishArgs("--platform", "youtube", "--youtube-account-id", "yt-explicit"), {
      env,
      fetchImpl: async () => {
        calls += 1;
        return response(201, { post: { _id: "unexpected-post" } });
      },
    }),
    /non-empty --youtube-title/,
  );
  assert.equal(calls, 0);

  const publishCalls = [];
  await runCli(publishArgs(
    "--platform",
    "youtube",
    "--youtube-title",
    "YouTube title",
    "--youtube-account-id",
    "yt-explicit",
  ), {
    env,
    fetchImpl: async (url, init) => {
      publishCalls.push({ url, init });
      return response(201, { post: { _id: "post-youtube-only" } });
    },
  });

  assert.equal(publishCalls.length, 1);
  assert.ok(publishCalls[0].url.endsWith("/posts"));
  assert.deepEqual(JSON.parse(publishCalls[0].init.body).platforms, [
    {
      platform: "youtube",
      accountId: "yt-explicit",
      platformSpecificData: {
        title: "YouTube title",
        visibility: "private",
        madeForKids: false,
      },
    },
  ]);
});

test("contradictory explicit account IDs are rejected before network access", async (t) => {
  for (const scenario of [
    { platform: "instagram", option: "--youtube-account-id", value: "yt-explicit" },
    { platform: "youtube", option: "--instagram-account-id", value: "ig-explicit", title: "YouTube title" },
  ]) {
    await t.test(scenario.platform, async () => {
      let calls = 0;
      const options = ["--platform", scenario.platform, scenario.option, scenario.value];
      if (scenario.title) {
        options.push("--youtube-title", scenario.title);
      }
      await assert.rejects(
        runCli(publishArgs(...options), {
          env,
          fetchImpl: async () => {
            calls += 1;
            return response(200, {});
          },
        }),
        /contradicts --platform/,
      );
      assert.equal(calls, 0);
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
