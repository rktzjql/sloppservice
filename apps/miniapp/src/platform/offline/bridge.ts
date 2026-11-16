import { App } from "@capacitor/app";
import { Clipboard } from "@capacitor/clipboard";
export async function login(_name?: string) {}
export async function copy(text: string) {
  await Clipboard.write({ string: text });
}
export async function invite(_code: string) {
  throw Error("SOCIAL_UNAVAILABLE");
}
export function hostNavigation(back: () => void) {
  const pending = App.addListener("backButton", back);
  return () => {
    void pending.then((h) => h.remove());
  };
}
export function updateNavigation(_hasBack: boolean) {}
export function exit() {
  void App.exitApp();
}
