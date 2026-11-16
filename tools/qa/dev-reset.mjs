/** Isolated process restart test; never connects to a remote database. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:8182";
let child;
async function start() {
  child = spawn(
    process.execPath,
    ["--import", "tsx", "apps/api/src/prototype-server.ts"],
    {
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "development",
        PROTOTYPE_PORT: "8182",
        AIMI_AI_MODE: "fixture",
        AIMI_DEV_PERSIST_STATE: "false",
      },
    },
  );
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null)
      throw new Error("Reset test server did not start");
    try {
      const r = await fetch(base + "/health/live");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Reset test start timeout");
}
async function stop() {
  if (child && child.exitCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
}
async function req(path, method = "GET", body, token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, ...(await r.json()) };
}
try {
  await start();
  const first = await req("/auth/local", "POST", { name: "resetcheck" }),
    token = first.data.token;
  assert.equal(
    (await req("/v1/state", "GET", undefined, token)).data.balance,
    125,
  );
  await req("/v1/dev/rewards/attendance", "POST", {}, token);
  await req("/v1/purchases", "POST", { itemId: "plant" }, token);
  await req("/v1/game-plays", "POST", { kind: "dino" }, token);
  const before = (await req("/v1/state", "GET", undefined, token)).data;
  assert.equal(before.balance, 90);
  assert.ok(before.inventory.includes("plant"));
  assert.equal(before.daily.playsUsed, 1);
  await stop();
  await start();
  assert.equal((await req("/v1/state", "GET", undefined, token)).status, 401);
  const second = await req("/auth/local", "POST", { name: "resetcheck" });
  const after = (await req("/v1/state", "GET", undefined, second.data.token))
    .data;
  assert.equal(after.balance, 125);
  assert.ok(!after.inventory.includes("plant"));
  assert.equal(after.daily.playsUsed, 0);
  assert.equal(after.activePlay, null);
  assert.deepEqual(after.claims, []);
  const report = {
    passed: true,
    reset: [
      "balance",
      "purchases",
      "game attempts",
      "active play",
      "attendance",
    ],
    oldSessionRejected: true,
  };
  await writeFile(
    "tmp/qa/dev-reset-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await stop();
}
