import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import type { Pool } from "pg";
import { ZodError } from "zod";
import {
  androidProvider,
  registerAndroidAuth,
} from "../src/services/android/auth.js";
import { ApiError } from "../src/db.js";
import { parseConfig } from "../src/config.js";
const uid = "22222222-2222-4222-8222-222222222222";
const providerId = "11111111-1111-4111-8111-111111111111";
const settings = {
  url: "https://identity.example.test",
  publicKey: "public-test",
  adminKey: "server-only-test",
};
test("guest identity is resolved by fixed Supabase user endpoint, not decoded or supplied client identity", async () => {
  let calls = 0;
  const provider = androidProvider(settings, (async (url, options) => {
    calls++;
    assert.equal(url, settings.url + "/auth/v1/user");
    assert.equal(
      (options!.headers as Record<string, string>).Authorization,
      "Bearer provider-issued-token",
    );
    assert.equal(
      (options!.headers as Record<string, string>).apikey,
      "public-test",
    );
    assert.equal(options!.redirect, "error");
    return Response.json({ id: providerId, is_anonymous: true });
  }) as typeof fetch);
  assert.equal(await provider.verify("provider-issued-token"), providerId);
  assert.equal(calls, 1);
});
test("provider rejection, malformed identity and timeouts never authorize a guest", async () => {
  for (const [response, expected] of [
    [new Response("", { status: 401 }), "ANDROID_AUTH_INVALID"],
    [new Response("", { status: 500 }), "ANDROID_AUTH_UNAVAILABLE"],
    [
      Response.json({ id: providerId, is_anonymous: false }),
      "ANDROID_AUTH_INVALID",
    ],
    [
      Response.json({ id: "forged", is_anonymous: true }),
      "ANDROID_AUTH_INVALID",
    ],
    [new Response("invalid-json"), "ANDROID_AUTH_INVALID"],
  ] as const) {
    const provider = androidProvider(
      settings,
      (async () => response) as typeof fetch,
    );
    await assert.rejects(provider.verify("token"), new RegExp(expected));
  }
  await assert.rejects(
    androidProvider(settings, (async () => {
      throw Error("network");
    }) as typeof fetch).verify("token"),
    /ANDROID_AUTH_UNAVAILABLE/,
  );
  assert.throws(
    () => androidProvider({ ...settings, url: "http://localhost" }),
    /HTTPS/,
  );
});
test("Android auth rejects forged subjects before contacting provider or database", async () => {
  const app = Fastify();
  let verified = 0;
  app.setErrorHandler((e, _r, reply) =>
    reply.code(e instanceof ZodError ? 400 : 500).send({ error: "invalid" }),
  );
  registerAndroidAuth(app, {} as Pool, "test-secret", {
    verify: async () => {
      verified++;
      return providerId;
    },
    remove: async () => {},
  });
  for (const payload of [
    { userId: providerId },
    { accessToken: "x".repeat(32), subject: providerId },
    { accessToken: "x" },
  ]) {
    assert.equal(
      (await app.inject({ method: "POST", url: "/auth/android", payload }))
        .statusCode,
      400,
    );
  }
  assert.equal(verified, 0);
  await app.close();
});
test("verified guest gets internal UUID and hashed session; failed transaction rolls back", async () => {
  for (const fail of [false, true]) {
    const queries: { sql: string; args?: unknown[] }[] = [];
    let released = false;
    const client = {
      async query(sql: string, args?: unknown[]) {
        queries.push({ sql, args });
        if (fail && sql.startsWith("INSERT INTO aimi.sessions"))
          throw Error("db");
        return { rows: [{ id: uid }], rowCount: 1 };
      },
      release() {
        released = true;
      },
    };
    const app = Fastify();
    registerAndroidAuth(
      app,
      { connect: async () => client } as unknown as Pool,
      "secret",
      { verify: async () => providerId, remove: async () => {} },
    );
    const r = await app.inject({
      method: "POST",
      url: "/auth/android",
      payload: { accessToken: "x".repeat(32) },
    });
    assert.deepEqual(
      queries.find((q) => q.sql.startsWith("INSERT INTO aimi.users"))!.args,
      [providerId],
    );
    if (fail) {
      assert.equal(r.statusCode, 500);
      assert.equal(queries.at(-1)!.sql, "ROLLBACK");
    } else {
      assert.equal(r.statusCode, 200);
      const token = r.json().data.token;
      assert.match(token, /^[a-f0-9]{64}$/);
      assert.equal(queries.at(-1)!.sql, "COMMIT");
      assert.deepEqual(
        queries.find((q) => q.sql.startsWith("INSERT INTO aimi.sessions"))!
          .args,
        [createHmac("sha256", "secret").update(token).digest("hex"), uid],
      );
    }
    assert.equal(released, true);
    await app.close();
  }
});
test("account removal uses server admin key and verified stored subject; transient failure is retryable", async () => {
  const requests: string[] = [];
  const provider = androidProvider(settings, (async (url, options) => {
    requests.push(String(url));
    assert.equal(options?.method, "DELETE");
    assert.equal(
      (options!.headers as Record<string, string>).apikey,
      settings.adminKey,
    );
    return new Response("", { status: 404 });
  }) as typeof fetch);
  const app = Fastify();
  const remove = registerAndroidAuth(
    app,
    {
      query: async () => ({ rows: [{ android_subject: providerId }] }),
    } as unknown as Pool,
    "secret",
    provider,
  );
  await remove(uid);
  assert.deepEqual(requests, [
    settings.url + "/auth/v1/admin/users/" + providerId,
  ]);
  await app.close();
  await assert.rejects(
    androidProvider(
      settings,
      (async () => new Response("", { status: 500 })) as typeof fetch,
    ).remove(providerId),
    /UNAVAILABLE/,
  );
});
test("production Android refuses demo fixtures and absent provider configuration", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://localhost/test",
    SESSION_SIGNING_KEY: "s".repeat(40),
    ANDROID_AUTH_ENABLED: "true",
  };
  assert.throws(() => parseConfig(base), /configuration missing/);
  const enabled = {
    ...base,
    ANDROID_SUPABASE_URL: settings.url,
    ANDROID_SUPABASE_PUBLIC_KEY: "public",
    ANDROID_SUPABASE_ADMIN_KEY: "admin",
  };
  assert.throws(
    () => parseConfig({ ...enabled, AIMI_AI_MODE: "fixture" }),
    /cannot use/,
  );
  assert.throws(
    () => parseConfig({ ...enabled, ENABLE_TEST_DEMO: "true" }),
    /cannot use/,
  );
  assert.throws(() => parseConfig(enabled), /server-side Gemini/);
  assert.doesNotThrow(() =>
    parseConfig({ ...enabled, AIMI_GEMINI_API_KEY: "test-only-server-key" }),
  );
});
