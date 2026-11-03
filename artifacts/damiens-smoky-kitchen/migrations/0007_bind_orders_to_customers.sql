-- Bind every newly created order to the authenticated Clerk-backed customer profile.
-- Existing historical orders remain NULL and are never exposed through customer-owned reads.
ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customer_accounts(id) ON DELETE RESTRICT;
ALTER TABLE orders ADD COLUMN request_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON orders(customer_id, created_at DESC);
