export function validateAndroidBuild(env: Record<string, string | undefined>) {
  if (env.VITE_APP_RUNTIME !== "android") return;
  if (env.VITE_ANDROID_DEV === "true") return;
  if (env.VITE_TEST_DEMO === "true" || env.AIMI_TEST_BUILD === "true")
    throw Error("ANDROID_RELEASE_FORBIDS_DEMO");
  for (const name of ["VITE_API_BASE_URL", "VITE_SUPABASE_URL"]) {
    let url: URL;
    try {
      url = new URL(env[name] ?? "");
    } catch {
      throw Error("Missing HTTPS configuration: " + name);
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      [
        "localhost",
        "127.0.0.1",
        "[::1]",
        "aimi-online-api.onrender.com",
      ].includes(url.hostname)
    )
      throw Error("Independent HTTPS origin required: " + name);
  }
  const publicKey = env.VITE_SUPABASE_PUBLIC_KEY ?? "";
  let publicRole = false;
  try {
    publicRole =
      JSON.parse(Buffer.from(publicKey.split(".")[1], "base64url").toString())
        .role === "anon";
  } catch {}
  if (!publicKey.startsWith("sb_publishable_") && !publicRole)
    throw Error("SUPABASE_PUBLIC_KEY_REQUIRED_NOT_SERVICE_KEY");
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("VITE_") &&
      /GEMINI|SERVICE_ROLE|ADMIN_KEY|SECRET_KEY/.test(name) &&
      env[name]
    )
      throw Error("SERVER_SECRET_MUST_NOT_BE_IN_ANDROID: " + name);
  }
  if (
    !env.VITE_PRIVACY_OPERATOR?.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_SUPPORT_EMAIL ?? "")
  )
    throw Error("ANDROID_OPERATOR_AND_SUPPORT_CONTACT_REQUIRED");
}
