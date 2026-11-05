-- Keep payment state separate from fulfilment state. Never infer payment from a browser redirect.
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK(payment_status IN ('unpaid', 'initializing', 'pending', 'paid', 'failed', 'refunded'));
ALTER TABLE orders ADD COLUMN payment_reference TEXT;
ALTER TABLE orders ADD COLUMN payment_access_code TEXT;
ALTER TABLE orders ADD COLUMN payment_authorization_url TEXT;
ALTER TABLE orders ADD COLUMN payment_paid_at TEXT;
ALTER TABLE orders ADD COLUMN delivery_fee_confirmed_at TEXT;
ALTER TABLE orders ADD COLUMN customer_accepted_total_ngn INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON orders(payment_reference) WHERE payment_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL CHECK(provider = 'paystack'),
  provider_event_key TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  payment_reference TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id, processed_at DESC);
