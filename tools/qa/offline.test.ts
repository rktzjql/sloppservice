import test from "node:test";
import assert from "node:assert/strict";
import { createOfflineService } from "../../apps/miniapp/src/platform/offline/service.ts";
import { newState } from "../../apps/miniapp/src/platform/offline/initial-state.ts";
import { CATALOG } from "../../apps/miniapp/src/platform/offline/domain.ts";
import { ApiError } from "../../apps/miniapp/src/platform/offline/errors.ts";
import type { UserState } from "@aimi/contracts";
function fixture(seed: UserState | null = null) {
  let state = seed;
  let fail = false;
  const storage = {
    async load() {
      return structuredClone(state);
    },
    async save(s: UserState) {
      if (fail) throw new ApiError("LOCAL_STORAGE_FAILED", 500);
      state = structuredClone(s);
    },
    async clear() {
      state = null;
    },
  };
  const api = createOfflineService(storage);
  return {
    storage,
    api,
    get state() {
      return state!;
    },
    set fail(v: boolean) {
      fail = v;
    },
    async call(
      path: string,
      method = "GET",
      body?: unknown,
      key = crypto.randomUUID(),
    ) {
      return ((await api.request(path, method, body, key)) as any).data;
    },
  };
}
test("fresh profile, bundled puzzles and model catalog, no social or AI execution", async () => {
  const f = fixture();
  assert.equal((await f.call("/v1/state")).balance, 0);
  assert.ok((await f.call("/v1/content")).catalog.length);
  assert.equal((await f.call("/v1/content/previews")).images.length, 10);
  assert.ok((await f.call("/v1/models")).models.length);
  for (const [path, method, code] of [
    ["/v1/friends", "GET", "NOT_FOUND"],
    ["/v1/optimizer/jobs", "POST", "AI_NOT_CONNECTED"],
    ["/v1/recommendations", "POST", "AI_NOT_CONNECTED"],
  ])
    await assert.rejects(() => f.call(path, method, {}), { code });
  assert.deepEqual(f.state.aiUsage, {});
});
test("concurrent attendance claims award once; reward persists after reopening", async () => {
  const f = fixture();
  const result = await Promise.all([
    f.call("/daily-rewards/attendance/claim", "POST", {}),
    f.call("/daily-rewards/attendance/claim", "POST", {}),
  ]);
  assert.equal(
    result.reduce((sum, r) => sum + r.awarded, 0),
    3,
  );
  const reopened = createOfflineService(f.storage);
  assert.equal(
    ((await reopened.request("/v1/state", "GET", undefined, "")) as any).data
      .balance,
    3,
  );
  await f.call("/daily-rewards/tip/claim", "POST", {});
  assert.equal(f.state.balance, 4);
});
test("purchase retries, insufficient funds and storage failure are atomic", async () => {
  const initial = newState("test");
  initial.balance = 1000;
  const f = fixture(initial);
  const item = CATALOG.find((i) => i.kind === "item")!;
  const key = crypto.randomUUID();
  f.fail = true;
  await assert.rejects(
    () =>
      f.call("/v1/purchases", "POST", { itemId: item.id, quantity: 1 }, key),
    { code: "LOCAL_STORAGE_FAILED" },
  );
  assert.equal(f.state.balance, 1000);
  f.fail = false;
  const first = await f.call(
    "/v1/purchases",
    "POST",
    { itemId: item.id, quantity: 1 },
    key,
  );
  assert.deepEqual(
    await f.call(
      "/v1/purchases",
      "POST",
      { itemId: item.id, quantity: 1 },
      key,
    ),
    first,
  );
  assert.equal(f.state.balance, 1000 - item.price);
  const before = structuredClone(f.state);
  await assert.rejects(
    () => f.call("/v1/purchases", "POST", { itemId: item.id, quantity: 98 }),
    { code: "INSUFFICIENT_EP" },
  );
  assert.deepEqual(f.state, before);
});
test("profile and garden persist, stale revision rejected, reset creates clean profile", async () => {
  const f = fixture();
  await f.call("/v1/profile", "PUT", { name: "테스트" });
  const body = { revision: 0, character: "seed", placements: [] };
  await f.call("/v1/garden", "PUT", body);
  await assert.rejects(() => f.call("/v1/garden", "PUT", body), {
    code: "GARDEN_REVISION_CONFLICT",
  });
  const reopened = createOfflineService(f.storage);
  const result = (
    (await reopened.request("/v1/state", "GET", undefined, "")) as any
  ).data;
  assert.equal(result.name, "테스트");
  assert.equal(result.garden.revision, 1);
  await f.call("/v1/account", "DELETE");
  assert.equal((await f.call("/v1/state")).name, "새싹이");
  assert.equal(f.state.balance, 0);
});
test("game start and abandon replay survive reopening without duplicate rewards", async () => {
  const f = fixture();
  const play = await f.call("/v1/game-plays", "POST", {});
  assert.equal((await f.call("/v1/game-plays/" + play.id)).status, "running");
  const body = { inputs: [], ticks: 0, abandon: true };
  const result = await f.call(
    "/v1/game-plays/" + play.id + "/complete",
    "POST",
    body,
  );
  assert.equal(result.status, "abandoned");
  assert.deepEqual(
    await f.call("/v1/game-plays/" + play.id + "/complete", "POST", body),
    result,
  );
  assert.equal((await f.call("/v1/state")).daily.playsUsed, 1);
});
test("bundled challenge evaluates locally and reward claim cannot double-credit", async () => {
  const f = fixture();
  const content = await f.call("/v1/content");
  const play = await f.call("/v1/game-plays", "POST", {});
  await f.call("/v1/game-plays/" + play.id + "/complete", "POST", {
    inputs: [],
    ticks: 0,
    abandon: true,
  });
  const { generatedPack } =
    await import("../../apps/miniapp/src/platform/offline/puzzle.ts");
  const day = Object.values(f.state.days)[0];
  day.best = 100;
  day.challengeBudget = 100;
  const pack = generatedPack(day.date, day.challengeVersion);
  const result = await f.call("/v1/challenge/attempts", "POST", {
    keywordIds: pack.correct_keywords.map((k) => k.id),
    model: "low",
    date: day.date,
    contentVersion: day.challengeVersion,
  });
  assert.equal(result.passed, true);
  assert.ok(result.image.startsWith("/content/"));
  const balance = f.state.balance;
  const first = await f.call(
    "/v1/attempts/" + result.id + "/reward",
    "POST",
    {},
  );
  const second = await f.call(
    "/v1/attempts/" + result.id + "/reward",
    "POST",
    {},
  );
  assert.ok(first.credited >= 10);
  assert.equal(second.credited, 0);
  assert.equal(f.state.balance, balance + first.credited);
});
