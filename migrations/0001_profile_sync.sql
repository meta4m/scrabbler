PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  drill TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  synced_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS attempts_user_timestamp_idx ON attempts(user_id, timestamp DESC);
