-- Sign-in moves to Clerk. Each of our users is linked to its Clerk user by clerk_id.
-- A UNIQUE index (not constraint) so the many not-yet-linked rows can all be NULL.
-- Apply AFTER 20260920120000_security_audit_hardening.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS clerk_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_id_idx ON users (clerk_id);
