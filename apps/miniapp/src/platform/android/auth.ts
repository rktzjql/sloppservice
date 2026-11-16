import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { AndroidLogin, SessionResult } from "@aimi/contracts";
import {
  request,
  RequestError,
  configureSessionRecovery,
  setAnonymousToken,
} from "../../lib/api/client";
import { androidRuntime, androidDevelopment } from "../../lib/runtime";
const secure = registerPlugin<{
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}>("CredentialStore");
const storage = {
  async getItem(key: string) {
    return Capacitor.isNativePlatform()
      ? (await secure.get({ key })).value
      : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (Capacitor.isNativePlatform()) await secure.set({ key, value });
    else localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (Capacitor.isNativePlatform()) await secure.remove({ key });
    else localStorage.removeItem(key);
  },
};
let client: SupabaseClient | undefined;
function authClient() {
  return (client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
    {
      auth: {
        storage,
        storageKey: "aimi.android.auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  ));
}
const accountMarker = "aimi.android.has-account";
async function exchange(create: boolean) {
  const auth = authClient().auth;
  const saved = await auth.getSession();
  if (saved.error) throw new RequestError("ANDROID_AUTH_UNAVAILABLE", 503);
  let session = saved.data.session;
  if (!session) {
    if (!create || (await storage.getItem(accountMarker)))
      throw new RequestError("ANDROID_ACCOUNT_UNAVAILABLE", 401);
    const result = await auth.signInAnonymously();
    if (result.error || !result.data.session)
      throw new RequestError("ANDROID_AUTH_UNAVAILABLE", 503);
    session = result.data.session;
    await storage.setItem(accountMarker, "true");
  } else {
    await storage.setItem(accountMarker, "true");
  }
  const body = AndroidLogin.parse({ accessToken: session.access_token });
  const response = await request("/auth/android", "POST", body);
  return SessionResult.parse(response).token;
}
let pending: Promise<void> | undefined;
export function startAndroidSession() {
  return (pending ??= exchange(true)
    .then((value) => setAnonymousToken(value))
    .finally(() => {
      pending = undefined;
    }));
}
export async function clearAndroidAccount() {
  // The server has already deleted the provider identity and all app records.
  await authClient().auth.signOut({ scope: "local" });
  await storage.removeItem("aimi.android.auth");
  await storage.removeItem(accountMarker);
  sessionStorage.setItem("aimi.android.pause-start", "true");
}
if (androidRuntime && !androidDevelopment)
  configureSessionRecovery(() => exchange(false));
