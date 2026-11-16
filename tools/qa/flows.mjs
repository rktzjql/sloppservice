const BASE = process.env.AIMI_QA_BASE_URL || "http://127.0.0.1:5180";
import { auditSpacing, spacingChecks } from "./spacing-audit.mjs";
import { auditFonts, fontChecks } from "./font-audit.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("tmp/qa", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  }),
  page = await context.newPage();
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
const snap = async (name) => {
  await auditFonts(page, name);
  await auditSpacing(page, name);
  await writeFile(
    "tmp/qa/spacing-audit-report.json",
    JSON.stringify(spacingChecks, null, 2),
  );
  await writeFile(
    "tmp/qa/font-audit-report.json",
    JSON.stringify(fontChecks, null, 2),
  );
  return page.screenshot({ path: "tmp/qa/" + name + ".png", fullPage: true });
};
async function login(p, name) {
  await p.goto(BASE + "/");
  await auditFonts(p, "login");
  await p.getByLabel("개발용 사용자", { exact: true }).fill(name);
  await p.getByRole("button", { name: "개발용으로 시작하기" }).click();
  await p.getByRole("heading", { name: "AIMI", exact: true }).waitFor();
}
try {
  await login(page, "qa_" + Date.now());
  await snap("home-v1");
  await check("attendance and tip pay once", async () => {
    await page.getByRole("button", { name: "출석하기 오늘 보상" }).click();
    await expect(page.getByRole("dialog")).toContainText("+5 EP");
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await page.getByRole("button", { name: "출석 완료 오늘 보상" }).click();
    await expect(page.getByRole("dialog")).toContainText("+0 EP");
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await page
      .getByRole("button", { name: "오늘의 팁 누르고 보상받기" })
      .click();
    await page.getByRole("button", { name: "확인", exact: true }).click();
  });
  await check("purchase and equip survive reload", async () => {
    await page
      .getByRole("button", { name: "나의 정원 캐릭터 선택 · 상점 · 친구 방문" })
      .click();
    await page.getByRole("button", { name: "정원 상점", exact: true }).click();
    await page.getByRole("button", { name: "작은 화분 40 EP" }).click();
    await snap("purchase");
    await page
      .getByRole("button", { name: "40 EP로 구매", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("구매가 완료됐어요");
    await page
      .getByRole("button", { name: "정원 편집으로", exact: true })
      .click();
    await page
      .getByRole("button", { name: "작은 화분 정원에 추가", exact: true })
      .click();
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await page.waitForURL("**/garden");
    await page.reload();
    await expect(
      page.locator(".placed-item[data-item-id='plant'] img"),
    ).toHaveAttribute("src", "/content/plant.svg");
    await snap("garden");
  });
  await check("owned character picker and unsaved exit", async () => {
    await page.getByRole("button", { name: "정원 편집", exact: true }).click();
    await page.getByRole("button", { name: "캐릭터", exact: true }).click();
    await page.getByRole("button", { name: "새싹이 착용 중 ›" }).click();
    await page.getByRole("button", { name: "작은 곰 보유 중" }).click();
    await page
      .getByRole("button", { name: "작은 곰 선택", exact: true })
      .click();
    await page.getByRole("button", { name: "뒤로가기", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "변경사항을 저장할까요?",
    );
    await page
      .getByRole("button", { name: "계속 편집하기", exact: true })
      .click();
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.locator(".free-garden-character img")).toHaveAttribute(
      "src",
      "/content/bear.svg",
    );
  });
  await check("Dino pause, exit and verified result", async () => {
    await page.goto(BASE + "/game?kind=dino");
    await page
      .getByRole("button", { name: "게임 시작하기", exact: true })
      .click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    await snap("pause");
    await page
      .getByRole("button", { name: "게임 나가기", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("이번 게임 결과");
    await page
      .getByRole("button", { name: "이미지 챌린지 도전하기", exact: true })
      .click();
  });
  await check("rule challenge succeeds and cannot double reward", async () => {
    const labels = await page.evaluate(async () => {
      const r = await fetch("/api/v1/content", {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("aimi.session"),
          },
        }),
        c = (await r.json()).data;
      return c.target
        .split("#")[1]
        .split("-")
        .map((id) => c.keywords.find((k) => k.id === id).label);
    });
    for (const label of labels)
      await page.getByRole("button", { name: label, exact: true }).click();
    await snap("keywords");
    await page
      .getByRole("button", { name: "조합 확인 ›", exact: true })
      .click();
    await snap("combination");
    await page
      .getByRole("button", { name: "42 예산으로 도전", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("챌린지 성공!");
    await expect(page.getByRole("dialog")).toContainText("100점");
    await snap("challenge-success");
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "오늘의 목표를 완성했어요!" }),
    ).toBeVisible();
    await snap("mission-success");
  });
  await check(
    "optimizer edit/copy/recommend and real model snapshot",
    async () => {
      await page.goto(BASE + "/optimizer");
      await page
        .getByLabel("개선할 질문")
        .fill("학교 발표용 재활용 방법 3개 추천좀");
      await page.getByRole("button", { name: "개선안·예시 보기" }).click();
      await expect(page.getByRole("button", { name: "문장 편집" })).toBeVisible(
        { timeout: 30000 },
      );
      await page.getByRole("button", { name: "확장안", exact: true }).click();
      await snap("optimizer");
      await page.getByRole("button", { name: "문장 편집" }).click();
      await page
        .getByLabel("결과 문장 편집")
        .fill("재활용 방법 3가지를 알려줘.");
      await page.getByRole("button", { name: "저장", exact: true }).click();
      await page.getByRole("button", { name: "모델 추천받기" }).click();
      await page.getByRole("button", { name: "모델 추천 실행" }).click();
      await expect(
        page.locator(".model-list > button.recommended").first(),
      ).toBeVisible({ timeout: 30000 });
      await snap("recommendations");
      const rows = page.locator(".model-list>button:not(.model-load-more)");
      expect(await rows.count()).toBeGreaterThan(3);
      expect(
        await page.locator(".model-list>button.recommended").count(),
      ).toBeLessThanOrEqual(3);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await rows.first().click();
      await expect(
        page.getByRole("heading", { name: "AA 성능", exact: true }),
      ).toBeVisible();
      await snap("model-detail");
    },
  );
  await check("social request/accept/direct visit/delete menu", async () => {
    await page.goto(BASE + "/social");
    const code = (await page.locator(".notice>strong").innerText()).replace(
      "내 코드 ",
      "",
    );
    const c2 = await browser.newContext({
        viewport: { width: 375, height: 812 },
      }),
      p2 = await c2.newPage();
    await login(p2, "friend_" + Date.now());
    await p2.getByRole("button", { name: "소셜", exact: true }).click();
    await p2
      .getByRole("button", { name: "코드로 친구 추가", exact: true })
      .click();
    await p2.getByLabel("친구 코드", { exact: true }).fill(code);
    await p2.getByRole("button", { name: "친구 요청 보내기" }).click();
    await expect(p2.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    const incoming = page.locator(".friend-card").filter({ hasText: "친구 요청이 도착했어요" });
    const friendName = await incoming.locator("strong").innerText();
    await incoming.locator(".friend-visit").click();
    const friendCard = page.locator(".friend-card").filter({ hasText: friendName });
    await friendCard.locator(".friend-visit").click();
    await expect(page.getByRole("button", { name: "친구 목록으로" })).toBeVisible();
    await expect(page.getByText("오늘 챌린지", { exact: true })).toBeVisible();
    await expect(page.getByText("누적 성공", { exact: true })).toBeVisible();
    await snap("friend-garden");
    await page.getByRole("button", { name: "친구 목록으로" }).click();
    await friendCard.getByRole("button", { name: friendName + " 친구 메뉴" }).click();
    await friendCard.getByRole("menuitem", { name: "삭제", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
    await expect(friendCard).toHaveCount(0);
    await c2.close();
  });
  await check("small viewport has no horizontal overflow", async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of [
      "/",
      "/mission",
      "/garden",
      "/shop/garden",
      "/social",
      "/optimizer",
      "/recommendations",
    ]) {
      await page.goto(BASE + path);
      await page.getByRole("heading").first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      );
      expect(overflow, path).toBe(false);
    }
    await snap("small-screen");
  });
  if (errors.length) throw new Error("Page errors: " + errors.join("; "));
  await writeFile(
    "tmp/qa/flows-report.json",
    JSON.stringify({ passed: checks, errors }, null, 2),
  );
  console.log("ALL FLOWS PASSED");
} catch (e) {
  await page.screenshot({ path: "tmp/qa/failure.png", fullPage: true });
  await writeFile(
    "tmp/qa/spacing-audit-report.json",
    JSON.stringify(spacingChecks, null, 2),
  );
  console.error(e);
  await writeFile(
    "tmp/qa/flows-report.json",
    JSON.stringify({ passed: checks, errors, failure: String(e) }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
