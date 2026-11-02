CREATE TABLE IF NOT EXISTS staff_totp_state (
  user_id TEXT PRIMARY KEY,
  last_accepted_step INTEGER NOT NULL DEFAULT -1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
