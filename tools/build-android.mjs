import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
const root = fileURLToPath(new URL("../", import.meta.url));
const app = fileURLToPath(new URL("../apps/miniapp/", import.meta.url));
config({ path: app + ".env.android.local", quiet: true });
const env = {
  ...process.env,
  VITE_APP_RUNTIME: "android",
  VITE_ANDROID_DEV: "false",
};
for (const [command, args] of [
  ["npm", ["run", "build", "--workspace", "@aimi/miniapp"]],
  ["npx", ["cap", "sync", "android"]],
]) {
  const r = spawnSync(command, args, {
    cwd: command === "npm" ? root : app,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
