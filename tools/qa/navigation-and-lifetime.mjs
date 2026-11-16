import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const base = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5280";
const b = await chromium.launch({ headless: true, channel: "chrome" }),
  p = await b.newPage({ viewport: { width: 375, height: 812 } }),
  checks = [];
const click = (name) => p.getByRole("button", { name, exact: true }).click();
async function selectFlower() {
  await click("분홍 꽃 정원에 추가");
}
async function backHome() {
  await click("뒤로가기");
  await expect(p).toHaveURL(base + "/");
  await p.goBack();
  await expect(p).not.toHaveURL(/\/garden\/edit/);
}
async function optimize() {
  const response = p.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/optimizer/jobs") &&
      r.request().method() === "POST",
  );
  await click("개선안·예시 보기");
  const r = await response;
  expect(r.status()).toBe(200);
  const data = await r.json();
  await p.getByRole("button", { name: "문장 편집", exact: true }).waitFor();
  return data.data.id;
}
try {
  await p.goto(base);
  await p
    .getByLabel("개발용 사용자", { exact: true })
    .fill("navigation_" + Date.now());
  await click("개발용으로 시작하기");
  await p.locator(".today-card").waitFor();
  await click("정원");
  await expect(
    p.getByRole("button", { name: "소셜 · 친구 만나기", exact: true }),
  ).toHaveCount(0);
  await click("정원 편집");
  await selectFlower();
  await click("뒤로가기");
  await expect(p.getByRole("dialog")).toContainText("변경사항을 저장할까요?");
  await click("저장하고 나가기");
  await expect(p).toHaveURL(base + "/garden");
  await backHome();
  checks.push(
    "removed social card; free item placement; save-and-leave has no edit history loop",
  );
  await p.goto(base + "/garden");
  await click("정원 편집");
  await click("분홍 꽃 위치 이동");
  await click("배치 해제");
  await click("변경사항 저장");
  await expect(p).toHaveURL(base + "/garden");
  await backHome();
  checks.push("unequip, direct save and back do not reopen editor");
  await p.goto(base + "/garden");
  await click("정원 편집");
  await selectFlower();
  await click("뒤로가기");
  await click("저장하지 않고 나가기");
  await expect(p).toHaveURL(base + "/garden");
  await expect(
    p.locator(".placed-item[data-item-id='flower'] img"),
  ).toHaveCount(0);
  await backHome();
  checks.push(
    "discard and back preserve saved garden without reopening editor",
  );
  await p.goto(base + "/optimizer");
  await p.getByLabel("개선할 질문").fill("재활용 방법 3개 알려줘");
  const first = await optimize();
  await p.goto("about:blank");
  await p.goBack();
  await expect(p.getByLabel("개선할 질문")).toHaveValue("");
  await expect(p.locator(".prompt-result")).toHaveCount(0);
  await p.getByLabel("개선할 질문").fill("재활용 방법 3개 알려줘");
  const second = await optimize();
  expect(second).not.toBe(first);
  checks.push(
    "optimizer clears on external navigation and creates a new server job per visit",
  );
  await click("모델 추천받기");
  await expect(p.getByLabel("추천받을 업무")).toHaveValue(
    "재활용 방법 3개 알려줘",
  );
  expect(
    await p.evaluate(() => sessionStorage.getItem("aimi.recommendation.input")),
  ).toBeNull();
  let calls = 0;
  p.on("request", (r) => {
    if (r.url().endsWith("/api/v1/recommendations") && r.method() === "POST")
      calls++;
  });
  await click("모델 추천 실행");
  await expect(p.locator(".model-list > .recommended")).toHaveCount(3, {
    timeout: 15000,
  });
  for (const label of [
    "Medium 복합 조건·분석 ›",
    "High 복잡한 추론 ›",
    "Small 가벼운 요약·변환 ›",
  ]) {
    await click(label);
    await expect(p.getByRole("status")).not.toContainText("추천하고 있어요");
    await expect(p.locator(".model-list > .recommended")).toHaveCount(3);
  }
  expect(calls).toBe(1);
  checks.push(
    "one-shot handoff; all three tier switches make zero new API calls and show no loading screen",
  );
  await p.goto("about:blank");
  await p.goBack();
  await expect(p.getByLabel("추천받을 업무")).toHaveValue("");
  await expect(p.locator(".model-list > .recommended")).toHaveCount(0);
  expect(
    await p.evaluate(() =>
      Object.keys(sessionStorage).filter((k) =>
        /^aimi\.(optimizer|recommendation|model)\./.test(k),
      ),
    ),
  ).toEqual([]);
  checks.push(
    "recommendation input, results, highlights and storage clear on leaving the site",
  );
  await p.screenshot({ path: "tmp/qa/ai-reset.png", fullPage: true });
  await writeFile(
    "tmp/qa/navigation-lifetime-report.json",
    JSON.stringify({ passed: true, checks }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, checks }));
} catch (e) {
  await p.screenshot({
    path: "tmp/qa/navigation-lifetime-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await b.close();
}
