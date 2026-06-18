import { createServerFn } from "@tanstack/react-start";
import { apiFetch } from "../lib/api";

export const triggerScan = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await apiFetch("/api/gmail/scan");
    if (!res.ok) throw new Error(`triggerScan failed: ${res.status}`);
    return (await res.json()) as { processed: number; skipped: number };
  },
);
