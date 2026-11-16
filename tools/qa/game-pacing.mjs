import { chromium, expect } from "@playwright/test";
import { auditFonts, fontChecks } from "./font-audit.mjs";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true, channel: "chrome" }),
  page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const checks = [];
try {
  await page.goto("http://127.0.0.1:5180/");
  await page
    .getByLabel("개발용 사용자", { exact: true })
    .fill("pacing_" + Date.now());
  await page.getByRole("button", { name: "개발용으로 시작하기" }).click();
  await page.locator(".today-card").waitFor();
  for (const kind of ["crossing", "dino", "runner"]) {
    await page.goto("http://127.0.0.1:5180/game?kind=" + kind);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "게임 시작하기", exact: true })
      .waitFor();
    await auditFonts(page, kind + "-ready");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "게임 시작하기", exact: true })
      .click();
    await page.waitForTimeout(2000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (kind !== "crossing")
      await expect(page.locator(".game-hud")).toContainText("점수 3 / 100");
    await auditFonts(page, kind + "-playing");
    await page.screenshot({ path: "tmp/qa/pacing-" + kind + ".png" });
    // Keep API wall-time validation realistic for the accelerated 2s preview.
    await new Promise((resolve) => setTimeout(resolve, 600));
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    await auditFonts(page, kind + "-paused");
    await page
      .getByRole("button", { name: "게임 나가기", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("이번 게임 결과");
    checks.push({ kind, firstTwoSecondsPlayable: true });
  }
  await writeFile(
    "tmp/qa/game-pacing-report.json",
    JSON.stringify({ checks, fonts: fontChecks }, null, 2),
  );
  console.log(
    JSON.stringify({
      checks,
      fontStates: fontChecks.length,
      fontErrors: fontChecks.flatMap((x) => x.errors),
    }),
  );
} finally {
  await browser.close();
}
