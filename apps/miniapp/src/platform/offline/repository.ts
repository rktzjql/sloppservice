import type { UserState } from "@aimi/contracts";
import { newState } from "./initial-state";
import { ApiError } from "./errors";
export interface LocalStorageAdapter {
  load(): Promise<UserState | null>;
  save(state: UserState): Promise<void>;
  clear(): Promise<void>;
}
export class Repository {
  readonly development = false;
  readonly aiDailyLimit = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: LocalStorageAdapter) {}
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
  private async load() {
    const existing = await this.storage.load();
    if (existing) return existing;
    const state = newState(crypto.randomUUID());
    await this.storage.save(state);
    return state;
  }
  read(_id: string) {
    return this.enqueue(async () => structuredClone(await this.load()));
  }
  transaction<T>(ids: string[], fn: (states: Record<string, UserState>) => T) {
    return this.enqueue(async () => {
      if (ids.length !== 1) throw new ApiError("SOCIAL_UNAVAILABLE", 404);
      const state = structuredClone(await this.load());
      const result = fn({ [ids[0]]: state });
      await this.storage.save(state);
      return structuredClone(result);
    });
  }
  remove(_id: string) {
    return this.enqueue(() => this.storage.clear());
  }
}
let database: Promise<IDBDatabase> | undefined;
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("aimi-offline-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("profile");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(new ApiError("LOCAL_STORAGE_FAILED", 500));
    request.onblocked = () =>
      reject(new ApiError("LOCAL_STORAGE_BLOCKED", 409));
  }).catch((e) => {
    database = undefined;
    throw e;
  }));
}
async function operation<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profile", mode);
    let request: IDBRequest<T>;
    try {
      request = action(tx.objectStore("profile"));
    } catch {
      tx.abort();
      reject(new ApiError("LOCAL_STORAGE_FAILED", 500));
      return;
    }
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () =>
      reject(new ApiError("LOCAL_STORAGE_FAILED", 500));
  });
}
export const durableStorage: LocalStorageAdapter = {
  async load() {
    const state = await operation("readonly", (s) => s.get("current"));
    if (state === undefined) return null;
    if (
      !state ||
      state.version !== 1 ||
      !Number.isFinite(state.balance) ||
      !Array.isArray(state.inventory) ||
      !state.days ||
      !state.requests ||
      !state.garden
    )
      throw new ApiError("LOCAL_DATA_CORRUPT", 500);
    return state as UserState;
  },
  async save(state) {
    await operation("readwrite", (s) => s.put(state, "current"));
  },
  async clear() {
    await operation("readwrite", (s) => s.delete("current"));
  },
};
