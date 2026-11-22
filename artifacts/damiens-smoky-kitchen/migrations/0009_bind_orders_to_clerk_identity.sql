ALTER TABLE orders ADD COLUMN clerk_user_id TEXT;
ALTER TABLE orders ADD COLUMN request_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_clerk_user_created_at
  ON orders(clerk_user_id, created_at DESC);
