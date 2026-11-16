import { defineConfig, loadEnv } from "vite";
import { validateAndroidBuild } from "./android-build-policy";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const android = process.env.VITE_APP_RUNTIME === "android";
const offline = process.env.VITE_OFFLINE === "true";
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

import { lockedViewport } from "./src/lib/scale-policy";
if (
  process.env.VITE_TEST_DEMO === "true" &&
  process.env.AIMI_TEST_BUILD !== "true"
)
  throw Error("DEMO_REQUIRES_EXPLICIT_TEST_BUILD");
if (
  process.env.VITE_APP_RUNTIME === "web-demo" &&
  (process.env.AIMI_TEST_BUILD !== "true" ||
    process.env.VITE_TEST_DEMO !== "true")
)
  throw Error("WEB_DEMO_REQUIRES_EXPLICIT_TEST_BUILD");
export default defineConfig(({ mode }) => {
  validateAndroidBuild({ ...loadEnv(mode, process.cwd(), ""), ...process.env });
  return {
    resolve: {
      alias: android
        ? [
            {
              find: /^(.*\/)ui\/primitives$/,
              replacement: source("./src/ui/primitives/android.tsx"),
            },
            {
              find: /^(.*\/)ui\/toss-provider$/,
              replacement: source("./src/platform/android/provider.tsx"),
            },
            {
              find: /^(.*\/)lib\/toss\/bridge$/,
              replacement: source(offline ? "./src/platform/offline/bridge.ts" : "./src/platform/android/bridge.ts"),
            },
            {
              find: "@apps-in-toss/web-framework",
              replacement: source(
                "./src/platform/android/safe-area-adapter.ts",
              ),
            },
          ]
        : [],
    },
    plugins: [
      {
        name: "android-no-toss-dependencies",
        generateBundle() {
          if (!android) return;
          for (const id of this.getModuleIds()) {
            if (/node_modules\/(?:@toss|@apps-in-toss)\//.test(id))
              this.error("Android bundle contains a Toss dependency: " + id);
          }
        },
      },
      react(),
      {
        name: "aimi-toss-viewport",
        apply: "build",
        transformIndexHtml(html) {
          if (process.env.VITE_APP_RUNTIME === "web-demo") return html;
          return html.replace(
            /(name="viewport"\s+content=")[^"]*(")/,
            "$1" + lockedViewport + "$2",
          );
        },
      },
    ],
    server: {
      proxy: {
        "/api": {
          target:
            "http://127.0.0.1:" + (process.env.AIMI_DEV_API_PORT || "8081"),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: { outDir: "dist" },
  };
});
