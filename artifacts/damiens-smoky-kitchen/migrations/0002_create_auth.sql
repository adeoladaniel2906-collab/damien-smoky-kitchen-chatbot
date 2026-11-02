CREATE TABLE IF NOT EXISTS customer_accounts (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
 phone TEXT NOT NULL CHECK(length(phone) BETWEEN 8 AND 24),
 password_hash TEXT NOT NULL,
 adult_confirmed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY,
 role TEXT NOT NULL CHECK(role IN ('customer', 'staff')),
 user_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(role, user_id);
