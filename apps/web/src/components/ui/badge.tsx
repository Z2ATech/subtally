import type { SubscriptionStatus } from "@subtally/core";

const styles: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-700",
  detected: "bg-blue-100 text-blue-800",
  unknown: "bg-yellow-100 text-yellow-800",
};

export function Badge({ status }: { status: SubscriptionStatus | string }) {
  const cls = styles[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
