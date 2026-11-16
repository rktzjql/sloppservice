import { createHmac, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { AndroidLogin, SessionResult } from "@aimi/contracts";
import { ApiError } from "../../db.js";

export type AndroidAuthConfig = {
  url: string;
  publicKey: string;
  adminKey: string;
};
const Identity = z
  .object({
    id: z.string().uuid(),
    is_anonymous: z.boolean(),
    email_confirmed_at: z.string().nullable().optional(),
  })
  .refine((user) => user.is_anonymous || Boolean(user.email_confirmed_at));
export function androidProvider(
  config: AndroidAuthConfig,
  transport: typeof fetch = fetch,
) {
  const url = new URL(config.url);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("ANDROID_AUTH_REQUIRES_HTTPS_ORIGIN");
  async function call(
    path: string,
    method: string,
    key: string,
    bearer: string,
  ) {
    try {
      return await transport(url.origin + "/auth/v1/" + path, {
        method,
        redirect: "error",
        headers: { apikey: key, Authorization: "Bearer " + bearer },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ApiError("ANDROID_AUTH_UNAVAILABLE", 503);
    }
  }
  return {
    async verify(token: string) {
      const response = await call("user", "GET", config.publicKey, token);
      if (response.status === 401 || response.status === 403)
        throw new ApiError("ANDROID_AUTH_INVALID", 401);
      if (!response.ok) throw new ApiError("ANDROID_AUTH_UNAVAILABLE", 503);
      const identity = Identity.safeParse(
        await response.json().catch(() => null),
      );
      if (!identity.success) throw new ApiError("ANDROID_AUTH_INVALID", 401);
      return identity.data.id;
    },
    async remove(id: string) {
      z.string().uuid().parse(id);
      const response = await call(
        "admin/users/" + id,
        "DELETE",
        config.adminKey,
        config.adminKey,
      );
      if (!response.ok && response.status !== 404)
        throw new ApiError("ANDROID_AUTH_UNAVAILABLE", 503);
    },
  };
}
export function registerAndroidAuth(
  app: FastifyInstance,
  pool: Pool,
  secret: string,
  provider: ReturnType<typeof androidProvider>,
) {
  app.post("/auth/android", async (request) => {
    const { accessToken } = AndroidLogin.parse(request.body);
    const subject = z
      .string()
      .uuid()
      .parse(await provider.verify(accessToken));
    const token = randomBytes(32).toString("hex");
    const hash = createHmac("sha256", secret).update(token).digest("hex");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        "INSERT INTO aimi.users(android_subject) VALUES($1) ON CONFLICT(android_subject) DO UPDATE SET android_subject=excluded.android_subject RETURNING id",
        [subject],
      );
      const id = user.rows[0].id;
      await client.query(
        "INSERT INTO aimi.ep_wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [id],
      );
      await client.query(
        "INSERT INTO aimi.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [hash, id],
      );
      await client.query("COMMIT");
      return { data: SessionResult.parse({ token, expiresIn: 3600 }) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
  return async (id: string) => {
    const result = await pool.query(
      "SELECT android_subject FROM aimi.users WHERE id=$1",
      [id],
    );
    const subject = result.rows[0]?.android_subject;
    if (subject) await provider.remove(subject);
  };
}
