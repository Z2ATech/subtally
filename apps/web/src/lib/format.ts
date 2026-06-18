// Amounts are stored as integer cents. Stats.monthly_spend is a sum of
// price_cents across active subscriptions (see backend read.ts).
export function formatMoney(
  cents: number | null,
  currency?: string | null,
): string {
  if (cents == null) return "—";
  const code = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}
