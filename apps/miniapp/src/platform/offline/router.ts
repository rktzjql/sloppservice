import { ApiError } from "./errors";
export type LocalRequest = {
  body: any;
  params: Record<string, string>;
  headers: Record<string, string>;
  url: string;
};
type Handler = (request: LocalRequest) => unknown | Promise<unknown>;
export class LocalRouter {
  private routes: { method: string; path: string; handler: Handler }[] = [];
  get<T = unknown>(path: string, handler: Handler) {
    this.routes.push({ method: "GET", path, handler });
  }
  post<T = unknown>(path: string, handler: Handler) {
    this.routes.push({ method: "POST", path, handler });
  }
  put<T = unknown>(path: string, handler: Handler) {
    this.routes.push({ method: "PUT", path, handler });
  }
  delete<T = unknown>(path: string, handler: Handler) {
    this.routes.push({ method: "DELETE", path, handler });
  }
  async request(path: string, method: string, body: unknown, key: string) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const pattern = route.path.split("/"),
        parts = path.split("/"),
        params: Record<string, string> = {};
      if (pattern.length !== parts.length) continue;
      if (
        !pattern.every((part, index) =>
          part.startsWith(":")
            ? ((params[part.slice(1)] = decodeURIComponent(parts[index])), true)
            : part === parts[index],
        )
      )
        continue;
      return await route.handler({
        body,
        params,
        headers: { "idempotency-key": key },
        url: path,
      });
    }
    throw new ApiError("NOT_FOUND", 404);
  }
}
