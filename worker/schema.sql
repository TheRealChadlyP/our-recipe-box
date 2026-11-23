CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_updated ON recipes(updated_at DESC);
