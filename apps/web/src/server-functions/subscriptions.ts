import { createServerFn } from "@tanstack/react-start";
import type { Subscription, SubscriptionDetail } from "@subtally/core";
import { apiFetch } from "../lib/api";

export const getSubscriptions = createServerFn({ method: "GET" })
  .validator((filter?: { status?: string; service_id?: string }) => filter)
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    if (data?.status) params.set("status", data.status);
    if (data?.service_id) params.set("service_id", data.service_id);
    const qs = params.toString();
    const res = await apiFetch(`/api/subscriptions${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error(`getSubscriptions failed: ${res.status}`);
    return (await res.json()) as Subscription[];
  });

export const getSubscription = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const res = await apiFetch(`/api/subscriptions/${id}`);
    if (!res.ok) throw new Error(`getSubscription failed: ${res.status}`);
    return (await res.json()) as SubscriptionDetail;
  });
