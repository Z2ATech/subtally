import { getRequest } from "@tanstack/react-start/server";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

// Server-side fetch to the backend Worker. Forwards the incoming request's
// cookie header so Better Auth sessions carry across the two Workers.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookie = getRequest().headers.get("cookie") ?? "";
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      ...(cookie ? { cookie } : {}),
    },
  });
}
