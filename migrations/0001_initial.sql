-- Initial D1 migration: users, services, subscriptions, subscription_events
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now'))
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT,
  created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  plan TEXT,
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active',
  started_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  canceled_at DATETIME,
  created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  occurred_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_service ON subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
