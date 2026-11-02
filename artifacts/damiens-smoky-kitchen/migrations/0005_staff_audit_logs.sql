CREATE TABLE IF NOT EXISTS staff_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL CHECK(length(actor) BETWEEN 3 AND 254),
  action TEXT NOT NULL CHECK(length(action) BETWEEN 1 AND 120),
  target_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created_at ON staff_audit_logs(created_at DESC);
