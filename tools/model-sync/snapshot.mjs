/** Manual snapshot adapter. Never logs response bodies or keys. No automatic publishing. */
import { config } from "dotenv";
import { applyCatalogueSelection } from "./catalogue-selection.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
for (const name of [
  "apps/api/.env.local",
  "tools/model-sync/.env.local",
  ".env.local",
])
  config({ path: new URL(name, root), quiet: true });
export function normalizeOpenRouter(raw, asOf) {
  return raw.data
    .filter(
      (m) =>
        m.architecture?.output_modalities?.length &&
        m.pricing?.prompt != null &&
        m.pricing?.completion != null,
    )
    .map((m) => ({
      id: m.id,
      name: m.name.replace(/^[^:]+: /, ""),
      provider:
        {
          google: "Google",
          openai: "OpenAI",
          anthropic: "Anthropic",
          nvidia: "NVIDIA",
          xiaomi: "Xiaomi",
          cohere: "Cohere",
          meta: "Meta",
          stepfun: "StepFun",
          "ibm-granite": "IBM",
          thinkingmachines: "Thinking Machines",
          mistralai: "Mistral AI",
          minimax: "MiniMax",
          "meta-llama": "Meta",
          qwen: "Alibaba",
          moonshotai: "Kimi",
          "z-ai": "Z AI",
          "x-ai": "SpaceXAI",
          deepseek: "DeepSeek",
          amazon: "Amazon",
          liquid: "Liquid AI",
          perplexity: "Perplexity",
          microsoft: "Microsoft",
          nousresearch: "Nous Research",
          "bytedance-seed": "ByteDance Seed",
          upstage: "Upstage",
        }[m.id.split("/")[0]] ?? m.id.split("/")[0],
      canonicalId: m.canonical_slug ?? m.id,
      description: m.description ?? "",
      inputModalities: m.architecture?.input_modalities ?? [],
      outputModalities: m.architecture?.output_modalities ?? [],
      supportedParameters: m.supported_parameters ?? [],
      cacheInputPrice:
        m.pricing.input_cache_read == null
          ? null
          : Number(m.pricing.input_cache_read),
      context: m.context_length,
      maxOutput: m.top_provider?.max_completion_tokens ?? 0,
      capabilities: [
        "text",
        ...(m.architecture?.input_modalities?.includes("image")
          ? ["image"]
          : []),
        ...(m.supported_parameters?.some((p) =>
          ["response_format", "structured_outputs"].includes(p),
        )
          ? ["json"]
          : []),
        ...(m.supported_parameters?.includes("tools") ? ["tools"] : []),
      ],
      inputPrice: Number(m.pricing.prompt),
      outputPrice: Number(m.pricing.completion),
      intelligence: null,
      coding: null,
      speed: null,
      latency: null,
      source: "OpenRouter Models API",
      asOf,
      indexVersion: "unmapped",
      verified: false,
      aaMetadata: {
        matched: false,
        indices: {},
        firstAnswerToken: null,
        endToEnd: null,
      },
    }))
    .filter(
      (m) => Number.isFinite(m.inputPrice) && Number.isFinite(m.outputPrice),
    );
}
export function mergeAA(models, aa, mappings) {
  const byId = new Map((aa.data ?? []).map((m) => [m.id, m]));
  return models.map((m) => {
    const map = mappings.find((x) => x.openrouterId === m.id);
    if (!map) return m;
    const a = byId.get(map.aaId);
    if (
      !a ||
      !map.reviewed ||
      String(aa.intelligence_index_version) !== String(map.indexVersion)
    )
      return m;
    const intelligence = a.evaluations?.artificial_analysis_intelligence_index,
      coding = a.evaluations?.artificial_analysis_coding_index;
    return {
      ...m,
      intelligence: typeof intelligence === "number" ? intelligence : null,
      coding: typeof coding === "number" ? coding : null,
      speed: a.performance?.median_output_tokens_per_second ?? null,
      latency: a.performance?.median_time_to_first_token_seconds ?? null,
      indexVersion: map.indexVersion,
      source: "OpenRouter Models API · Artificial Analysis",
      verified: true,
      aaMetadata: {
        matched: true,
        indices: Object.fromEntries(
          Object.entries(a.evaluations ?? {}).filter(
            ([key]) =>
              ![
                "artificial_analysis_intelligence_index",
                "artificial_analysis_coding_index",
                "artificial_analysis_agentic_index",
              ].includes(key),
          ),
        ),
        firstAnswerToken:
          a.performance?.median_time_to_first_answer_token_seconds ?? null,
        endToEnd:
          a.performance?.median_end_to_end_response_time_seconds ?? null,
      },
    };
  });
}
if (
  process.argv[1] &&
  new URL("file://" + process.argv[1]).pathname ===
    new URL(import.meta.url).pathname
) {
  const started = new Date().toISOString();
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models?output_modalities=all", {
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("OPENROUTER_HTTP_" + r.status);
    let models = normalizeOpenRouter(await r.json(), started);
    let mappings = [];
    try {
      mappings = JSON.parse(
        await readFile(new URL("content/model-mappings.json", root), "utf8"),
      );
    } catch {}
    const selection = JSON.parse(
      await readFile(
        new URL("content/catalog/model-selection-156.json", root),
        "utf8",
      ),
    );
    let aaData = JSON.parse(
      await readFile(new URL("content/fixtures/aa-public.json", root), "utf8"),
    );
    let aaAsOf = selection.aaAsOf;
    let aaStatus = "stored-reference";
    if (process.env.ARTIFICIAL_ANALYSIS_API_KEY || process.env.AA_API_KEY) {
      const r = await fetch(
        "https://artificialanalysis.ai/api/v2/language/models/free",
        {
          headers: {
            "x-api-key":
              process.env.ARTIFICIAL_ANALYSIS_API_KEY || process.env.AA_API_KEY,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      aaStatus = "http-" + r.status;
      if (r.ok) {
        const aa = await r.json();
        for (
          let page = 2;
          page <= Math.min(aa.pagination?.total_pages ?? 1, 10);
          page++
        ) {
          const next = await fetch(
            "https://artificialanalysis.ai/api/v2/language/models/free?page=" +
              page,
            {
              headers: {
                "x-api-key":
                  process.env.ARTIFICIAL_ANALYSIS_API_KEY ||
                  process.env.AA_API_KEY,
              },
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!next.ok) throw new Error("AA_PAGE_HTTP_" + next.status);
          const part = await next.json();
          if (part.intelligence_index_version !== aa.intelligence_index_version)
            throw new Error("AA_VERSION_CHANGED");
          aa.data.push(...part.data);
        }
        await writeFile(
          new URL("content/fixtures/aa-public.json", root),
          JSON.stringify(aa, null, 2) + "\n",
        );
        aaData = aa;
        aaAsOf = started;
        models = mergeAA(models, aa, mappings);
      }
    }
    models = mergeAA(models, aaData, mappings);
    models = applyCatalogueSelection(
      models,
      aaData,
      selection,
      mappings,
      aaAsOf,
    );
    const output = {
      selectionVersion: selection.version,
      version: "manual-" + started,
      developmentSample: false,
      asOf: started,
      aaStatus,
      models,
    };
    if (!models.length) throw new Error("EMPTY_SNAPSHOT");
    await mkdir(new URL("content/fixtures/", root), { recursive: true });
    await writeFile(
      new URL("content/fixtures/models.json", root),
      JSON.stringify(output, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        models: models.length,
        verified: models.filter((m) => m.verified).length,
        aaStatus,
        snapshot: "content/fixtures/models.json",
      }),
    );
  } catch (e) {
    console.error("Snapshot unchanged:", e.message);
    process.exitCode = 1;
  }
}
