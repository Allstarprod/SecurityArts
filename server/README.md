# SecurityArts Server

A **dependency-free** Node.js backend (only `node:` built-ins) that serves the static site
**and** the API on one port, with server-side artwork sealing, auth, and the security controls
mapped in [`../COMPLIANCE.md`](../COMPLIANCE.md).

## Run

```bash
cd server
node server.mjs          # → http://localhost:8137  (serves the whole site + /api)
```

No `npm install` needed. Requires Node ≥ 22. Open `http://localhost:8137/` — the frontend's
`js/api.js` auto-detects the backend and the newsletter, verification-publish, and checkout
flows hit real endpoints. (Open the files statically instead and they fall back to localStorage.)

## Configuration (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8137` | Listen port. |
| `SESSION_SECRET` | auto-generated & persisted to `data/session.secret` | HMAC key for sessions. Set explicitly in prod. |
| `TRUST_PROXY_HTTPS` | `0` | Set `1` behind a TLS terminator to emit HSTS, mark cookies `Secure`, and use the `__Host-` cookie prefix. |
| `PUBLIC_BASE_URL` | unset (dev: request host) | Origin for emailed links. **Required when `NODE_ENV=production`** — startup fails without it. |
| `LOGIN_FAIL_LIMIT` | `10` | Failed sign-ins per account before a 15-minute lockout. |
| `SEAL_DAILY_QUOTA` | `50` | Seals per user per rolling day. |
| `SEAL_PRIVATE_KEY_B64` | dev key on disk | The **active** seal-signing key (base64 PKCS#8 PEM). **Required in production.** |
| `SEAL_PUBLIC_KEY_B64` | derived | Optional; must match the private key or startup fails. |
| `SEAL_KEYS_JSON` | `[]` | Retired public keys (+ validity windows) so old seals keep verifying after a rotation. |

See `.env.example`. (This process reads real `process.env`; use your host's env or a loader.)

## Endpoints

```
GET  /api/health                 GET  /api/seal/pubkey
POST /api/auth/register          POST /api/auth/login        ← register sends a verification link
POST /api/auth/logout            POST /api/auth/logout-all   ← revokes every session for the account
GET  /api/auth/me                GET  /api/auth/verify-email?token=   POST /api/auth/resend-verification
POST /api/auth/forgot            POST /api/auth/reset        ← reset also revokes every other session
GET  /api/works                  GET  /api/works/:id
POST /api/works                  ← auth; PNG/JPEG/WebP only (magic bytes); server hashes + signs
DELETE /api/works/:id            ← owner only
GET  /api/verify/:hash           ← public provenance check: { verified, v, kid, signer, alg, sealedAt, signedFields, work }
GET  /api/seal/pubkey            ← key registry (active + retired public keys) + verification procedure
GET  /api/boards                 POST /api/boards           DELETE /api/boards/:id
POST /api/boards/:id/pins        ← toggle save
POST /api/checkout               ← auth; existing works only; order is "pending" until a payment webhook
GET  /api/orders/:id             POST /api/newsletter
```

Static hosting is allowlisted (`lib/static.mjs`): root `*.html`, `js/`, the design-system
`website/` tree, `og-image.png`, `robots.txt`, `sitemap.xml`, `llms*.txt`, favicons. Everything
else under the repo (`server/`, `.git/`, `.env`, docs, screenshots…) answers 404.

Envelope: every response is `{ "data": ..., "error": ... }`.

## Seals

A seal is an ECDSA P-256 / SHA-256 signature by the SecurityArts service key. New seals
are **v1**: the signature covers `"SA-SEAL-v1\n" + kid + "\n" + sha256hex + "\n" + ts`, so
the key id, the file hash and the sealing time are all tamper-evident. Seals issued before
2026-09-21 have no `v` field (**v0**) and signed only the raw 32 hash bytes; they verify
forever through the same registry. Byte-exact constructions, `openssl` commands for both
versions, and the rotation procedure are in [`../docs/seal-spec.md`](../docs/seal-spec.md).

Keys live in a registry (`lib/seal.mjs`): exactly one active signing key
(`SEAL_PRIVATE_KEY_B64`) plus any retired public keys (`SEAL_KEYS_JSON`). Rotating the key
adds the old public key as `retired` and swaps the private key — nothing already sealed
becomes unverifiable. Unknown key ids fail closed.

## Data (created at runtime, git-ignored)

```
server/data/db.json           app data (users, works, boards, orders, newsletter, registry)
server/data/seal-key.pem      DEV seal-signing key, ECDSA P-256 (chmod 600) — prod uses SEAL_PRIVATE_KEY_B64
server/data/seal-pub.pem      its public key (served by /api/seal/pubkey)
server/data/session.secret    HMAC session key                       (chmod 600)
server/data/audit.log         JSON-line security audit trail
```

## Layout

```
server.mjs            entry: http server, static host, security middleware, cluster, graceful shutdown
routes.mjs            all API handlers (async; data via the repo)
lib/repo.mjs          storage-agnostic repository interface + driver factory
lib/drivers/file.mjs  file driver: indexed, debounced atomic writes, blob externalization (dev/small)
lib/drivers/postgres.mjs  Postgres/Supabase driver: pooled, indexed, pagination (scale)
lib/ratelimit.mjs     pluggable rate limiter (memory or shared postgres)
lib/paths.mjs         shared data/blob dir paths
lib/security.mjs      headers/CSP, same-origin guard, body reader, audit log, IP resolution
lib/auth.mjs          scrypt passwords, HMAC-signed sessions, cookies
lib/seal.mjs          server-side ECDSA sealing + verification (v0/v1 payloads, key registry)
lib/http.mjs          router + response helpers + validators
schema.sql            Postgres/Supabase tables + indexes
SCALING.md            how to grow 10 → 100k users (+ Supabase setup)
```

## Production checklist

Terminate TLS at a proxy and set `TRUST_PROXY_HTTPS=1`; set a strong `SESSION_SECRET`; move
`data/` to a managed **Postgres**; set `SEAL_PRIVATE_KEY_B64` from your secret manager (the
signing key is an env var today, not an HSM/KMS — a KMS signer slots in by replacing the
single `sign()` callback in `lib/seal.mjs`, see `docs/seal-spec.md` §8); put a CDN/WAF in
front; integrate a PCI-compliant payment processor and an ESP for the newsletter. See
[`../COMPLIANCE.md`](../COMPLIANCE.md) hardening backlog.
