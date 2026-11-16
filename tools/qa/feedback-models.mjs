import { chromium, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { catalogClassifications } from "@aimi/recommender";
import { auditSpacing } from "./spacing-audit.mjs";
const base = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5280";
const browser = await chromium.launch({ headless: true, channel: "chrome" }),
  page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const checks = [];
let recommendationCalls = 0;
try {
  await page.goto(base);
  await page
    .getByLabel("개발용 사용자", { exact: true })
    .fill("model_feedback_" + Date.now());
  await page.getByRole("button", { name: "개발용으로 시작하기" }).click();
  await page.locator(".today-card").waitFor();
  await page.goto(base + "/optimizer");
  await page.getByLabel("개선할 질문").fill("공부 잘하는 법 알려줘");
  await page.getByRole("button", { name: "개선안·예시 보기" }).click();
  await page.getByRole("button", { name: "문장 편집" }).waitFor();
  await expect(page.locator(".phrase-tip")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "확장안", exact: true }).click();
  await expect(page.locator(".prompt-result")).toContainText(
    "항목별로 정리해줘",
  );
  await expect(page.locator(".phrase-tip")).toHaveCount(0);
  checks.push("plain optimizer prompts without tip popups");
  await page.getByRole("button", { name: "모델 추천받기" }).click();
  await expect(page.locator(".model-panel")).toHaveCount(0);
  await page.route("**/api/v1/recommendations", async (r) => {
    recommendationCalls++;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await r.continue();
  });
  await page
    .getByRole("button", { name: "모델 추천 실행", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "업무를 분석하고 모델을 추천하고 있어요.",
  );
  await expect(
    page.getByRole("button", { name: "모델 추천 실행", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".model-list .recommended").first()).toBeVisible({
    timeout: 30000,
  });
  expect(
    await page.locator(".model-list .recommended").count(),
  ).toBeLessThanOrEqual(3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.locator(".model-list > button:not(.model-load-more)").count(),
  ).toBeGreaterThan(0);
  checks.push(
    "visible loading, full catalogue and at most three highlighted recommendations",
  );
  await auditSpacing(page, "inline-model-panel");
  await page.screenshot({
    path: "tmp/qa/inline-model-panel.png",
    fullPage: true,
  });
  const panel = page.locator(".model-panel");
  expect(
    await panel.evaluate((el) =>
      el.previousElementSibling?.getAttribute("aria-expanded"),
    ),
  ).toBe("true");
  await expect(page.locator(".model-panel-handle")).toHaveCount(0);
  const list = page.getByRole("region", { name: "모델 목록", exact: true });
  await list.evaluate((e) => {
    e.scrollTop = e.scrollHeight;
    e.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  checks.push("inline position and native list scrolling without handle");
  const snapshot = JSON.parse(
    await readFile("content/fixtures/models.json", "utf8"),
  );
  const activeTier = await page
    .locator(".tier-list > button[aria-expanded=true] strong")
    .innerText();
  const last = snapshot.models
    .filter((m) => catalogClassifications(snapshot.models).get(m.id)?.tier === activeTier)
    .at(-1);
  await page.getByLabel("모델명·제공사 검색", { exact: true }).fill(last.id);
  await expect(
    page.locator(".model-list > button:not(.model-load-more)"),
  ).toHaveCount(1);
  await expect(page.locator(".model-list")).toContainText(last.name);
  checks.push("search includes the complete catalogue");
  await page
    .getByLabel("모델명·제공사 검색", { exact: true })
    .fill("definitely-no-model-000");
  await expect(page.locator(".model-list")).toContainText(
    "검색 조건에 맞는 모델이 없어요.",
  );
  checks.push("empty search state");
  await page.getByLabel("모델명·제공사 검색", { exact: true }).fill("");
  const callsBeforeTier = recommendationCalls;
  const nextTier = activeTier === "Medium" ? "Small" : "Medium";
  await page
    .locator(".tier-list > button")
    .filter({ hasText: nextTier })
    .click();
  await expect(page.getByRole("status")).not.toContainText(
    "업무를 분석하고 모델을 추천하고 있어요.",
  );
  await expect(page.locator(".model-panel-summary")).toContainText(
    nextTier + " 모델",
  );
  expect(recommendationCalls).toBe(callsBeforeTier);
  await page
    .getByLabel("추천받을 업무", { exact: true })
    .fill("새로운 다른 업무");
  await expect(page.locator(".model-list .recommended")).toHaveCount(0);
  checks.push(
    "tier change and removal of stale recommendation highlights after editing",
  );
  for (const width of [320, 480]) {
    await page.setViewportSize({ width, height: 812 });
    await auditSpacing(page, "model-panel-" + width);
  }
  await writeFile(
    "tmp/qa/feedback-models-report.json",
    JSON.stringify(
      { passed: true, checks, catalogue: snapshot.models.length },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  await page.screenshot({
    path: "tmp/qa/feedback-models-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
}
