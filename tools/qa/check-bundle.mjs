import { readFile, readdir, stat } from "node:fs/promises";
import { parse } from "dotenv";
const secretValues = [];
for (const path of [
  "apps/api/.env.local",
  "apps/miniapp/.env.local",
  ".env.local",
]) {
  try {
    const env = parse(await readFile(path));
    for (const [key, value] of Object.entries(env))
      if (
        /KEY|SECRET|PASSWORD|DATABASE_URL/.test(key) &&
        !key.startsWith("VITE_") &&
        value.length >= 12
      )
        secretValues.push(value);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) await scan(path);
    else {
      const file = await readFile(path);
      if (secretValues.some((v) => file.includes(Buffer.from(v))))
        throw new Error("SECRET_VALUE_FOUND_IN_CLIENT_BUNDLE");
    }
  }
}
await scan("apps/miniapp/dist");
const artifact = await stat("apps/miniapp/aimi.ait");
if (!artifact.size) throw new Error("EMPTY_AIT");
console.log(
  JSON.stringify({
    passed: true,
    secretValuesChecked: secretValues.length,
    artifactBytes: artifact.size,
  }),
);
