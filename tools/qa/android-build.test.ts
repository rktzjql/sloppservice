import test from "node:test";
import assert from "node:assert/strict";
import { validateAndroidBuild } from "../../apps/miniapp/android-build-policy";
const configured = {
  VITE_APP_RUNTIME: "android",
  VITE_API_BASE_URL: "https://api.example.test",
  VITE_SUPABASE_URL: "https://auth.example.test",
  VITE_SUPABASE_PUBLIC_KEY: "sb_publishable_test",
  VITE_PRIVACY_OPERATOR: "Test operator",
  VITE_SUPPORT_EMAIL: "support@example.test",
};
test("Android release requires independent HTTPS services, public provider key and operator", () => {
  assert.doesNotThrow(() => validateAndroidBuild(configured));
  for (const value of [
    "",
    "http://api.example.test",
    "https://127.0.0.1",
    "https://aimi-online-api.onrender.com",
    "https://user:secret@api.example.test",
    "https://api.example.test/path",
  ])
    assert.throws(() =>
      validateAndroidBuild({ ...configured, VITE_API_BASE_URL: value }),
    );
  assert.throws(() =>
    validateAndroidBuild({
      ...configured,
      VITE_SUPABASE_PUBLIC_KEY: "sb_secret_do-not-ship",
    }),
  );
  assert.throws(() =>
    validateAndroidBuild({ ...configured, VITE_SUPPORT_EMAIL: "" }),
  );
});
test("Android release rejects server secrets and shared demo flags", () => {
  for (const extra of [
    { VITE_GEMINI_API_KEY: "secret" },
    { VITE_SERVICE_ROLE_KEY: "secret" },
    { VITE_TEST_DEMO: "true" },
    { AIMI_TEST_BUILD: "true" },
  ])
    assert.throws(() => validateAndroidBuild({ ...configured, ...extra }));
});
