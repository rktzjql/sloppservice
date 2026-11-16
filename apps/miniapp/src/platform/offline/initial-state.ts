import { createHash, randomUUID } from "./crypto";
import type { UserState } from "@aimi/contracts";
export function newState(id: string, development = false): UserState {
  return {
    version: 1,
    authEpoch: randomUUID(),
    balance: development ? 125 : 0,
    name: "새싹이",
    nicknameSet: true,
    code: createHash("sha256")
      .update(id)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase(),
    selectedCharacter: "seed",
    inventory: development ? ["seed", "bear", "flower"] : ["seed"],
    garden: {
      placements: [],
      slots: {
        back: null,
        "front-left": null,
        "front-right": null,
        "back-right": null,
      },
      revision: 0,
      public: true,
    },
    days: {},
    plays: {},
    attempts: {},
    claims: {},
    jobs: {},
    aiUsage: {},
    friendRequests: [],
    friends: [],
    blocked: [],
    requests: {},
  };
}
