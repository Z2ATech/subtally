import { createServerFn } from "@tanstack/react-start";
import type { Stats } from "@subtally/core";
import { apiFetch } from "../lib/api";

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const res = await apiFetch("/api/stats");
  if (!res.ok) throw new Error(`getStats failed: ${res.status}`);
  return (await res.json()) as Stats;
});
