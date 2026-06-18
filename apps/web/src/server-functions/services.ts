import { createServerFn } from "@tanstack/react-start";
import type { Service } from "@subtally/core";
import { apiFetch } from "../lib/api";

export const getServices = createServerFn({ method: "GET" }).handler(
  async () => {
    const res = await apiFetch("/api/services");
    if (!res.ok) throw new Error(`getServices failed: ${res.status}`);
    return (await res.json()) as Service[];
  },
);
