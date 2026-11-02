CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL CHECK(length(customer_name) BETWEEN 1 AND 100),
  customer_phone TEXT NOT NULL CHECK(length(customer_phone) BETWEEN 8 AND 24),
  delivery_address TEXT NOT NULL CHECK(length(delivery_address) BETWEEN 5 AND 300),
  delivery_state TEXT NOT NULL CHECK(delivery_state = 'Lagos'),
  subtotal_ngn INTEGER NOT NULL CHECK(subtotal_ngn >= 3000),
  delivery_fee_ngn INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'accepted', 'preparing', 'dispatched', 'completed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL CHECK(length(item_name) BETWEEN 1 AND 120),
  category TEXT NOT NULL CHECK(length(category) BETWEEN 1 AND 80),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
  unit_price_ngn INTEGER NOT NULL CHECK(unit_price_ngn >= 0),
  line_total_ngn INTEGER NOT NULL CHECK(line_total_ngn >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
