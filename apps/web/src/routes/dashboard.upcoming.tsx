import { createFileRoute } from "@tanstack/react-router";
import type { Subscription } from "@subtally/core";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/card";
import { Table, Th, Td } from "../components/ui/table";
import { formatMoney, formatDate } from "../lib/format";
import { getUpcoming } from "../server-functions/upcoming";

export const Route = createFileRoute("/dashboard/upcoming")({
  loader: async () => {
    const upcoming = await getUpcoming();
    return { upcoming };
  },
  component: UpcomingPage,
});

function UpcomingPage() {
  const { upcoming } = Route.useLoaderData();

  return (
    <Layout>
      <h1 className="text-xl font-semibold">Upcoming</h1>
      {upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Nothing due in the next 30 days.
        </p>
      ) : (
        <Card className="mt-4 overflow-x-auto p-0">
          <Table>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th>Next billing</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((s: Subscription) => (
                <tr key={s.id}>
                  <Td>{s.vendor_name ?? s.service.name}</Td>
                  <Td>{formatDate(s.next_billing_date)}</Td>
                  <Td>{formatMoney(s.price_cents, s.currency)}</Td>
                  <Td>{s.currency ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </Layout>
  );
}
