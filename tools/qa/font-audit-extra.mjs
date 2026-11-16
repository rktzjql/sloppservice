const BASE = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5180";
import { auditSpacing, spacingChecks } from "./spacing-audit.mjs";
import { chromium, expect } from "@playwright/test";
import { auditFonts, fontChecks } from "./font-audit.mjs";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true, channel: "chrome" }),
  page = await browser.newPage({
    viewport: {
      width: Number(process.env.AIMI_QA_WIDTH || 375),
      height: Number(process.env.AIMI_QA_HEIGHT || 812),
    },
  });
let scenario = null;
await page.route("**/api/v1/state", async (route) => {
  const r = await route.fetch(),
    b = await r.json();
  if (scenario) {
    Object.assign(b.data.daily, scenario);
    b.data.activePlay = null;
    if (scenario.success || scenario.attemptsUsed === 5)
      b.data.latestAttempt = {
        score: scenario.success ? 100 : 45,
        ep: scenario.success ? 30 : 0,
      };
  }
  await route.fulfill({ response: r, json: b });
});
const audit = async (label) => {
  await auditFonts(page, label);
  await auditSpacing(page, label);
  if (
    ["tip-modal", "mission-challenge", "/optimizer", "/garden/edit"].includes(
      label,
    )
  )
    await page.screenshot({
      path: `tmp/qa/spacing-${label.replaceAll("/", "_")}-${process.env.AIMI_QA_WIDTH || 375}.png`,
      fullPage: true,
    });
  await writeFile(
    `tmp/qa/spacing-audit-extra-${process.env.AIMI_QA_WIDTH || 375}-report.json`,
    JSON.stringify(spacingChecks, null, 2),
  );
  await writeFile(
    "tmp/qa/font-audit-extra-report.json",
    JSON.stringify(fontChecks, null, 2),
  );
};
const visit = async (path, label = path) => {
  await page.goto(BASE + path);
  await expect(page.locator(".screen-head")).toBeVisible();
  await audit(label);
};
try {
  await page.goto(BASE + "/");
  await page
    .getByLabel("개발용 사용자", { exact: true })
    .fill("font_all_" + Date.now());
  await page.getByRole("button", { name: "개발용으로 시작하기" }).click();
  await expect(page.locator(".today-card")).toBeVisible();
  await page.getByRole("button", { name: "출석하기 오늘 보상" }).click();
  await audit("attendance-modal");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByRole("button", { name: "오늘의 팁 누르고 보상받기" }).click();
  await audit("tip-modal");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  for (const path of [
    "/account",
    "/shop/garden",
    "/shop/characters",
    "/garden/edit",
    "/social",
    "/optimizer",
    "/recommendations",
    "/challenge",
    "/challenge/combination",
  ])
    await visit(path);
  await visit("/account");
  await page.getByRole("button", { name: "계정 연결 해제·탈퇴" }).click();
  await audit("account-delete-modal");
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await visit("/garden/edit");
  await page.getByRole("button", { name: "캐릭터", exact: true }).click();
  await audit("character-tab");
  await page.locator(".current-character").click();
  await audit("character-picker");
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await visit("/shop/characters");
  await page.locator(".product-grid button").first().click();
  await audit("character-purchase-modal");
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  await visit("/social");
  await page
    .getByRole("button", { name: "코드로 친구 추가", exact: true })
    .click();
  await audit("friend-code-modal");
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();
  for (const [label, patch] of [
    ["mission-before", { playsUsed: 0, attemptsUsed: 0, success: false }],
    ["mission-mid-game", { playsUsed: 2, attemptsUsed: 0, success: false }],
    ["mission-challenge", { playsUsed: 5, attemptsUsed: 2, success: false }],
    ["mission-failed", { playsUsed: 5, attemptsUsed: 5, success: false }],
    ["mission-success", { playsUsed: 5, attemptsUsed: 1, success: true }],
  ]) {
    scenario = patch;
    await visit("/mission", label);
  }
  scenario = null;
  await visit("/optimizer");
  await page
    .getByLabel("개선할 질문")
    .fill("학교 발표용 재활용 방법 3개 추천좀");
  await page.getByRole("button", { name: "개선안·예시 보기" }).click();
  await page.getByRole("button", { name: "문장 편집", exact: true }).waitFor();
  await audit("optimizer-improved");
  await page.getByRole("button", { name: "확장안", exact: true }).click();
  await audit("optimizer-extended");
  await page.getByRole("button", { name: "문장 편집", exact: true }).click();
  await audit("optimizer-edit");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  console.log(
    JSON.stringify({
      states: fontChecks.length,
      elements: fontChecks.reduce((n, x) => n + x.elements, 0),
      errors: fontChecks.flatMap((x) => x.errors),
    }),
  );
} finally {
  await browser.close();
}
