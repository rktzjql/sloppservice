/** Explicit web builds must never infer Toss from a public hostname. */
export const webDemoRuntime = import.meta.env.VITE_APP_RUNTIME === "web-demo";
export const androidRuntime = import.meta.env.VITE_APP_RUNTIME === "android";
export const offlineRuntime = androidRuntime && import.meta.env.VITE_OFFLINE === "true";
export const androidDevelopment =
  androidRuntime && import.meta.env.VITE_ANDROID_DEV === "true";
export const localRuntime =
  androidDevelopment ||
  (import.meta.env.DEV &&
    !webDemoRuntime &&
    !androidRuntime &&
    ["localhost", "127.0.0.1"].includes(location.hostname));
export const browserRuntime = androidRuntime || webDemoRuntime || localRuntime;
export const tossRuntime = !browserRuntime;
