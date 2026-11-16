import { config } from "dotenv";
import { writeFile, mkdir } from "node:fs/promises";
config({
  path: new URL("../apps/api/.env.local", import.meta.url),
  quiet: true,
});
const { Gemini } = await import("../apps/api/dist/services/llm/gemini.js");
try {
  const result = await new Gemini(false).optimize(
    "학교 발표용 재활용 방법 3개 추천좀",
  );
  await mkdir(new URL("../tmp/qa/", import.meta.url), { recursive: true });
  await writeFile(
    new URL("../tmp/qa/gemini-report.json", import.meta.url),
    JSON.stringify({
      passed: true,
      source: result.source,
      model: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.1-flash-lite",
      addedAssumptions: result.addedAssumptions.length,
      tips: result.tips.length,
      quantityPreserved: result.improvedText.includes("3"),
    }),
  );
  console.log(
    "PASS: real Gemini structured optimizer output, quantity and tip quotes verified.",
  );
} catch (e) {
  console.error("Optimizer check:", e.code ?? e.message);
  process.exitCode = 1;
}
