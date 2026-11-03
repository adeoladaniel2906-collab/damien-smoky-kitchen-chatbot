ALTER TABLE customer_accounts ADD COLUMN clerk_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_accounts_clerk_user_id
  ON customer_accounts(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;
