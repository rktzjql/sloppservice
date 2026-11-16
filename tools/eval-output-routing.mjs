import { publishAvailableModels } from "../packages/contracts/dist/index.js";
/** Opt-in bounded live semantic smoke: 8 synthetic prompts, no image/video generation. */
import { config } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { Gemini } from "../apps/api/dist/services/llm/gemini.js";
import { TASK_PROFILE_VERSION } from "../apps/api/dist/services/llm/prompts.js";
import { recommend } from "../packages/recommender/dist/index.js";
config({ path: "apps/api/.env.local", quiet: true });
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const sourceModels = [
  ...(await read("content/fixtures/models.json")).models,
  ...(await read("content/fixtures/models-media.json")).models,
];
const models = publishAvailableModels(
  sourceModels,
  await read("content/catalog/model-availability.json"),
);
const cases = [
  { text: "동네 빵집의 홍보용 이미지를 만들어줘.", expected: "image" },
  { text: "동네 빵집의 홍보용 영상을 제작해줘.", expected: "video" },
  { text: "동네 빵집 홍보 영상의 대본을 작성해줘.", expected: "text" },
  {
    text: "첨부한 사진을 보고 제품의 특징을 설명해줘.",
    expected: "text",
    input: "image",
  },
  {
    text: "신제품 홍보 영상을 6초, 720p, 16:9로 만들어줘. 오디오는 필요 없어.",
    expected: "video",
    media: {
      durationSeconds: 6,
      resolution: "720p",
      aspectRatio: "16:9",
      generateAudio: false,
    },
  },
  {
    text: "행사 안내문을 한국어 나레이션 음성으로 읽어줘.",
    expected: "speech",
  },
  { text: "로고 생성용 프롬프트를 한 문장으로 작성해줘.", expected: "text" },
  {
    text: "첨부한 제품 사진 한 장의 배경을 흰색으로 수정해줘.",
    expected: "image",
    input: "image",
    media: { operation: "edit", referenceImages: 1 },
  },
];
const report = {
  checkedAt: new Date().toISOString(),
  analysisVersion: TASK_PROFILE_VERSION,
  scope:
    "Synthetic output-kind routing only. Not generation quality validation.",
  cases: [],
};
for (const c of cases) {
  try {
    const { task, source } = await new Gemini(false).analyze(c.text);
    const pass =
      (!(c.expected === "image" || c.expected === "video") ||
        c.input ||
        !task.requiredCapabilities.includes(c.expected)) &&
      source === "gemini" &&
      task.outputKind === c.expected &&
      (!c.input || task.requiredCapabilities.includes(c.input)) &&
      Object.entries(c.media ?? {}).every(
        ([key, val]) => task.media?.[key] === val,
      );
    const r = recommend(models, task, task.suggestedTier, new Date());
    report.cases.push({
      ...c,
      task,
      source,
      pass,
      recommendationStatus: r.status,
      models: r.models.map((m) => ({ id: m.id, outputs: m.outputModalities })),
    });
    console.log(
      JSON.stringify({
        expected: c.expected,
        actual: task.outputKind,
        tier: task.suggestedTier,
        pass,
        status: r.status,
        count: r.models.length,
      }),
    );
  } catch (e) {
    report.cases.push({ ...c, pass: false, error: e.code ?? e.message });
    console.log("Routing check failed:", e.code ?? e.message);
  }
  await writeFile(
    "output/model-audit/multimodal/routing-eval.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  await new Promise((r) => setTimeout(r, 4000));
}
console.log(
  JSON.stringify({
    passed: report.cases.filter((c) => c.pass).length,
    total: cases.length,
  }),
);
if (report.cases.some((c) => !c.pass)) process.exitCode = 1;
