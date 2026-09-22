-- Security-audit hardening (2026-09-20 audit, server/ findings #3, #4, #5, #7).
-- Idempotent; mirrors the same ALTERs in server/schema.sql. NOT yet applied to
-- project ixdkfakibuctwhgwngsw — apply with `supabase db push` (or paste into the
-- SQL editor) BEFORE deploying the matching server code, which reads these columns.

-- #5 Session revocation: every session cookie embeds session_version and is honoured
-- only while it matches. Bumped on password reset / logout-everywhere / Google merge.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- #7 Pre-account takeover: password signups start unverified and prove ownership of
-- the address via an emailed link. A Google login that matches an UNVERIFIED account
-- by email replaces its password (random, unusable) instead of merging into it.
-- Existing rows are deliberately left unverified (false): a later Google login for
-- the same address will rotate their password and they can reset it by email —
-- the safe direction for a column we can't backfill with evidence.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- #7 Google's stable subject id; Google logins match on this FIRST, email second.
-- A UNIQUE index (not constraint) so multiple NULLs coexist for password-only users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub);

-- #3 Sealing no longer attaches a synthetic price; NULL = not for sale. Existing
-- rows keep whatever they have (data is not rewritten by a schema migration).
ALTER TABLE works ALTER COLUMN price DROP NOT NULL;

-- #4 Orders are created 'pending'. Only a verified payment-provider webhook may set
-- 'paid'; /api/me/sales counts paid lines only. Existing rows are untouched.
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

-- #7 One token table serves password resets AND email verification; `purpose`
-- prevents a verification token from being redeemed as a password reset.
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'reset';
