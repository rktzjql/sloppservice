import { chromium, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  page = await browser.newPage({ viewport: { width: 375, height: 812 } });
try {
  const health = await fetch("http://127.0.0.1:8081/health/live").then((r) =>
    r.json(),
  );
  if (!health.persistent)
    throw new Error(
      "This accelerated-clock test requires an isolated local server with AIMI_DEV_PERSIST_STATE=true; the default preview resets on restart.",
    );
  await page.goto("http://127.0.0.1:5180/");
  await page
    .getByLabel("개발용 사용자", { exact: true })
    .fill("cap_" + Date.now());
  await page.getByRole("button", { name: "개발용으로 시작하기" }).click();
  await page.locator(".today-card").waitFor();
  await page.goto("http://127.0.0.1:5180/game?kind=dino");
  await page
    .getByRole("button", { name: "게임 시작하기", exact: true })
    .waitFor();
  const uid = await page.evaluate(
    () => localStorage.getItem("aimi.session").split(".")[0],
  );
  // Disposable localhost fixture only: permit accelerated browser clock while server still checks wall time.
  const file = "tmp/prototype/state.json",
    data = JSON.parse(await readFile(file, "utf8")),
    p = Object.values(data[uid].plays).find((p) => p.status === "running");
  p.startedAt -= 65000;
  await writeFile(file, JSON.stringify(data), { mode: 0o600 });
  await page.clock.install();
  await page
    .getByRole("button", { name: "게임 시작하기", exact: true })
    .click();
  await page.clock.runFor(2400);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Space");
    await page.clock.runFor(3000);
  }
  await expect(page.getByRole("dialog")).toContainText("최고 점수 달성!", {
    timeout: 15000,
  });
  await expect(
    page.getByRole("button", { name: "챌린지 도전하러 가기", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "바로 재시도하기", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText("100 / 100점");
  await page.screenshot({ path: "tmp/qa/game-cap.png", fullPage: true });
  await writeFile(
    "tmp/qa/game-cap-report.json",
    JSON.stringify({
      passed: true,
      method:
        "Accelerated browser clock with isolated local play timestamp fixture; server replay and cap verified",
      singleCTA: true,
    }),
  );
  console.log(
    "PASS: simulated mobile Dino reaches100, server replay accepts, completion has single challenge CTA",
  );
} catch (e) {
  await page.screenshot({
    path: "tmp/qa/game-cap-failure.png",
    fullPage: true,
  });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
