import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/*", (route) => {
  const u = route.request().url();
  if (!u.startsWith("http://127.0.0.1:5200") && !u.startsWith("data:")) {
    external.push(u);
    return route.abort();
  }
  return route.continue();
});
await page.goto("http://127.0.0.1:5200");
await page.waitForTimeout(2000);
assert.equal(await page.getByRole("navigation").getByRole("button").count(), 3);
assert.equal(await page.getByText("친구", { exact: true }).count(), 0);
await page.getByRole("button", { name: "출석하기" }).click();
await page.getByText("+3 EP", { exact: true }).waitFor();
await page.getByRole("button", { name: "확인", exact: true }).click();
await page.goto("http://127.0.0.1:5200/");
await page.getByText("새싹이님, 오늘도 한 판 어때요?").waitFor();
assert.match(await page.locator(".balance").innerText(), /3/);
await page.getByRole("button", { name: "오늘의 팁" }).click();
await page.getByRole("button", { name: "확인", exact: true }).click();
await page.goto("http://127.0.0.1:5200/");
await page.getByText("새싹이님, 오늘도 한 판 어때요?").waitFor();
assert.match(await page.locator(".balance").innerText(), /4/);
await page
  .getByRole("button", { name: "계정 관리", exact: true })
  .first()
  .click();
await page.getByRole("button", { name: "닉네임 설정" }).click();
await page
  .getByRole("textbox", { name: "닉네임", exact: true })
  .fill("모바일새싹");
await page.getByRole("button", { name: "닉네임 저장" }).click();
await page.getByText("닉네임을 저장했어요.", { exact: true }).waitFor();
await page.goto("http://127.0.0.1:5200/");
await page
  .getByText("모바일새싹님, 오늘도 한 판 어때요?", { exact: true })
  .waitFor();
await page.goto("http://127.0.0.1:5200");
await page.getByRole("button", { name: /프롬프트 개선기/ }).click();
await page
  .getByRole("textbox", { name: "개선할 질문" })
  .fill("질문을 개선해주세요");
assert.equal(
  await page.getByRole("button", { name: "AI 연결 준비 중" }).isDisabled(),
  true,
);
await page.getByRole("button", { name: "뒤로가기" }).click();
await page.getByRole("button", { name: /AI 모델 추천/ }).click();
await page.waitForTimeout(600);
assert.equal(
  await page.getByRole("button", { name: "모델 추천 실행" }).isDisabled(),
  true,
);
assert.match(await page.locator("body").innerText(), /Small/);
await page.getByRole("button", { name: "뒤로가기" }).click();
await page
  .getByRole("navigation")
  .getByRole("button", { name: "정원", exact: true })
  .click();
await page.getByRole("button", { name: "정원 상점", exact: true }).click();
await page.waitForTimeout(300);
assert.match(await page.locator("body").innerText(), /EP/);
await page.goto("http://127.0.0.1:5200");
await page
  .getByRole("navigation")
  .getByRole("button", { name: "미션", exact: true })
  .click();
await page.getByRole("button", { name: "게임 시작하기", exact: true }).click();
await page.locator("canvas").waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: "/workspace/work/offline-game.png" });
await page.goto("http://127.0.0.1:5200");
await page.screenshot({ path: "/workspace/work/offline-home.png" });
await page
  .getByRole("button", { name: "계정 관리", exact: true })
  .first()
  .click();
await page
  .getByRole("button", { name: "기기 기록 초기화", exact: true })
  .click();
await page.getByRole("button", { name: "삭제하기", exact: true }).click();
await page.getByText("새싹이님, 오늘도 한 판 어때요?").waitFor();
assert.match(await page.locator(".balance").innerText(), /0/);
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
console.log(
  "PASS: attendance, tip, reload persistence, profile, garden, shop, game, AI disabled, reset; zero external requests and runtime errors",
);

await page.screenshot({ path: "/workspace/work/offline-home.png" });
console.log("ERRORS", errors, "EXTERNAL", external);
await browser.close();
