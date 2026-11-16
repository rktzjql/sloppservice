import type { CapacitorConfig } from "@capacitor/cli";
const development = process.env.VITE_ANDROID_DEV === "true";
const config: CapacitorConfig = {
  appId: "com.aimi.standalone", appName: "AIMI", webDir: "dist",
  server: { androidScheme: development ? "http" : "https", cleartext: development },
  android: { allowMixedContent: development },
};
export default config;
