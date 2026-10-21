# Clerk sign-in — setup and switch-over

SecurityArts accounts move to [Clerk](https://clerk.com). Clerk handles sign-up, sign-in, email verification codes, passwords, password resets, Google sign-in and bot protection. Our own database still owns the rest of each account: handle, profile, sealed works, boards and orders. Each of our users is linked to its Clerk user through `users.clerk_id`.

**Everything stays on the old sign-in until the Clerk keys are set.** Setting `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` switches it over. Removing them switches it back.

## What changes when the keys are set

| | Before (keys unset) | After (keys set) |
|---|---|---|
| Sign-up / sign-in form | Our own form | Clerk's form, restyled, on the same pages |
| Passwords | scrypt hashes in our database | Held by Clerk; we never see them |
| Email verification | Our emailed link | Clerk's emailed code |
| Google | Our OAuth flow | Clerk's Google connection |
| Session | Our `sa_session` cookie | Clerk's session token, sent by `js/api.js` as `Authorization: Bearer` |
| Old routes (`/api/auth/register`, `/login`, `/forgot`, `/reset`, `/verify-email`, `/google`…) | Work | Answer **410** ("Sign-in has moved") |
| Welcome email | After email verification | When a brand-new account is first linked |

Code: `server/lib/clerk.mjs` (token checks, account linking), `server/lib/auth.mjs` (`currentUser` switches to Clerk), `js/api.js` (loads Clerk, attaches the token), `design-studies/join.js` and `ui_kits/discover/login.jsx` (mount Clerk's form). Tests: `server/test/clerk.mjs`.

## 1. Create the Clerk application (you)

1. Sign in at [dashboard.clerk.com](https://dashboard.clerk.com) and create an application called **SecurityArts**.
2. **User & authentication**:
   - Turn on **Email address** and require verification by **email code**.
   - Turn on **Password**.
   - Under **Social connections**, turn on **Google**.
   - Leave phone and username off.
3. Copy the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`) from **API keys**. The publishable key is public. **The secret key is not: never paste it into chat, commit it, or put it in page code.**

## 2. Try it locally

1. Create `server/.env.clerk-dev` containing **only** these two lines. Git and Vercel both ignore it.
   ```
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
   Don't put any database or storage settings in this file. The preview must keep using the local data file, and it refuses to pass API calls through otherwise.
2. In Claude's preview, start the **securityarts-clerk** server instead of **securityarts**. It runs `node --env-file=server/.env.clerk-dev server/server.mjs`.
3. Open `http://127.0.0.1:4174/join.html?mode=signup`. Clerk's form should appear.

## 3. Production

1. **Clerk production instance.** Clerk won't run a production instance on `*.vercel.app`, so it needs a domain you own. The canonical-domain decision (`securityarts.studio` or another) is still open. Add the DNS records Clerk lists, then copy the production keys (`pk_live_…`, `sk_live_…`).
2. **Content-Security-Policy.** Add the production Frontend API host (`https://clerk.<your-domain>`) to `CLERK_FAPI` in `server/lib/security.mjs`, then copy the same policy into `vercel.json`. A unit test fails if the two differ.
3. **Database.** Apply `supabase/migrations/20260920120000_security_audit_hardening.sql` if it isn't applied yet, then `supabase/migrations/20260925120000_clerk_accounts.sql`.
4. **Vercel environment variables** (Production and Preview):
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - Optionally `CLERK_AUTHORIZED_PARTIES`: a comma-separated list of every origin people sign in from. It defaults to `PUBLIC_BASE_URL`.
   - Optionally `CLERK_JWT_KEY`: the PEM public key from Clerk's **API keys** page. With it, token checks need no network call.

## 4. Import existing accounts

Run this from a machine that has the **production** environment. It reads users from whatever database the env file points at.

```bash
node --env-file=server/.env server/scripts/clerk-import.mjs
```

That is a dry run: it lists what would be imported, with email addresses masked. When the list looks right, run it again with `--apply`:

```bash
node --env-file=server/.env server/scripts/clerk-import.mjs --apply
```

- Each account is created in Clerk with `external_id` set to our user id, and Clerk's id is saved on our row.
- It is safe to re-run. Linked accounts are skipped, and an email that already exists in Clerk gets linked, not duplicated.
- A report (user ids and outcomes) is written to `server/data/clerk-import-*.json`.
- **Passwords don't carry over.** Ours are scrypt with a binary salt, which Clerk can't import. Imported people sign in with the code Clerk emails them, or set a new password with "Forgot password". Tell them before switching over.
- Accounts whose email was never verified are imported without a password too, so only whoever controls that inbox can get in.

## 5. Switch over, and switch back

- **Switch on:** set the two keys in Vercel and redeploy.
- **Switch back:** remove them and redeploy. The old sign-in returns. People who first joined through Clerk have no SecurityArts password; they would need "Forgot password" on the old form.
