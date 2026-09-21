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
-- Session revocation: every session cookie embeds this number and is honoured only
-- while it matches. Bumped on password reset / logout-everywhere / Google merge.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
-- Ownership of the address is proven by clicking the emailed link (or by a verified
-- Google login). Unverified accounts are replaced, not merged, when Google claims the
-- same email — closes the pre-account-takeover hole.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
-- Google's stable subject id; Google logins match on this FIRST, email second.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub);

CREATE TABLE IF NOT EXISTS works (
  id         TEXT PRIMARY KEY,
  own        BOOLEAN NOT NULL DEFAULT TRUE,
  title      TEXT NOT NULL,
  artist     TEXT NOT NULL,
  cat        TEXT NOT NULL,
  medium     TEXT NOT NULL,
  price      JSONB,                      -- { personal, commercial, exclusive } or NULL = not for sale
  cert       JSONB NOT NULL,             -- server-side seal { hash, sig, signer, algo, ts }
  hash       TEXT UNIQUE,               -- = cert.hash, for public verification lookups
  owner_id   TEXT,
  created_at TEXT NOT NULL,
  img_url    TEXT                       -- CDN URL when the image lives in Supabase Storage
);
CREATE INDEX IF NOT EXISTS works_cat_idx        ON works (cat);
CREATE INDEX IF NOT EXISTS works_created_at_idx ON works (created_at DESC);
CREATE INDEX IF NOT EXISTS works_owner_idx      ON works (owner_id);
-- Sealing used to attach a synthetic price to every work; it no longer does, and the
-- column is nullable for installs that predate that change.
ALTER TABLE works ALTER COLUMN price DROP NOT NULL;

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
  status     TEXT NOT NULL DEFAULT 'pending', -- 'pending' until a VERIFIED payment webhook flips it to 'paid'
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS newsletter (
  email TEXT PRIMARY KEY,
  ip    TEXT,
  ts    TEXT NOT NULL
);

-- Per-work engagement counters (Creator Hub analytics). Views accrue as work detail
-- pages are opened; comments/saves are aggregated live from their own tables.
CREATE TABLE IF NOT EXISTS work_stats (
  work_id TEXT PRIMARY KEY,
  views   BIGINT NOT NULL DEFAULT 0
);

-- Work-level likes (one row per user per work → count = likes; existence = likedByMe).
CREATE TABLE IF NOT EXISTS work_likes (
  work_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (work_id, user_id)
);
CREATE INDEX IF NOT EXISTS work_likes_work_idx ON work_likes (work_id);

-- Single-use emailed tokens: password resets AND email-verification links (the table
-- name is historical). We store only the SHA-256 hash of the token, so a DB leak
-- never yields usable links. Rows are single-use and time-boxed; `purpose` keeps a
-- verification token from ever being accepted as a reset token.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at BIGINT NOT NULL,        -- epoch ms
  created_at TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'reset'   -- 'reset' | 'verify'
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'reset';

-- Shared, cross-instance rate limiting (used when RATELIMIT_DRIVER=postgres).
-- Fixed-window counters; old windows are pruned opportunistically.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
