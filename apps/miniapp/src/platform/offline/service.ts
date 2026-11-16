import { LocalRouter } from "./router";
import {
  Repository,
  durableStorage,
  type LocalStorageAdapter,
} from "./repository";
import { registerPrototype } from "./routes";
export function createOfflineService(storage: LocalStorageAdapter) {
  const router = new LocalRouter();
  const repo = new Repository(storage);
  registerPrototype(router, repo, async () => "local-device");
  return router;
}
const service = createOfflineService(durableStorage);
export async function offlineRequest<T>(
  path: string,
  method: string,
  body: unknown,
  key: string,
) {
  const result = (await service.request(path, method, body, key)) as {
    data: T;
  };
  return result.data;
}
