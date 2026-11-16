import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
export function createHash(algorithm: string) {
  if (algorithm !== "sha256") throw Error("Unsupported digest");
  let text = "";
  const hash = {
    update(value: string) {
      text += value;
      return hash;
    },
    digest(format: string) {
      if (format !== "hex") throw Error("Unsupported encoding");
      return bytesToHex(sha256(new TextEncoder().encode(text)));
    },
  };
  return hash;
}
export const randomUUID = () => crypto.randomUUID();
export function randomInt(min: number, max?: number) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  const width = max - min,
    limit = Math.floor(0x100000000 / width) * width;
  if (width <= 0 || width > 0x100000000) throw Error("Invalid random range");
  let value: number;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= limit);
  return min + (value % width);
}
