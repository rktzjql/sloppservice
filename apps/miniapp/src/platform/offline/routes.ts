// Local routing adapter; no HTTP server or network calls.
import textSnapshot from "./content/models.json";
import mediaSnapshot from "./content/models-media.json";
import availability from "./content/availability.json";
const offlineEnv: Record<string, string | undefined> = {};
import {
  generatedPack,
  packVersion,
  puzzleContent,
  evaluatePuzzle,
  puzzlePreviews,
  generatedContentEnabled,
} from "./puzzle";
import {
  publishAvailableModels,
  type AvailabilityPolicy,
  PurchaseInput,
  ProfileInput,
  ECONOMY_POLICY,
} from "@aimi/contracts";
import type {
  LocalRouter as FastifyInstance,
  LocalRequest as FastifyRequest,
} from "./router";
import { z } from "zod";
import { randomUUID, createHash } from "./crypto";
import {
  CompleteGame,
  AttemptInput,
  GardenInput,
  TextInput,
  AnalyzeInput,
  IdempotencyKey,
  seoulDate,
  gardenPlacements,
  type AIJob,
  type ModelRecord,
  type TaskProfile,
} from "@aimi/contracts";
import {
  recommend,
  MODEL_GROUP_POLICY_VERSION,
  RECOMMENDATION_POLICY_VERSION,
} from "@aimi/recommender";
import type { Repository } from "./repository";
import {
  view,
  daily,
  buyPuzzleCountHint,
  once,
  startPlay,
  completePlay,
  submitAttempt,
  claimChallengeReward,
  purchase,
  saveGarden,
  CATALOG,
  CONTENT_VERSION,
} from "./domain";
import { KEYWORDS, contentForDate } from "./catalog";

import { reserveUserAI, releaseUserAI, userAIQuota } from "./usage";
import { ApiError } from "./errors";

type Auth = (r: FastifyRequest) => Promise<string>;

export function registerPrototype(
  app: FastifyInstance,
  repo: Repository,
  auth: Auth,
  beforeDelete?: (id: string) => Promise<void>,
) {
  const wrap = (data: unknown) => ({
    data,
    serverTime: new Date().toISOString(),
    localDate: seoulDate(),
    ruleVersion: ECONOMY_POLICY.version,
    dataVersion: CONTENT_VERSION,
    development: repo.development,
  });
  const key = (r: FastifyRequest) =>
    IdempotencyKey.parse(r.headers["idempotency-key"]);
  const mutate = async <T>(
    r: FastifyRequest,
    op: string,
    body: unknown,
    fn: (s: Awaited<ReturnType<Repository["read"]>>) => T,
  ) => {
    const id = await auth(r);
    return wrap(
      await repo.transaction([id], (states) =>
        once(states[id], key(r), op, body, () => fn(states[id])),
      ),
    );
  };
  app.get("/v1/state", async (r) => {
    const s = await repo.read(await auth(r));
    return wrap({
      ...view(s),
      aiQuota: userAIQuota(s, seoulDate(), {
        optimizer:
          repo.aiDailyLimit ??
          Math.min(50, Number(offlineEnv.OPTIMIZER_DAILY_LIMIT) || 5),
        analysis:
          repo.aiDailyLimit ??
          Math.min(50, Number(offlineEnv.RECOMMENDATION_DAILY_LIMIT) || 5),
      }),
    });
  });
  app.get("/v1/content/previews", async (r) => {
    await auth(r);
    if (!generatedContentEnabled(repo.development))
      throw new ApiError("NOT_FOUND", 404);
    return wrap({ images: puzzlePreviews() });
  });
  app.get("/v1/content", async (r) => {
    const uid = await auth(r);
    if (generatedContentEnabled(repo.development)) {
      return repo.transaction([uid], (st) => {
        const d = daily(st[uid]);
        if (d.challengeVersion || d.attemptsUsed === 0) {
          const pack = generatedPack(d.date, d.challengeVersion);
          d.challengeVersion = packVersion(pack);
          if (
            d.lastAttempt &&
            st[uid].attempts[d.lastAttempt]?.answerCount !== undefined
          )
            d.answerCountPurchased = true;
          return wrap({
            ...puzzleContent(
              pack,
              uid + d.date + d.challengeVersion,
              d.answerCountPurchased === true ||
                d.challengeClosed === true ||
                d.success,
            ),
            catalog: CATALOG,
          });
        }
        return wrap({
          ...contentForDate(d.date),
          expected: undefined,
          keywords: KEYWORDS,
          catalog: CATALOG,
          developmentSample: true,
        });
      });
    }
    return wrap({
      ...contentForDate(),
      expected: undefined,
      keywords: KEYWORDS,
      catalog: CATALOG,
      developmentSample: true,
    });
  });
  app.post("/v1/game-plays", async (r) => {
    const body = z
      .object({ kind: z.enum(["crossing", "dino", "runner"]).optional() })
      .strict()
      .parse(r.body ?? {});
    if (body.kind) throw new ApiError("GAME_OVERRIDE_FORBIDDEN", 403);
    return mutate(r, "game-start", body, (s) => startPlay(s));
  });
  app.get<{ Params: { id: string } }>("/v1/game-plays/:id", async (r) => {
    const s = await repo.read(await auth(r)),
      p = s.plays[r.params.id];
    if (!p) throw new ApiError("PLAY_NOT_FOUND", 404);
    return wrap(p);
  });
  app.post<{ Params: { id: string } }>(
    "/v1/game-plays/:id/complete",
    async (r) => {
      const body = CompleteGame.parse(r.body);
      return mutate(r, "game-complete:" + r.params.id, body, (s) =>
        completePlay(s, r.params.id, body),
      );
    },
  );
  app.post("/v1/challenge/preview", async (r) => {
    const uid = await auth(r);
    const b = AttemptInput.parse(r.body);
    const { evaluateChallenge } = await import("./catalog");
    const state = await repo.read(uid),
      d = daily(state);
    const e =
      generatedContentEnabled(repo.development) && d.challengeVersion
        ? evaluatePuzzle(
            generatedPack(d.date, d.challengeVersion),
            b.keywordIds,
            b.model,
          )
        : evaluateChallenge(b.keywordIds, b.model, b.date);
    return wrap({ cost: e.cost, sentence: e.sentence, version: e.version });
  });
  app.post("/v1/challenge/count-hint", async (r) => {
    const b = z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        contentVersion: z.string().max(150),
      })
      .strict()
      .parse(r.body);
    return mutate(r, "challenge-count-hint", b, (s) => {
      const d = daily(s);
      if (b.date !== d.date) throw new ApiError("MISSION_DATE_CHANGED", 409);
      if (
        !generatedContentEnabled(repo.development) ||
        !d.challengeVersion ||
        b.contentVersion !== d.challengeVersion
      )
        throw new ApiError("CONTENT_VERSION_CHANGED", 409);
      return buyPuzzleCountHint(s, generatedPack(d.date, d.challengeVersion));
    });
  });
  app.post("/v1/challenge/attempts", async (r) => {
    const b = AttemptInput.parse(r.body);
    return mutate(r, "challenge-attempt", b, (s) => {
      const d = daily(s);
      if (
        b.contentVersion &&
        b.contentVersion !==
          (d.challengeVersion ?? contentForDate(d.date).version)
      )
        throw new ApiError("CONTENT_VERSION_CHANGED", 409);
      const pack =
        generatedContentEnabled(repo.development) && d.challengeVersion
          ? generatedPack(d.date, d.challengeVersion)
          : undefined;
      return submitAttempt(s, b, Date.now(), pack);
    });
  });
  app.post<{ Params: { id: string } }>("/v1/attempts/:id/reward", async (r) => {
    z.object({})
      .strict()
      .parse(r.body ?? {});
    const body = { attemptId: r.params.id };
    return mutate(r, "challenge-reward-claim", body, (s) =>
      claimChallengeReward(s, body.attemptId),
    );
  });
  app.get<{ Params: { id: string } }>("/v1/attempts/:id", async (r) => {
    const s = await repo.read(await auth(r)),
      a = s.attempts[r.params.id];
    if (!a) throw new ApiError("ATTEMPT_NOT_FOUND", 404);
    return wrap(a);
  });
  app.post("/v1/purchases", async (r) => {
    const b = PurchaseInput.parse(r.body);
    return mutate(r, "purchase", b, (s) => purchase(s, b.itemId, b.quantity));
  });
  app.put("/v1/garden", async (r) => {
    const b = GardenInput.parse(r.body);
    return mutate(r, "garden-save", b, (s) => saveGarden(s, b));
  });
  app.put("/v1/profile", async (r) => {
    const b = ProfileInput.parse(r.body);
    return mutate(r, "profile", b, (s) => {
      s.name = b.name;
      s.nicknameSet = true;
      s.garden.public = true;
      return { name: s.name, nicknameSet: true };
    });
  });
  app.post("/daily-rewards/:type/claim", async (r) => {
    const type = z.enum(["attendance", "tip"]).parse(r.params.type);
    return mutate(r, "reward:" + type, {}, (s) => {
      const day = seoulDate(),
        claims = (s.claims[day] ??= []);
      const awarded = claims.includes(type) ? 0 : ECONOMY_POLICY[type];
      if (awarded) {
        claims.push(type);
        s.balance += awarded;
      }
      return {
        awarded,
        balance: s.balance,
        alreadyClaimed: !awarded,
        rewardType: type,
        localDate: day,
      };
    });
  });
  app.post("/v1/optimizer/jobs", async () => {
    throw new ApiError("AI_NOT_CONNECTED", 503);
  });
  async function loadModelSnapshot() {
    const policy = availability as AvailabilityPolicy;
    return {
      models: publishAvailableModels(
        [...textSnapshot.models, ...mediaSnapshot.models] as ModelRecord[],
        policy,
      ),
      developmentSample: false,
      textAsOf: textSnapshot.asOf,
      mediaAsOf: mediaSnapshot.asOf,
      availabilityPolicyVersion: policy.version,
      availabilityCheckedAt: policy.checkedAt,
    };
  }
  let modelSnapshot: ReturnType<typeof loadModelSnapshot> | undefined;
  let modelSnapshotAt = 0;
  function models() {
    if (!modelSnapshot || Date.now() - modelSnapshotAt > 60000) {
      modelSnapshotAt = Date.now();
      modelSnapshot = loadModelSnapshot();
    }
    return modelSnapshot;
  }
  app.get("/v1/models", async (r) => {
    await auth(r);
    return wrap({
      ...(await models()),
      groupPolicyVersion: MODEL_GROUP_POLICY_VERSION,
    });
  });
  app.post("/v1/recommendations", async () => {
    throw new ApiError("AI_NOT_CONNECTED", 503);
  });
  app.delete("/v1/account", async (r) => {
    const id = await auth(r);
    if (beforeDelete) await beforeDelete(id);
    await repo.remove(id);
    return wrap({ deleted: true });
  });
}
