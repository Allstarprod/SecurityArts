-- SecurityArts — Postgres / Supabase schema.
-- Idempotent: safe to run repeatedly (used by DB_AUTO_MIGRATE=1 too).
-- In Supabase: SQL Editor → paste → Run, or set DB_AUTO_MIGRATE=1 for first boot.

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL DEFAULT 'Artist',
  pass       TEXT NOT NULL,              -- scrypt hash (never plaintext)
  created_at TEXT NOT NULL,
  profile    JSONB NOT NULL DEFAULT '{}'::jsonb  -- pronouns, gender, bio, likes, accent, visibility
);
-- Existing installs: add the profile column if the table predates it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Unique, user-chosen @handle (nullable until claimed; case-insensitively unique).
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_idx ON users (lower(handle));

CREATE TABLE IF NOT EXISTS works (
  id         TEXT PRIMARY KEY,
  own        BOOLEAN NOT NULL DEFAULT TRUE,
  title      TEXT NOT NULL,
  artist     TEXT NOT NULL,
  cat        TEXT NOT NULL,
  medium     TEXT NOT NULL,
  price      JSONB NOT NULL,             -- { personal, commercial, exclusive }
  cert       JSONB NOT NULL,             -- server-side seal { hash, sig, signer, algo, ts }
  hash       TEXT UNIQUE,               -- = cert.hash, for public verification lookups
  owner_id   TEXT,
  created_at TEXT NOT NULL,
  img_url    TEXT                       -- CDN URL when the image lives in Supabase Storage
);
CREATE INDEX IF NOT EXISTS works_cat_idx        ON works (cat);
CREATE INDEX IF NOT EXISTS works_created_at_idx ON works (created_at DESC);
CREATE INDEX IF NOT EXISTS works_owner_idx      ON works (owner_id);

-- Image bytes live in a side table so the hot catalog queries never pull blobs.
-- At very high scale, move these to Supabase Storage / S3 and keep a URL on works.
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

-- Threaded comments on works. work_id is any work identifier (catalog, market, or
-- user-sealed) — comments don't require the work to exist in the works table.
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  work_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text        TEXT NOT NULL,
  parent_id   TEXT,                       -- one-level replies; NULL for top-level
  likes       INTEGER NOT NULL DEFAULT 0,
  liked_by    JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_work_idx   ON comments (work_id, created_at);
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments (parent_id);

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

-- Password-reset tokens. We store only the SHA-256 hash of the token, so a DB leak
-- never yields usable reset links. Rows are single-use and time-boxed.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at BIGINT NOT NULL,        -- epoch ms
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

-- Shared, cross-instance rate limiting (used when RATELIMIT_DRIVER=postgres).
-- Fixed-window counters; old windows are pruned opportunistically.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
