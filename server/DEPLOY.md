# Deploying SecurityArts (auto-deploy on push)

Pushing to `main` on GitHub already runs the full test suite (CI). This wires the
next step: a successful push also **deploys** automatically.

## Path A — Render (recommended: native git auto-deploy, no tokens to juggle)

One-time, in the Render dashboard:

1. **New → Blueprint** → connect the GitHub repo **Allstarprod/SecurityArts**.
   Render reads [`render.yaml`](../render.yaml) and creates the `securityarts` web service.
2. When prompted, paste the five secrets (values you already have locally in `server/.env`):
   - `DATABASE_URL` — the Supabase connection string (percent-encoded password)
   - `SESSION_SECRET`
   - `SUPABASE_SERVICE_KEY`
   - `SEAL_PRIVATE_KEY_B64`, `SEAL_PUBLIC_KEY_B64`
3. Set `PUBLIC_BASE_URL` to the service's public origin (e.g. `https://securityarts.onrender.com`,
   or the custom domain once it's mapped). `render.yaml` ships a placeholder — **the server
   refuses to start in production without it**, because every emailed link (password reset,
   email verification) is built from it and must never come from the request's Host header.
4. Apply any new files in `supabase/migrations/` to the database first (`supabase db push`,
   or paste into the SQL editor) — the server reads columns they add.
5. Deploy. From then on **every `git push origin main` redeploys automatically**
   (`autoDeploy: true`). Health check: `/api/health` must return 200.

To stay always-on (no cold starts), change `plan: free` → `plan: starter` in `render.yaml`.

## Path B — Any container host (Fly.io / Railway / VPS / Cloud Run)

A production [`Dockerfile`](../Dockerfile) is included. Example (Fly.io):

```bash
fly launch --no-deploy            # generates fly.toml from the Dockerfile
fly secrets set \
  DATABASE_URL='...' SESSION_SECRET='...' SUPABASE_SERVICE_KEY='...' \
  SUPABASE_URL='https://ixdkfakibuctwhgwngsw.supabase.co' \
  PUBLIC_BASE_URL='https://<your-app>.fly.dev' \
  SEAL_PRIVATE_KEY_B64='...' SEAL_PUBLIC_KEY_B64='...'
fly deploy
```

For auto-deploy on push, add a GitHub Actions job that runs `flyctl deploy` with a
`FLY_API_TOKEN` repo secret (after CI passes).

## The seal key — read this once

Artwork seals are signed with an ECDSA key. In production it MUST come from
`SEAL_PRIVATE_KEY_B64` / `SEAL_PUBLIC_KEY_B64` (already in your `server/.env`) so that:

- every instance signs with the **same identity** (multi-instance verification works), and
- redeploys don't mint a **new** key and silently break verification of existing seals.

Generate a fresh pair only if you ever need to (and know it invalidates all prior seals):

```bash
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ec',{namedCurve:'P-256',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});console.log('SEAL_PRIVATE_KEY_B64='+Buffer.from(k.privateKey).toString('base64'));console.log('SEAL_PUBLIC_KEY_B64='+Buffer.from(k.publicKey).toString('base64'))"
```

## Verifying a deploy

Once live, point the suite at the public URL:

```bash
PORT=443 …   # or just hit the endpoints:
curl https://<your-app>.onrender.com/api/health   # → { "driver": "postgres", ... }
```
