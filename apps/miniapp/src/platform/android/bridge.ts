import { App } from "@capacitor/app";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";
import { androidDevelopment } from "../../lib/runtime";
import { request, setToken } from "../../lib/api/client";
import { startAndroidSession } from "./auth";
export async function login(name = "player") {
  if (!androidDevelopment) return startAndroidSession();
  const result = await request<{ token: string }>("/auth/local", "POST", {
    name,
  });
  setToken(result.token);
}
export async function copy(text: string) {
  await Clipboard.write({ string: text });
}
export async function invite(code: string) {
  await Share.share({ title: "AIMI", text: "AIMI 친구 코드: " + code });
}
export function hostNavigation(back: () => void) {
  let disposed = false;
  const listener = App.addListener("backButton", back);
  void listener.then((handle) => {
    if (disposed) void handle.remove();
  });
  return () => {
    disposed = true;
    void listener.then((handle) => handle.remove());
  };
}
export function updateNavigation(_hasBack: boolean) {}
export function exit() {
  void App.exitApp();
}
