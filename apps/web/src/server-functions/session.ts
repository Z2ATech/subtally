import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "../lib/api";

// Returns Better Auth's session payload ({ session, user }) or null.
// Fails closed: any backend/network error is treated as "no session".
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await apiFetch("/api/auth/get-session");
    if (!res.ok) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
});
