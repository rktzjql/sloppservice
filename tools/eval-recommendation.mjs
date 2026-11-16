import { publishAvailableModels } from "../packages/contracts/dist/index.js";
/** Bounded, opt-in live eval. Calls configured Gemini; never grades its own output using another LLM. */
import { config } from "dotenv";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Gemini } from "../apps/api/dist/services/llm/gemini.js";
import { TASK_PROFILE_VERSION } from "../apps/api/dist/services/llm/prompts.js";
import {
  recommend,
  modelTier,
  MODEL_GROUP_POLICY_VERSION,
  RECOMMENDATION_POLICY_VERSION,
} from "../packages/recommender/dist/index.js";
config({
  path: new URL("../apps/api/.env.local", import.meta.url),
  quiet: true,
});
const dataset = JSON.parse(
  await readFile(
    new URL("../content/evals/recommendation-routing-v1.json", import.meta.url),
    "utf8",
  ),
);
const snapshot = JSON.parse(
  await readFile(
    new URL("../content/fixtures/models.json", import.meta.url),
    "utf8",
  ),
);
const mediaSnapshot = JSON.parse(
  await readFile(
    new URL("../content/fixtures/models-media.json", import.meta.url),
    "utf8",
  ),
);
const availabilityPolicy = JSON.parse(
  await readFile(
    new URL("../content/catalog/model-availability.json", import.meta.url),
    "utf8",
  ),
);
snapshot.models = publishAvailableModels(
  [...snapshot.models, ...mediaSnapshot.models],
  availabilityPolicy,
);
const selected = process.argv
  .find((a) => a.startsWith("--ids="))
  ?.slice(6)
  .split(",");
const cases = selected
  ? dataset.cases.filter((c) => selected.includes(c.id))
  : dataset.cases;
if (
  !cases.length ||
  selected?.some((id) => !dataset.cases.some((c) => c.id === id))
) {
  throw new Error("Unknown or empty evaluation case selection");
}
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const report = {
  checkedAt: new Date().toISOString(),
  datasetVersion: dataset.version,
  requestedCases: cases.length,
  datasetSha256: createHash("sha256")
    .update(JSON.stringify(dataset))
    .digest("hex"),
  analysisVersion: TASK_PROFILE_VERSION,
  groupPolicyVersion: MODEL_GROUP_POLICY_VERSION,
  recommendationPolicyVersion: RECOMMENDATION_POLICY_VERSION,
  snapshotVersion: snapshot.version,
  snapshotAsOf: snapshot.asOf,
  model: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.1-flash-lite",
  scope: dataset.scope,
  note: "Tier labels are AIMI policy annotations, not objective proof of the recommended models solving these tasks. Exact/boundary cases are reported separately.",
  cases: [],
};
await mkdir("output/model-audit", { recursive: true });
const out = "output/model-audit/recommendation-eval-" + runId + ".json";
let consecutiveProviderErrors = 0;
for (const c of cases) {
  const text = c.text + (c.repeatText ?? "").repeat(c.repeatCount ?? 0);
  try {
    const { task, source } = await new Gemini(false).analyze(text);
    const tierPass = c.acceptedTiers.includes(task.suggestedTier);
    const featuresPass =
      (c.requiredCapabilities ?? []).every((x) =>
        task.requiredCapabilities.includes(x),
      ) &&
      (c.forbiddenCapabilities ?? []).every(
        (x) => !task.requiredCapabilities.includes(x),
      );
    const taskTypePass = !c.taskType || task.taskType === c.taskType;
    const unknownsPass = !c.needsUnknowns || task.unknowns.length > 0;
    const result = recommend(snapshot.models, task, task.suggestedTier);
    const cost = (m) => 2000 * m.inputPrice + 1000 * m.outputPrice;
    const contractPass =
      result.models.length <= 3 &&
      new Set(result.models.map((m) => m.id)).size === result.models.length &&
      result.models.every(
        (m, i) =>
          m.verified &&
          modelTier(snapshot.models, m) === task.suggestedTier &&
          task.requiredCapabilities.every((x) => m.capabilities.includes(x)) &&
          typeof m[task.taskType === "coding" ? "coding" : "intelligence"] ===
            "number" &&
          m[task.taskType === "coding" ? "coding" : "intelligence"] >=
            result.threshold &&
          [m.inputPrice, m.outputPrice].every(
            (p) => Number.isFinite(p) && p >= 0,
          ) &&
          m.context >= 3000 &&
          m.maxOutput >= 1000 &&
          Date.parse(m.asOf) <= Date.now() &&
          Date.now() - Date.parse(m.asOf) <= 30 * 86400_000 &&
          (!i || cost(result.models[i - 1]) <= cost(m)),
      );
    report.cases.push({
      id: c.id,
      kind: c.kind,
      acceptedTiers: c.acceptedTiers,
      task,
      source,
      tierPass,
      featuresPass,
      taskTypePass,
      unknownsPass,
      contractPass,
      passed:
        tierPass &&
        featuresPass &&
        taskTypePass &&
        unknownsPass &&
        contractPass,
      recommendationStatus: result.status,
      recommendedModelIds: result.models.map((m) => m.id),
    });
    consecutiveProviderErrors = 0;
    console.log(
      JSON.stringify({
        id: c.id,
        actual: task.suggestedTier,
        expected: c.acceptedTiers,
        passed: report.cases.at(-1).passed,
        recommendationStatus: result.status,
      }),
    );
  } catch (e) {
    report.cases.push({
      id: c.id,
      kind: c.kind,
      error: e.code ?? e.name,
      passed: false,
    });
    consecutiveProviderErrors++;
    console.log(JSON.stringify({ id: c.id, error: e.code ?? e.name }));
  }
  await writeFile(out, JSON.stringify(report, null, 2) + "\n");
  if (consecutiveProviderErrors >= 3) {
    report.stopped =
      "Three consecutive provider/schema failures; no further calls.";
    break;
  }
  // Keep this evaluation gentle on shared provider quotas, while the tool yields progress normally.
  if (c !== cases.at(-1)) await new Promise((r) => setTimeout(r, 4000));
}
const aggregate = (rows) => ({
  total: rows.length,
  passed: rows.filter((r) => r.passed).length,
  tierPassed: rows.filter((r) => r.tierPass).length,
  providerOrSchemaFailures: rows.filter((r) => r.error).length,
  confusion: Object.fromEntries(
    ["Small", "Medium", "High"].map((t) => [
      t,
      rows.filter((r) => r.task?.suggestedTier === t).length,
    ]),
  ),
});
report.summary = {
  overall: aggregate(report.cases),
  core: aggregate(report.cases.filter((r) => r.kind === "core")),
  boundary: aggregate(report.cases.filter((r) => r.kind === "boundary")),
  failureIds: report.cases.filter((r) => !r.passed).map((r) => r.id),
};
await writeFile(out, JSON.stringify(report, null, 2) + "\n");
await writeFile(
  "output/model-audit/recommendation-eval-latest.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    file: out,
    summary: report.summary,
    stopped: report.stopped,
  }),
);
if (report.summary.failureIds.length || report.stopped) process.exitCode = 1;
