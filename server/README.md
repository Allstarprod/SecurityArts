# SecurityArts Server

A **dependency-free** Node.js backend (only `node:` built-ins) that serves the static site
**and** the API on one port, with server-side artwork sealing, auth, and the security controls
mapped in [`../COMPLIANCE.md`](../COMPLIANCE.md).

## Run

```bash
cd server
node server.mjs          # → http://localhost:8137  (serves the whole site + /api)
```

No `npm install` needed. Requires Node ≥ 18. Open `http://localhost:8137/` — the frontend's
`js/api.js` auto-detects the backend and the newsletter, verification-publish, and checkout
flows hit real endpoints. (Open the files statically instead and they fall back to localStorage.)

## Configuration (env)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8137` | Listen port. |
| `SESSION_SECRET` | auto-generated & persisted to `data/session.secret` | HMAC key for sessions. Set explicitly in prod. |
| `TRUST_PROXY_HTTPS` | `0` | Set `1` behind a TLS terminator to emit HSTS and mark cookies `Secure`. |

See `.env.example`. (This process reads real `process.env`; use your host's env or a loader.)

## Endpoints

```
GET  /api/health                 GET  /api/seal/pubkey
POST /api/auth/register          POST /api/auth/login
POST /api/auth/logout            GET  /api/auth/me
GET  /api/works                  GET  /api/works/:id
POST /api/works                  ← upload; server hashes + signs (the authoritative seal)
GET  /api/verify/:hash           ← public provenance check
GET  /api/boards                 POST /api/boards           DELETE /api/boards/:id
POST /api/boards/:id/pins        ← toggle save
POST /api/checkout               GET  /api/orders/:id
POST /api/newsletter
```

Envelope: every response is `{ "data": ..., "error": ... }`.

## Data (created at runtime, git-ignored)

```
server/data/db.json           app data (users, works, boards, orders, newsletter, registry)
server/data/seal-key.pem      SecurityArts ECDSA P-256 private key   (chmod 600)
server/data/seal-pub.pem      public key (for /api/verify)
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
lib/seal.mjs          server-side ECDSA sealing + verification
lib/http.mjs          router + response helpers + validators
schema.sql            Postgres/Supabase tables + indexes
SCALING.md            how to grow 10 → 100k users (+ Supabase setup)
```

## Production checklist

Terminate TLS at a proxy and set `TRUST_PROXY_HTTPS=1`; set a strong `SESSION_SECRET`; move
`data/` to a managed **Postgres** and the signing key to an **HSM/KMS**; put a CDN/WAF in front;
integrate a PCI-compliant payment processor and an ESP for the newsletter. See
[`../COMPLIANCE.md`](../COMPLIANCE.md) hardening backlog.
