import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type { Subscription, SubscriptionDetail } from "@subtally/core";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { formatMoney, formatDate } from "../lib/format";
import {
  getSubscriptions,
  getSubscription,
} from "../server-functions/subscriptions";

export const Route = createFileRoute("/dashboard/history")({
  loader: async () => {
    const subscriptions = await getSubscriptions({ data: {} });
    return { subscriptions };
  },
  component: HistoryPage,
});

function HistoryPage() {
  const { subscriptions } = Route.useLoaderData();
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SubscriptionDetail>>(
    {},
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id]) {
      setLoadingId(id);
      try {
        const detail = await getSubscription({ data: id });
        setDetails((d) => ({ ...d, [id]: detail }));
      } finally {
        setLoadingId(null);
      }
    }
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold">History</h1>
      {subscriptions.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No subscriptions.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {subscriptions.map((s: Subscription) => {
            const open = openId === s.id;
            const detail = details[s.id];
            return (
              <Card key={s.id} className="p-0">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 p-4 text-left"
                >
                  <span className="font-medium">
                    {s.vendor_name ?? s.service.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge status={s.status} />
                    <span className="text-gray-400">{open ? "▲" : "▼"}</span>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-gray-100 p-4">
                    {loadingId === s.id && !detail ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : detail && detail.events.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {detail.events.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span>
                              {formatDate(e.occurred_at)} · {e.event_type}
                            </span>
                            <span className="text-gray-600">
                              {formatMoney(e.amount_cents, detail.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No events.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
