import { createServerFn } from "@tanstack/react-start";
import type { Subscription } from "@subtally/core";
import { apiFetch } from "../lib/api";

export const getUpcoming = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await apiFetch("/api/upcoming");
    if (!res.ok) throw new Error(`getUpcoming failed: ${res.status}`);
    return (await res.json()) as Subscription[];
  },
);
