-- SecurityArts — initial schema (already applied to project ixdkfakibuctwhgwngsw).
-- Idempotent. Kept here as the versioned source of truth so `supabase db push`
-- and a fresh `supabase db reset` both reproduce production.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL DEFAULT 'Artist',
  pass       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id         TEXT PRIMARY KEY,
  own        BOOLEAN NOT NULL DEFAULT TRUE,
  title      TEXT NOT NULL,
  artist     TEXT NOT NULL,
  cat        TEXT NOT NULL,
  medium     TEXT NOT NULL,
  price      JSONB NOT NULL,
  cert       JSONB NOT NULL,
  hash       TEXT UNIQUE,
  owner_id   TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS works_cat_idx        ON works (cat);
CREATE INDEX IF NOT EXISTS works_created_at_idx ON works (created_at DESC);
CREATE INDEX IF NOT EXISTS works_owner_idx      ON works (owner_id);

CREATE TABLE IF NOT EXISTS work_blobs (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  data    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  pins       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS boards_user_idx ON boards (user_id);

CREATE TABLE IF NOT EXISTS orders (
  id         TEXT PRIMARY KEY,
  lines      JSONB NOT NULL,
  total      INTEGER NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT,
  user_id    TEXT,
  status     TEXT NOT NULL DEFAULT 'paid',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);

CREATE TABLE IF NOT EXISTS newsletter (
  email TEXT PRIMARY KEY,
  ip    TEXT,
  ts    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
