import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { Subscription, Service } from "@subtally/core";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { formatMoney, formatDate } from "../lib/format";
import { getStats } from "../server-functions/stats";
import { getSubscriptions } from "../server-functions/subscriptions";
import { getUpcoming } from "../server-functions/upcoming";
import { getServices } from "../server-functions/services";
import { triggerScan } from "../server-functions/scan";

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    const [stats, subscriptions, upcoming, services] = await Promise.all([
      getStats(),
      getSubscriptions({ data: { status: "active" } }),
      getUpcoming(),
      getServices(),
    ]);
    return { stats, subscriptions, upcoming, services };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { stats, subscriptions, services } = Route.useLoaderData();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  // Backend resolves the spend currency (null when active subs span multiple
  // currencies, in which case monthly_spend is 0). Show a symbol when known.
  const monthlySpend = stats.monthly_spend_currency
    ? formatMoney(stats.monthly_spend, stats.monthly_spend_currency)
    : (stats.monthly_spend / 100).toFixed(2);

  async function handleSync() {
    setScanning(true);
    try {
      await triggerScan();
      await router.invalidate();
    } finally {
      setScanning(false);
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button onClick={handleSync} disabled={scanning}>
          {scanning ? "Syncing…" : "Sync Gmail"}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <div className="text-xs text-gray-500">Active</div>
          <div className="text-2xl font-semibold">{stats.active_count}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Monthly spend</div>
          <div className="text-2xl font-semibold">{monthlySpend}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Upcoming (30d)</div>
          <div className="text-2xl font-semibold">{stats.upcoming_count}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-500">Last scan</div>
          <div className="text-sm font-medium">
            {formatDate(stats.last_scan_at)}
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Active subscriptions</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {subscriptions.map((s: Subscription) => (
              <Card
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="font-medium">
                    {s.vendor_name ?? s.service.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.billing_frequency ?? "—"} · next{" "}
                    {formatDate(s.next_billing_date)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {formatMoney(s.price_cents, s.currency)}
                  </span>
                  <Badge status={s.status} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Services</h2>
        {services.length === 0 ? (
          <p className="text-sm text-gray-500">No services yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((svc: Service) => (
              <Card key={svc.id}>
                <div className="font-medium">
                  {svc.sender_domain ?? svc.name}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {svc.email_count} emails · {svc.active_subscription_count}{" "}
                  active
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
