import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("tmp/qa", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5180/");
await page.getByRole("button", { name: "개발용으로 시작하기" }).click();
await page.getByRole("heading", { name: "AIMI", exact: true }).waitFor();
await page.screenshot({ path: "tmp/qa/home.png", fullPage: true });
console.log(
  JSON.stringify({
    title: await page.title(),
    headings: await page.getByRole("heading").allTextContents(),
    errors,
  }),
);
await browser.close();
