CREATE TABLE IF NOT EXISTS google_identities (
  google_sub TEXT PRIMARY KEY CHECK(length(google_sub) BETWEEN 1 AND 255),
  customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE CHECK(length(email) BETWEEN 3 AND 254),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (customer_id) REFERENCES customer_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_google_identities_customer ON google_identities(customer_id);

CREATE TABLE IF NOT EXISTS google_oauth_states (
  state_hash TEXT PRIMARY KEY CHECK(length(state_hash) = 64),
  nonce TEXT NOT NULL,
  verifier TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('login', 'link')),
  user_id TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expiry ON google_oauth_states(expires_at);
