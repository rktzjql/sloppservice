import { chromium, expect } from "@playwright/test";
import { catalogClassifications } from "@aimi/recommender";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const base = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5280";
const snapshot = JSON.parse(
  await readFile("content/fixtures/models.json", "utf8"),
);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const checks = [];
let gameWrites = 0,
  recommendCalls = 0;
page.on("request", (r) => {
  if (r.method() === "POST" && r.url().includes("/v1/game-plays")) gameWrites++;
  if (r.method() === "POST" && r.url().includes("/v1/recommendations"))
    recommendCalls++;
});
const state = () =>
  page.evaluate(async () => {
    const r = await fetch("/api/v1/state", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("aimi.session"),
      },
    });
    return (await r.json()).data;
  });
try {
  await mkdir("tmp/qa", { recursive: true });
  await page.goto(base);
  await page
    .getByLabel("개발용 사용자", { exact: true })
    .fill("tier_games_" + Date.now());
  await page
    .getByRole("button", { name: "개발용으로 시작하기", exact: true })
    .click();
  await page.locator(".today-card").waitFor();
  await page.goto(base + "/recommendations");
  await expect(page.locator(".model-panel")).toHaveCount(0);
  const classifications = catalogClassifications(snapshot.models);
  for (const tier of ["Small", "Medium", "High"]) {
    const count = snapshot.models.filter((m) => classifications.get(m.id)?.tier === tier).length;
    await page.locator(".tier-list > button").filter({ hasText: tier }).click();
    const panel = page.getByRole("region", {
      name: tier + " 모델 비교",
      exact: true,
    });
    await panel.waitFor();
    await expect(panel.locator(".model-panel-heading")).toContainText(
      count + "개",
    );
    await expect(
      panel.locator(".model-list > button:not(.model-load-more)"),
    ).toHaveCount(Math.min(60, count));
    await expect(panel.locator(".model-evidence").first()).toBeVisible();
    const positions = await panel.evaluate((el) => ({
      previous: el.previousElementSibling?.textContent,
      next: el.nextElementSibling?.textContent,
    }));
    expect(positions.previous).toContain(tier);
    await expect(page.locator(".model-panel")).toHaveCount(1);
  }
  checks.push(
    "complete disjoint catalogue tiers appear below their selected box",
  );
  await page
    .getByLabel("추천받을 업무", { exact: true })
    .fill("문장을 요약해줘");
  await page
    .getByRole("button", { name: "모델 추천 실행", exact: true })
    .click();
  await expect(page.locator(".model-panel .recommended").first()).toBeVisible();
  const beforeCalls = recommendCalls;
  await page
    .locator(".tier-list > button")
    .filter({ hasText: "Medium" })
    .click();
  await expect(page.locator(".model-panel-heading")).toContainText("Medium");
  expect(recommendCalls).toBe(beforeCalls);
  await expect(page.locator(".model-panel .recommended")).toHaveCount(3);
  await page.screenshot({ path: "tmp/qa/tier-inline.png", fullPage: true });
  await page.locator(".model-panel .model-list > button").first().click();
  await expect(page.getByText("코드 평가", { exact: false })).toHaveCount(0);
  checks.push(
    "tier switch has no extra API analysis; highlights stay within tier; null coding card hidden",
  );
  const before = await state();
  for (const [kind, label] of [
    ["crossing", "길 건너기"],
    ["dino", "Dino"],
    ["runner", "Temple Run"],
  ]) {
    await page.goto(base + "/mission");
    const picker = page.getByRole("region", { name: "테스트 게임 선택" });
    await picker.locator("button").filter({ hasText: label }).click();
    await page
      .getByRole("button", { name: "게임 시작하기", exact: true })
      .click();
    await expect(page.locator(".game-hud")).toContainText("연습");
    await page.screenshot({ path: "tmp/qa/game-mobile-" + kind + ".png" });
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      const box = await page.locator("canvas").boundingBox();
      expect(box.width).toBeLessThanOrEqual(480);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(48);
      expect(box.y + box.height).toBeLessThanOrEqual(813);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    await page
      .getByRole("button", { name: "게임 나가기", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("연습 결과");
    await page
      .getByRole("button", { name: "테스트 게임 선택으로", exact: true })
      .click();
    const after = await state();
    expect(after.balance).toBe(before.balance);
    expect(after.daily).toEqual(before.daily);
    expect(after.activePlay).toEqual(before.activePlay);
    checks.push(
      kind +
        ": selectable, responsive canvas, pause/exit, unchanged balance/daily/session",
    );
  }
  expect(gameWrites).toBe(0);
  await writeFile(
    "tmp/qa/tier-games-report.json",
    JSON.stringify({ passed: true, checks, gameWrites }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks, gameWrites }));
} catch (e) {
  await page.screenshot({
    path: "tmp/qa/tier-games-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
