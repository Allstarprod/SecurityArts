# Scaling the SecurityArts backend

The backend is built to grow from **10 → 100 → 1,000 → 100,000+** users without a
rewrite. Everything that used to be a hard ceiling is now a config switch.

## Architecture

```
routes.mjs ── repo (async interface) ──┬── drivers/file.mjs      (dev / small)
                                        └── drivers/postgres.mjs  (Supabase / scale)
security.mjs ── rateLimit ─────────────┬── ratelimit memory      (one instance)
                                        └── ratelimit postgres    (many instances)
```

Routes never touch a concrete store — they `await repo.*`. Sessions are already
**stateless** signed cookies (no server session store), so multiple app instances
behind a load balancer share nothing but the database.

## What changed vs. the old store (the things that would've broken under load)

| Old (would fall over) | Now |
|---|---|
| Rewrote the **entire** `db.json` synchronously on every write (O(n), blocks the event loop) | Debounced, async, atomic writes (file) / row-level SQL writes (pg) |
| Held every 8 MB image in RAM + in the JSON | Blobs stored **outside** the hot path (files / `work_blobs` table); never loaded for list queries |
| O(n) `.find`/`.filter` per request | O(1) indexed lookups (Maps / SQL indexes), server-side filter + pagination |
| In-memory state → **one instance only** | Postgres driver → run N stateless instances |
| In-memory rate limiter → per-process | Postgres rate limiter → shared across instances |
| No graceful shutdown / clustering | SIGTERM drain + `CLUSTER=max` to use all cores |

## Capacity ladder

- **≤ ~1k users, one box:** `DB_DRIVER=file` (default). Fine as-is.
- **Growing / multi-core box:** `DB_DRIVER=postgres` + `CLUSTER=max` + `RATELIMIT_DRIVER=postgres`.
- **Many boxes / autoscaling:** same, several instances behind a load balancer. Point
  `DATABASE_URL` at the Supabase **pooler** URL. Serve `/` static assets + images from a CDN.

## Connecting Supabase — do this to flip to scale mode

1. Create a project at supabase.com → **Project Settings → Database → Connection string → URI**.
   Use the **Connection pooling** URL if you'll run more than a couple of instances.
2. In Supabase **SQL Editor**, paste and run [`schema.sql`](schema.sql) (creates tables + indexes).
   *(Or set `DB_AUTO_MIGRATE=1` for the first boot and it applies itself.)*
3. Install the driver: `cd server && npm install` (pulls `pg`, an optional dependency).
4. Set env:
   ```
   DB_DRIVER=postgres
   DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
   RATELIMIT_DRIVER=postgres
   SESSION_SECRET=<64 hex chars: node -e "console.log(crypto.randomBytes(48).toString('hex'))">
   TRUST_PROXY=1            # if behind a load balancer / Supabase edge
   TRUST_PROXY_HTTPS=1      # if terminated at HTTPS
   ```
5. `npm start` (or `npm run start:cluster`). Health check echoes the active driver:
   `GET /api/health → { "driver": "postgres" }`.

Nothing in the frontend or the API contract changes — same endpoints, same shapes.

## Images → Supabase Storage (wired ✅)

When `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` are set, published images upload to the
public `work-images` bucket (already created on the SecurityArt project) and works
carry a CDN `img_url` instead of base64 in the DB. Detail responses return that URL
as `img`, so no frontend changes. Any upload failure falls back to DB blob storage —
publish never breaks. Unset = previous behavior, byte for byte.

Get the key: Dashboard → Project Settings → API → `service_role` (server-only secret).

## Verifying a deployment

```
node --env-file=.env server.mjs      # terminal 1
npm run verify:live                  # terminal 2 — 18 checks incl. driver=postgres
```
(`npm run test:e2e` runs the same suite without pinning the driver.)

## Remaining next steps for a "perfect" backend (not yet wired)

- **Payments:** the checkout handler is where Stripe goes (marked with a NOTE); it already
  computes server-authoritative prices.
- **CDN** in front of static assets (Cloudflare/Vercel) to take read load off Node
  (images are already CDN-served via Supabase Storage once activated).
- **Managed rate limiting / WAF** at the edge for very high volume (the app limiter stays as defense-in-depth).
