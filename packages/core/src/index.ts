export type SubscriptionStatus = "active" | "cancelled" | "expired" | "detected" | "unknown";

export type Service = {
  id: string;
  name: string;
  sender_domain: string | null;
  email_count: number;
  last_email_at: string | null;
  active_subscription_count: number;
};

export type Subscription = {
  id: string;
  vendor_name: string | null;
  plan: string | null;
  price_cents: number | null;
  currency: string | null;
  billing_frequency: string | null;
  next_billing_date: string | null;
  category: string | null;
  email_type: string | null;
  status: SubscriptionStatus;
  started_at: string | null;
  ended_at: string | null;
  service: Omit<Service, "active_subscription_count">;
};

export type SubscriptionEvent = {
  id: string;
  event_type: string;
  amount_cents: number | null;
  occurred_at: string;
};

export type SubscriptionDetail = Subscription & { events: SubscriptionEvent[] };

export type Stats = {
  active_count: number;
  monthly_spend: number;
  monthly_spend_currency: string | null;
  upcoming_count: number;
  last_scan_at: string | null;
};
