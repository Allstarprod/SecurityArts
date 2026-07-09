# Deploying SecurityArts to Vercel (all-in-one, serverless)

The whole app runs on Vercel: static site on the CDN, the API as one serverless
function — **same origin**, so CSRF/same-site cookies keep working with no CORS.

```
Browser ──▶ Vercel CDN            (static: landing, DS pages, vendored React, *.app.js)
        └─▶ /api/*  ──▶  api/[...path].mjs   (serverless function → same router as server/)
                                   │
                                   ├─▶ Supabase Postgres  (DB_DRIVER=postgres, POOLER url)
                                   └─▶ Supabase Storage   (images/CDN)
```

## What makes this work

The API was already state-externalized, so it maps cleanly to serverless:

- **Stateless sessions** (HMAC-signed cookies) — no server session store.
- **Postgres driver** — no local disk needed (the file driver won't persist on Vercel).
- **Shared rate limiter** (`RATELIMIT_DRIVER=postgres`) — each invocation is isolated, so
  the in-memory limiter is useless here; the `rate_limits` table holds limits across invocations.
- **Env-provided seal key** (`SEAL_*_B64`) — stable identity without writable disk.
- **Supabase Storage** for images — no local blob dir.

`api/[...path].mjs` is a thin adapter over the exact same `router` + security stack as
`server/server.mjs`. The standalone server still works (Render / any Node host) unchanged.

## One-time setup (git-push deploys — the good state)

1. **Vercel dashboard → Add New… → Project → Import** `Allstarprod/SecurityArts`.
   - Framework preset: **Other**. Build command / output are read from `vercel.json`.
2. **Add Environment Variables** (Project → Settings → Environment Variables) — the same
   secrets already in `server/.env`, but use the **Supabase connection POOLER** url for
   `DATABASE_URL` (serverless opens many short connections; the pooler on port 6543 is required):
   ```
   DB_DRIVER            = postgres
   DATABASE_URL         = postgresql://postgres.ixdkfakibuctwhgwngsw:<PWD>@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
   #                        ^ verified working for this project (aws-1, transaction pooler, port 6543)
   RATELIMIT_DRIVER     = postgres
   PG_POOL_MAX          = 1
   SESSION_SECRET       = <64 hex>            (from server/.env)
   SEAL_PRIVATE_KEY_B64 = <...>               (from server/.env)
   SEAL_PUBLIC_KEY_B64  = <...>               (from server/.env)
   SUPABASE_URL         = https://ixdkfakibuctwhgwngsw.supabase.co
   SUPABASE_SERVICE_KEY = <service_role key>
   SUPABASE_BUCKET      = work-images
   TRUST_PROXY          = 1
   TRUST_PROXY_HTTPS    = 1
   ```
3. **Deploy.** Every push to `main` then redeploys automatically; branches get preview URLs.
   Check `GET /api/health` on the deployment → `{ "driver": "postgres" }`.

### Or via CLI (needs a token)

```bash
npm i -g vercel
vercel link --repo         # link Allstarprod/SecurityArts
vercel env add DATABASE_URL # …repeat for each var above (or paste in the dashboard)
vercel deploy              # preview   (vercel deploy --prod for production)
```
Non-interactive/CI: set `VERCEL_TOKEN` and pass `--token $VERCEL_TOKEN --yes`.

## Vercel-specific limits & notes

- **Request body ≤ 4.5 MB.** Vercel caps serverless request bodies at ~4.5 MB. The seal
  images the app generates are tiny SVGs, but a genuine >4.5 MB upload would be rejected by
  the platform before our handler runs. Fix when needed: upload large files **directly** to
  Supabase Storage from the client and post only the resulting URL to `/api/works`.
- **Use the POOLER url**, not the direct `:5432` connection — serverless + direct connections
  exhausts Postgres's connection cap fast. `PG_POOL_MAX=1` keeps each instance lean.
- **Audit log** currently writes to local disk (best-effort; a no-op on Vercel's read-only FS).
  For production route it to a log drain or a Supabase table.
- The standalone `server/` still runs anywhere as a normal Node server (see `server/DEPLOY.md`);
  Vercel just reuses its router. Nothing about the Render path changed.
