# Supabase ↔ GitHub

The database schema is version-controlled here and applied to the live project
(`ixdkfakibuctwhgwngsw`) through CI — so the DB never drifts from the code.

## How it works

- `migrations/*.sql` — ordered, timestamped schema changes (the source of truth).
- `.github/workflows/supabase-migrations.yml` — on every push to `main` that touches
  `migrations/**`, runs `supabase db push`. Already-applied migrations are skipped;
  only new ones run. It stays green (skips) until the two secrets below are set.

## One-time: enable auto-apply

Add two repo secrets (GitHub → repo **Settings → Secrets and variables → Actions**):

| Secret | Where |
|--------|-------|
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → generate |
| `SUPABASE_DB_PASSWORD`  | your project's database password (same one in `DATABASE_URL`) |

That's it — pushing a new migration file then applies it to production automatically.

## Adding a schema change

```bash
# install the CLI once: https://supabase.com/docs/guides/cli
supabase migration new add_something      # creates migrations/<ts>_add_something.sql
# ...edit the .sql...
git add supabase/migrations && git commit -m "db: add something" && git push
```

CI applies it on push. To test locally first: `supabase db reset` (rebuilds a local DB
from all migrations), or `supabase db push` to apply straight to the remote.

## Optional: native dashboard integration / preview branches

Supabase's dashboard **GitHub integration** (Project → Integrations → GitHub) can spin
up a preview *database* per pull request and apply migrations automatically without this
workflow. It needs the dashboard OAuth connect and is a **paid** feature — the CI
workflow above gives you the core "migrations in git, auto-applied" benefit for free.
