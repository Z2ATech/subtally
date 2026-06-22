import { createFileRoute } from "@tanstack/react-router";
import type { Service } from "@subtally/core";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/card";
import { getServices } from "../server-functions/services";

export const Route = createFileRoute("/dashboard/services")({
  loader: async () => {
    const services = await getServices();
    return { services };
  },
  component: ServicesPage,
});

function ServicesPage() {
  const { services } = Route.useLoaderData();

  return (
    <Layout>
      <h1 className="text-xl font-semibold">Services</h1>
      {services.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No services yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc: Service) => (
            <Card key={svc.id}>
              <div className="font-medium">{svc.sender_domain ?? svc.name}</div>
              <div className="mt-1 text-xs text-gray-500">
                {svc.email_count} emails · {svc.active_subscription_count} active
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
