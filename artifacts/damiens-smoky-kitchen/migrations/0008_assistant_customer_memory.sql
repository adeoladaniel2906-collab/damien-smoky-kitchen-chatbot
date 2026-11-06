CREATE TABLE IF NOT EXISTS assistant_customer_memory (
  clerk_user_id TEXT PRIMARY KEY CHECK(length(clerk_user_id) BETWEEN 1 AND 128),
  preferences_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
