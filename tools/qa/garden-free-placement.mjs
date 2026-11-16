import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const base = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5280",
  browser = await chromium.launch({ channel: "chrome", headless: true }),
  p = await browser.newPage({ viewport: { width: 375, height: 812 } }),
  checks = [];
const click = (name) => p.getByRole("button", { name, exact: true }).click();
async function api(path, method = "GET", body, token) {
  return p.evaluate(
    async ({ path, method, body, token }) => {
      const r = await fetch("/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          Authorization:
            "Bearer " + (token ?? localStorage.getItem("aimi.session")),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, ...(await r.json()) };
    },
    { path, method, body, token },
  );
}
try {
  await p.goto(base);
  await p
    .getByLabel("개발용 사용자", { exact: true })
    .fill("free_" + Date.now());
  await click("개발용으로 시작하기");
  await p.locator(".today-card").waitFor();
  await click("정원");
  await click("정원 상점");
  await click("작은 화분 40 EP");
  await expect(p.getByRole("dialog")).not.toContainText("적용 범위");
  await expect(p.getByRole("dialog")).not.toContainText("배치 상태");
  await expect(
    p.getByRole("group", { name: "구매 수량", exact: true }),
  ).toBeVisible();
  await expect(p.getByRole("dialog")).not.toContainText("장착 위치");
  await click("40 EP로 구매");
  await click("정원 편집으로");
  await click("작은 화분 정원에 추가");
  await click("분홍 꽃 정원에 추가");
  const item = p.getByRole("button", {
    name: "작은 화분 위치 이동",
    exact: true,
  });
  await item.scrollIntoViewIfNeeded();
  await item.click();
  const before = await item.evaluate((e) => ({
      x: parseFloat(e.style.left),
      y: parseFloat(e.style.top),
    })),
    scene = await p.locator(".free-garden").boundingBox(),
    box = await item.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(
    box.x + box.width / 2 + scene.width * 0.4,
    box.y + box.height / 2 + scene.height * 0.25,
    { steps: 12 },
  );
  await p.mouse.up();
  await expect
    .poll(() => item.evaluate((e) => parseFloat(e.style.left)))
    .toBeGreaterThan(before.x + 20);
  checks.push(
    "owned items can be added and dragged across former slot boundaries",
  );
  await item.focus();
  const afterDrag = await item.evaluate((e) => parseFloat(e.style.left));
  await p.keyboard.press("ArrowLeft");
  await expect
    .poll(() => item.evaluate((e) => parseFloat(e.style.left)))
    .toBeLessThan(afterDrag);
  for (let n = 0; n < 20; n++) await p.keyboard.press("Shift+ArrowLeft");
  for (let n = 0; n < 20; n++) await p.keyboard.press("Shift+ArrowUp");
  const bounds = await item.boundingBox(),
    boundsScene = await p.locator(".free-garden").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(boundsScene.x - 0.8);
  expect(bounds.y).toBeGreaterThanOrEqual(boundsScene.y - 0.8);
  checks.push("keyboard positioning and whole-sprite boundary clamp");
  const beforeSave = (await api("/v1/state")).data;
  expect(beforeSave.garden.placements).toHaveLength(0);
  expect(beforeSave.balance).toBe(85);
  for (const placements of [
    [{ itemId: "plant", x: 0, y: 0.5 }],
    [
      { itemId: "plant", x: 0.5, y: 0.5 },
      { itemId: "plant", x: 0.6, y: 0.7 },
    ],
    [{ itemId: "bench", x: 0.5, y: 0.5 }],
    [{ itemId: "seed", x: 0.5, y: 0.5 }],
  ])
    expect(
      (
        await api("/v1/garden", "PUT", {
          revision: beforeSave.garden.revision,
          character: "seed",
          placements,
        })
      ).status,
    ).toBe(400);
  expect((await api("/v1/state")).data.garden.revision).toBe(
    beforeSave.garden.revision,
  );
  checks.push(
    "server rejects invalid boundary, duplicates, unowned items and character-as-decoration without state changes",
  );
  await p.screenshot({ path: "tmp/qa/garden-free-edit.png", fullPage: true });
  await click("변경사항 저장");
  await p.waitForURL("**/garden");
  const saved = (await api("/v1/state")).data.garden;
  expect(saved.placements).toHaveLength(2);
  expect(saved.slots).toEqual({});
  await p.reload();
  await expect(p.locator(".placed-item")).toHaveCount(2);
  for (const width of [320, 480, 375]) {
    await p.setViewportSize({ width, height: 812 });
    for (const value of saved.placements) {
      const position = await p
        .locator(`.placed-item[data-item-id='${value.itemId}']`)
        .evaluate((el) => {
          const a = el.getBoundingClientRect(),
            b = el.parentElement.getBoundingClientRect();
          return {
            x: (a.left + a.width / 2 - b.left) / b.width,
            y: (a.bottom - b.top) / b.height,
          };
        });
      expect(position.x).toBeCloseTo(value.x, 2);
      expect(position.y).toBeCloseTo(value.y, 2);
    }
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
  }
  checks.push(
    "saved coordinates survive reload and stay proportional at 320/375/480px",
  );
  await click("정원 편집");
  await click("작은 화분 배치 중");
  await p.locator(".placed-item.selected").press("ArrowRight");
  await click("뒤로가기");
  await click("저장하지 않고 나가기");
  await p.waitForURL("**/garden");
  expect((await api("/v1/state")).data.garden.placements).toEqual(
    saved.placements,
  );
  checks.push("discard restores the persisted layout");
  await click("정원 편집");
  await click("작은 화분 배치 중");
  await click("배치 해제");
  await click("변경사항 저장");
  await p.waitForURL("**/garden");
  const removed = (await api("/v1/state")).data;
  expect(removed.garden.placements).toHaveLength(1);
  expect(removed.inventory).toContain("plant");
  checks.push("removing a placement keeps ownership");
  const other = await api("/auth/local", "POST", {
      name: "visitor_" + Date.now(),
    }),
    otherToken = other.data.token,
    otherState = (await api("/v1/state", "GET", undefined, otherToken)).data,
    myState = (await api("/v1/state")).data;
  expect(
    (
      await api(
        "/v1/garden",
        "PUT",
        {
          revision: 0,
          character: "seed",
          placements: [{ itemId: "flower", x: 0.65, y: 0.8 }],
        },
        otherToken,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await api("/v1/social/actions", "POST", {
        action: "request",
        code: otherState.code,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await api(
        "/v1/social/actions",
        "POST",
        { action: "accept", code: myState.code },
        otherToken,
      )
    ).status,
  ).toBe(200);
  await p.goto(base + "/friends/" + otherToken.split(".")[0]);
  await expect(p.locator('.placed-item[data-item-id="flower"]')).toBeVisible();
  await expect(
    p.getByRole("button", { name: "분홍 꽃 위치 이동", exact: true }),
  ).toHaveCount(0);
  const readonly = p.locator('.placed-item[data-item-id="flower"]');
  const style = await readonly.getAttribute("style");
  const readBox = await readonly.boundingBox();
  await p.mouse.move(readBox.x + 10, readBox.y + 10);
  await p.mouse.down();
  await p.mouse.move(readBox.x + 60, readBox.y + 60, { steps: 5 });
  await p.mouse.up();
  expect(await readonly.getAttribute("style")).toBe(style);
  checks.push("friends see the actual free layout without edit controls");
  await p.screenshot({ path: "tmp/qa/garden-free-friend.png", fullPage: true });
  await writeFile(
    "tmp/qa/garden-free-placement-report.json",
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  await p.screenshot({
    path: "tmp/qa/garden-free-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
