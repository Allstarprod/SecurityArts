// All API routes. Handlers receive a ctx: { req,res,params,body,user,ip,https }.
// Data access goes through the async `repo` (file or postgres) — never touch a
// concrete store here, so the same routes serve 10 users or 100k.
import crypto from "node:crypto";
import { repo } from "./lib/repo.mjs";
import { putImage, deleteImage, blobStoreActive } from "./lib/blobstore.mjs";
import { decodeImageDataUri } from "./lib/image.mjs";
import { seal, verifySeal, publicKeyPem, publicKeys, SIGNER_ID, ACTIVE_KID, SEAL_ALG, SEAL_VERSION, SEAL_PROCEDURE } from "./lib/seal.mjs";
import { Router, ok, created, fail, str, isEmail, CATS } from "./lib/http.mjs";
import {
  hashPassword, verifyPassword, passwordNeedsRehash, DUMMY_HASH, sessionVersionOf,
  createSession, sessionCookie, clearCookie, parseCookies,
} from "./lib/auth.mjs";
import { rateLimit, rateLimitPeek, rateLimitHit, audit, emailKey } from "./lib/security.mjs";
import { sendMail } from "./lib/mailer.mjs";
import { googleConfigured, redirectUri, authUrl, exchangeCode, pkcePair } from "./lib/oauth.mjs";

const LOGIN_PATH = "/SecurityArts Design System/website/ui_kits/discover/";

// Per-account login lockout (audit HIGH #5): after LOGIN_FAIL_LIMIT failed attempts
// the account is refused for LOGIN_FAIL_WINDOW, independent of source IP — a
// distributed brute force can't dodge it by rotating addresses. The per-IP limiter
// (20/min) still caps spraying across many accounts from one address.
const LOGIN_FAIL_LIMIT = Number(process.env.LOGIN_FAIL_LIMIT) || 10;
const LOGIN_FAIL_WINDOW = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = 20;
// Per-user sealing quota per rolling day (audit HIGH #3): bounds storage + signing
// abuse by one account. Env-tunable so a paid tier can lift it later.
const SEAL_DAILY_QUOTA = Number(process.env.SEAL_DAILY_QUOTA) || 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;   // reset links: 1 hour
const VERIFY_TTL = 24 * DAY_MS;     // verification links: 24 hours
// Every limiter guarding auth or sealing is `critical`: if the shared counter store
// is down it falls back to the in-process limiter instead of waving traffic through.
const CRITICAL = { critical: true };

// Canonical public origin for links we EMAIL out (password resets, verification).
// Pin it via PUBLIC_BASE_URL in production so a spoofed Host header can't point a
// link at an attacker domain (host-header / reset poisoning — CWE-640). Falls back
// to the request host for local dev only; lib/config.mjs refuses to start a
// production process without it.
function publicOrigin(req, https) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `${https ? "https" : "http"}://${req.headers.host}`;
}

const MEDIUM = {
  illustration: "Digital illustration", painting: "Oil on linen", "3d": "3D render",
  photography: "35mm photograph", lettering: "Hand lettering", concept: "Concept art", mixed: "Mixed media",
};

// Authoritative pricing — never trust a client-sent price (OWASP A04/A08), and never
// INVENT one either: an item is purchasable only if it is a sealed work in the repo
// that carries a real price object. (The old deterministic priceFor()/MARKET tables
// fabricated prices for arbitrary ids — audit §0 / HIGH #4.) Returns null for an
// unknown id or a work that isn't for sale.
async function priceOf(id) {
  const w = await repo.works.findById(id);
  return w && w.price && typeof w.price === "object" ? w.price : null;
}

// Self view — returned only to the authenticated owner (register / login / me).
// Includes email (their own), their editable profile, and their @handle (stored or,
// until claimed, one derived from their email so the UI always has something to show).
function publicUser(u) {
  return u ? {
    id: u.id, email: u.email, name: u.name, handle: u.handle || handleFrom(u.email), handleClaimed: !!u.handle,
    emailVerified: u.emailVerified === true, profile: u.profile || {},
  } : null;
}

// Public username derived from email — meant to be shown publicly, so exposing it
// (not the email address itself) on a public profile is fine.
function handleFrom(email) { return String(email || "").split("@")[0].replace(/[^a-z0-9]+/gi, "").toLowerCase() || "member"; }

// Profile customization — server owns the whitelist so the client can't inject arbitrary values.
const ACCENTS = ["brass", "rose", "violet", "teal", "amber", "sky"];
const VISIBILITY = ["public", "private"];
const ROLES = ["collector", "artist"];

// Validate + merge a profile patch onto the previous profile. Only known fields
// are accepted (no prototype pollution / arbitrary keys), each length-capped.
function cleanProfile(body, prev) {
  const p = { ...(prev || {}) };
  if (body.pronouns !== undefined) p.pronouns = str(body.pronouns, { max: 40 }) || "";
  if (body.gender !== undefined) p.gender = str(body.gender, { max: 40 }) || "";
  if (body.bio !== undefined) p.bio = str(body.bio, { max: 600 }) || "";
  if (body.accent !== undefined) p.accent = ACCENTS.includes(body.accent) ? body.accent : "brass";
  if (body.visibility !== undefined) p.visibility = VISIBILITY.includes(body.visibility) ? body.visibility : "public";
  if (body.likes !== undefined) {
    const arr = Array.isArray(body.likes) ? body.likes : [];
    p.likes = arr.map((x) => str(x, { max: 60 })).filter(Boolean).slice(0, 12);
  }
  // Onboarding answers (the post-signup quiz): role + interested mediums + a completion flag.
  if (body.role !== undefined) p.role = ROLES.includes(body.role) ? body.role : (p.role || "");
  if (body.interests !== undefined) {
    const arr = Array.isArray(body.interests) ? body.interests : [];
    p.interests = arr.map((x) => str(x, { max: 24 })).filter((x) => CATS.includes(x)).slice(0, 12);
  }
  if (body.onboarded !== undefined) p.onboarded = !!body.onboarded;
  return p;
}

// Public view — returned to ANYONE. Never leaks email. A private profile discloses
// only identity + the private flag so the UI can say "this profile is private".
function publicProfile(u) {
  if (!u) return null;
  const p = u.profile || {};
  // Fallback handle for the PUBLIC view must not be email-derived: a private profile
  // (and any unclaimed account) would otherwise leak the email local-part. Use a
  // neutral id-based slug until the owner claims a real handle.
  const fallbackHandle = "user_" + String(u.id || "").replace(/[^a-z0-9]/gi, "").slice(-6);
  const base = { id: u.id, name: u.name, handle: u.handle || fallbackHandle, visibility: VISIBILITY.includes(p.visibility) ? p.visibility : "public" };
  if (base.visibility === "private") return base;
  return { ...base, pronouns: p.pronouns || "", gender: p.gender || "", bio: p.bio || "", likes: Array.isArray(p.likes) ? p.likes : [], accent: ACCENTS.includes(p.accent) ? p.accent : "brass", bannerUrl: p.bannerUrl || "" };
}

/* ---- emailed single-use tokens ------------------------------------- */
// Mint a token, store only its SHA-256, and return the raw value for the link. One
// active token per (user, purpose); `purpose` keeps a verification link from ever
// being redeemed as a password reset.
async function issueToken(userId, purpose, ttlMs) {
  await repo.passwordResets.removeByUser(userId, purpose);
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await repo.passwordResets.create({ tokenHash, userId, purpose, expiresAt: Date.now() + ttlMs, createdAt: new Date().toISOString() });
  return token;
}
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Email-verification link (audit HIGH #7). Best-effort — a mail hiccup must never
// fail the signup; the user can ask for another via /api/auth/resend-verification.
async function sendVerificationMail(req, https, user) {
  const token = await issueToken(user.id, "verify", VERIFY_TTL);
  const link = `${publicOrigin(req, https)}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: user.email, subject: "Verify your SecurityArts email",
    text: `Hi ${user.name},\n\nConfirm this address to finish setting up your SecurityArts account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, you can ignore this email.\n\n— SecurityArts`,
  }).catch(() => {});
}

export const router = new Router();

/* ---- health --------------------------------------------------------- */
router.get("/api/health", ({ res }) => ok(res, { status: "ok", signer: SIGNER_ID, driver: repo.driver }));

// Keep-alive: a trivial real DB read so a free-tier database registers activity and
// doesn't auto-pause. Hit by a daily Vercel cron (see vercel.json). Cheap + public.
router.get("/api/keepalive", async ({ res }) => {
  try { await repo.works.list({ limit: 1 }); return ok(res, { alive: true, ts: new Date().toISOString() }); }
  catch { return ok(res, { alive: false }); }
});
// Public key registry + the verification procedure (how-it-works.html promises "the
// exact verification procedure is published alongside the public key"). `signer` and
// `publicKey` are the original top-level fields and stay for existing consumers; the
// active key is also keys[0]. Retired keys are listed so seals they signed remain
// verifiable by anyone. The spec is a static file: served by Vercel's CDN at
// /docs/seal-spec.md (the standalone allowlist in lib/static.mjs does not cover docs/).
router.get("/api/seal/pubkey", ({ res }) => ok(res, {
  signer: SIGNER_ID, publicKey: publicKeyPem,
  kid: ACTIVE_KID, alg: SEAL_ALG, version: SEAL_VERSION,
  keys: publicKeys(),
  spec: `${(process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "")}/docs/seal-spec.md`,
  procedure: SEAL_PROCEDURE,
}));

/* ---- auth ----------------------------------------------------------- */
router.post("/api/auth/register", async ({ res, req, body, ip, https }) => {
  if (!(await rateLimit(`reg:${ip}`, 5, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  const password = str(body.password, { min: 8, max: 200 });
  const name = str(body.name, { min: 1, max: 80 }) || "Artist";
  if (!email || !password) return fail(res, 400, "Valid email and an 8+ character password are required.");
  if (await repo.users.findByEmail(email)) return fail(res, 409, "That email is already registered.");
  // Starts UNVERIFIED: ownership of the address is proven by the emailed link. Until
  // then a Google login for this email may replace the account (see the callback).
  const user = {
    id: "usr_" + crypto.randomUUID(), email, name, pass: await hashPassword(password), createdAt: new Date().toISOString(),
    sessionVersion: 1, emailVerified: false, googleSub: null,
  };
  await repo.users.create(user);
  audit("auth.register", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user), { https }));
  // The welcome email goes out from /api/auth/verify-email once the address is proven —
  // never to an address someone merely typed (audit HIGH #4: unauthenticated relay).
  await sendVerificationMail(req, https, user);
  return created(res, publicUser(user));
});

router.post("/api/auth/login", async ({ res, body, ip, https }) => {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  // Account lockout is keyed by a hash of the submitted email — real or not — so the
  // 429 can't be used to enumerate accounts. Checked before anything costs CPU.
  const acct = `acct:${emailKey(email)}`;
  if (!(await rateLimitPeek(acct, LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW, CRITICAL))) {
    audit("auth.login.locked", { emailKey: emailKey(email), ip });
    return fail(res, 429, "Too many failed sign-in attempts for this account. Try again in 15 minutes.");
  }
  if (!(await rateLimit(`login:${ip}`, LOGIN_IP_LIMIT, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const user = await repo.users.findByEmail(email);
  // Always run the (deliberately slow) scrypt compare — against a dummy hash when
  // the email is unknown — so response time can't reveal whether an account exists
  // (same message alone isn't enough: skipping scrypt for missing users leaks timing).
  // Registration caps passwords at 200 chars, so anything longer can't be right.
  const okPass = password.length <= 200 && await verifyPassword(password, user ? user.pass : DUMMY_HASH);
  if (!user || !okPass) {
    await rateLimitHit(acct, LOGIN_FAIL_WINDOW, CRITICAL); // only FAILURES count toward the lockout
    audit("auth.login.fail", { emailKey: emailKey(email), ip });
    return fail(res, 401, "Incorrect email or password."); // same message = no user enumeration
  }
  // Legacy (N=2^14) hashes are upgraded here, while we still hold the plaintext.
  if (passwordNeedsRehash(user.pass)) await repo.users.update(user.id, { pass: await hashPassword(password) }).catch(() => {});
  audit("auth.login.ok", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user), { https }));
  return ok(res, publicUser(user));
});

router.post("/api/auth/logout", ({ res, https }) => { res.setHeader("Set-Cookie", clearCookie({ https })); return ok(res, { loggedOut: true }); });
// Sign out EVERY device: bump the session version so every outstanding cookie —
// including ones on a lost laptop or leaked in a log — stops verifying.
router.post("/api/auth/logout-all", async ({ res, user, ip, https }) => {
  if (!user) return fail(res, 401, "Sign in first.");
  await repo.users.update(user.id, { sessionVersion: sessionVersionOf(user) + 1 });
  audit("auth.logout.all", { userId: user.id, ip });
  res.setHeader("Set-Cookie", clearCookie({ https }));
  return ok(res, { loggedOut: true, everywhere: true });
});
router.get("/api/auth/me", ({ res, user }) => ok(res, publicUser(user)));

// What optional sign-in methods are wired (so the login page shows the right buttons).
router.get("/api/auth/config", ({ res }) => ok(res, {
  google: googleConfigured,
  // Public client-side keys (safe to expose): PostHog project key + host for analytics.
  posthog: process.env.POSTHOG_KEY || null,
  posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
}));

/* ---- email verification --------------------------------------------- */
// The emailed link lands here (a browser GET), so the answer is a redirect back into
// the app — ?verified=1 on success, ?verified=0 for a bad/expired link — never JSON.
// Deliberately does NOT sign the visitor in: a GET reached from an inbox should flip
// one flag and nothing more.
router.get("/api/auth/verify-email", async ({ res, url, ip }) => {
  const redirect = (verified) => { res.writeHead(302, { Location: encodeURI(LOGIN_PATH + "login.html") + `?verified=${verified ? 1 : 0}` }); res.end(); };
  if (!(await rateLimit(`verify:${ip}`, 20, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const token = str(url.searchParams.get("token") || "", { min: 32, max: 200 });
  const rec = token ? await repo.passwordResets.findByHash(hashToken(token)) : null;
  if (!rec || rec.purpose !== "verify" || rec.expiresAt < Date.now()) {
    if (rec && rec.purpose === "verify") await repo.passwordResets.consume(rec.tokenHash); // clear an expired one
    audit("auth.verify.fail", { ip });
    return redirect(false);
  }
  const user = await repo.users.update(rec.userId, { emailVerified: true });
  await repo.passwordResets.removeByUser(rec.userId, "verify"); // single-use
  audit("auth.verify.ok", { userId: rec.userId, ip });
  if (user) {
    // Welcome mail — only now, to an address we KNOW the account holder controls.
    await sendMail({
      to: user.email, subject: "Welcome to SecurityArts",
      text: `Hi ${user.name},\n\nYour SecurityArts account is ready — seal your work to prove it's yours, collect verified human art, and carry provenance with every piece.\n\n— SecurityArts`,
    }).catch(() => {});
  }
  return redirect(true);
});

// Ask for a fresh verification link (signed-in, unverified accounts only).
router.post("/api/auth/resend-verification", async ({ res, req, user, ip, https }) => {
  if (!user) return fail(res, 401, "Sign in first.");
  if (user.emailVerified) return ok(res, { verified: true, sent: false });
  if (!(await rateLimit(`resend:${user.id}`, 3, 10 * 60000, CRITICAL))) return fail(res, 429, "A link was sent recently. Check your inbox (and spam) before asking again.");
  await sendVerificationMail(req, https, user);
  audit("auth.verify.resend", { userId: user.id, ip });
  return ok(res, { verified: false, sent: true });
});

/* ---- password reset ------------------------------------------------- */
// Request a reset link. Always returns the same response — never reveals whether an
// account exists (no user enumeration). Delivery is via the mailer (or, unconfigured,
// the link is logged server-side so the flow is usable in dev).
router.post("/api/auth/forgot", async ({ res, req, body, ip, https }) => {
  if (!(await rateLimit(`forgot:${ip}`, 5, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  if (email) {
    const user = await repo.users.findByEmail(email);
    if (user) {
      const token = await issueToken(user.id, "reset", RESET_TTL); // one active token at a time
      const link = publicOrigin(req, https) + encodeURI(LOGIN_PATH + "login.html") + "?token=" + token;
      await sendMail({ to: email, subject: "Reset your SecurityArts password", text: `Reset your SecurityArts password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request it, you can ignore this email.` });
      audit("auth.forgot", { userId: user.id, ip });
    } else {
      audit("auth.forgot.unknown", { emailKey: emailKey(email), ip });
    }
  }
  return ok(res, { sent: true });
});

// Complete a reset: swap the password for a valid, unexpired token and sign in.
// Every other session for the account is revoked in the same step (audit HIGH #5) —
// a reset is exactly when a user most needs an attacker's cookie to stop working.
router.post("/api/auth/reset", async ({ res, body, ip, https }) => {
  if (!(await rateLimit(`reset:${ip}`, 10, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const token = str(body.token, { min: 32, max: 200 });
  const password = str(body.password, { min: 8, max: 200 });
  if (!token || !password) return fail(res, 400, "A valid reset link and an 8+ character password are required.");
  const rec = await repo.passwordResets.findByHash(hashToken(token));
  if (!rec || rec.purpose !== "reset" || rec.expiresAt < Date.now()) {
    if (rec && rec.purpose === "reset") await repo.passwordResets.consume(rec.tokenHash); // clear an expired one
    return fail(res, 400, "This reset link is invalid or has expired.");
  }
  const before = await repo.users.findById(rec.userId);
  if (!before) return fail(res, 400, "This reset link is invalid or has expired.");
  const user = await repo.users.update(rec.userId, { pass: await hashPassword(password), sessionVersion: sessionVersionOf(before) + 1 });
  await repo.passwordResets.removeByUser(rec.userId, "reset"); // single-use: kill all their reset tokens
  audit("auth.reset", { userId: rec.userId, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user), { https })); // sign in (new version)
  return ok(res, publicUser(user));
});

/* ---- Google OAuth --------------------------------------------------- */
// The state cookie carries `<state>.<pkceVerifier>`: state defeats login CSRF, the
// PKCE verifier makes an intercepted authorization code useless on its own. Same
// `__Host-` treatment as the session cookie over HTTPS.
const OAUTH_COOKIE = ({ https }) => (https ? "__Host-sa_oauth" : "sa_oauth");
const oauthCookie = (value, https, maxAge) =>
  [`${OAUTH_COOKIE({ https })}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`].concat(https ? ["Secure"] : []).join("; ");
const timingEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// Kick off the flow: set a signed-state cookie (CSRF) and bounce to Google.
router.get("/api/auth/google", ({ res, req, https }) => {
  if (!googleConfigured) return fail(res, 503, "Google sign-in isn't configured.");
  const state = crypto.randomBytes(16).toString("hex");
  const { verifier, challenge } = pkcePair();
  res.setHeader("Set-Cookie", oauthCookie(`${state}.${verifier}`, https, 600));
  res.writeHead(302, { Location: authUrl({ state, redirect: redirectUri(req, https), codeChallenge: challenge }) });
  res.end();
});

// Google redirects back here with ?code&state. Verify state, exchange the code (with
// the PKCE verifier), then find-or-create the user and drop them into the app signed in.
//
// Account matching (audit HIGH #7): google_sub FIRST — it's Google's stable id for the
// person. Only then by email, and an email-only match is trusted ONLY if that account
// already proved it owns the address (email_verified). An UNVERIFIED password account
// with the same email could be an attacker's pre-registration, so it is claimed for
// the Google user instead of merged: password replaced with an unusable random value,
// every existing session revoked, google_sub recorded.
router.get("/api/auth/google/callback", async ({ res, req, url, ip, https }) => {
  if (!googleConfigured) return fail(res, 503, "Google sign-in isn't configured.");
  if (!(await rateLimit(`google:${ip}`, 20, 60000, CRITICAL))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [cookieState, verifier] = String(parseCookies(req)[OAUTH_COOKIE({ https })] || "").split(".");
  if (!code || !state || !cookieState || !verifier || !timingEqual(state, cookieState)) { audit("auth.google.badstate", { ip }); return fail(res, 400, "Sign-in couldn't be verified. Please try again."); }
  let profile;
  try { profile = await exchangeCode({ code, redirect: redirectUri(req, https), codeVerifier: verifier }); }
  catch (e) { audit("auth.google.exchangefail", { ip, msg: e.message }); return fail(res, 502, "Google sign-in failed. Please try again."); }
  // Only trust a Google email we KNOW is verified — otherwise an unverified id_token
  // claim could be used to link to (or pre-create) an account for an email the caller
  // doesn't own. exchangeCode already surfaces email_verified as profile.emailVerified.
  if (!profile.emailVerified) { audit("auth.google.unverified", { ip, emailKey: emailKey(profile.email) }); return fail(res, 403, "Your Google account's email isn't verified."); }

  let user = await repo.users.findByGoogleSub(profile.sub);
  let isNew = false;
  try {
    if (user) {
      audit("auth.google.login", { userId: user.id, ip });
    } else {
      const byEmail = await repo.users.findByEmail(profile.email);
      if (byEmail && byEmail.googleSub && byEmail.googleSub !== profile.sub) {
        // Same address, different Google identity than the one already linked.
        audit("auth.google.submismatch", { userId: byEmail.id, ip });
        return fail(res, 403, "This email is linked to a different Google account.");
      }
      if (byEmail && !byEmail.emailVerified) {
        user = await repo.users.update(byEmail.id, {
          pass: await hashPassword(crypto.randomBytes(24).toString("hex")),
          sessionVersion: sessionVersionOf(byEmail) + 1,
          emailVerified: true, googleSub: profile.sub,
        });
        await repo.passwordResets.removeByUser(byEmail.id); // any pending reset/verify links die with the old owner
        audit("auth.google.claim", { userId: byEmail.id, ip });
      } else if (byEmail) {
        user = await repo.users.update(byEmail.id, { googleSub: profile.sub }); // verified owner: link identities
        audit("auth.google.link", { userId: byEmail.id, ip });
      } else {
        // Passwordless account (unusable random hash); they'll keep using Google.
        isNew = true;
        user = {
          id: "usr_" + crypto.randomUUID(), email: profile.email, name: profile.name || "Artist",
          pass: await hashPassword(crypto.randomBytes(24).toString("hex")), createdAt: new Date().toISOString(),
          sessionVersion: 1, emailVerified: true, googleSub: profile.sub,
        };
        await repo.users.create(user);
        audit("auth.google.register", { userId: user.id, ip });
      }
    }
  } catch (e) {
    if (e && e.code === "GOOGLE_SUB_TAKEN") { audit("auth.google.subtaken", { ip }); return fail(res, 409, "That Google account is already linked to another profile."); }
    throw e;
  }
  res.setHeader("Set-Cookie", [sessionCookie(createSession(user), { https }), oauthCookie("", https, 0)]);
  const dest = LOGIN_PATH + (isNew ? "onboarding.html" : "me.html");
  res.writeHead(302, { Location: encodeURI(dest) });
  res.end();
});

/* ---- profile -------------------------------------------------------- */
// Update your own profile (pronouns, gender, bio, likes, accent, visibility).
const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

router.post("/api/profile", async ({ res, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to edit your profile.");
  if (!(await rateLimit(`prof:${ip}`, 30, 60000))) return fail(res, 429, "Slow down a moment.");
  const patch = { profile: cleanProfile(body, user.profile) };
  if (body.name !== undefined) {
    const name = str(body.name, { min: 1, max: 80 });
    if (!name) return fail(res, 400, "Your name needs to be 1–80 characters.");
    patch.name = name;
  }
  if (body.handle !== undefined) {
    const handle = String(body.handle || "").trim().toLowerCase();
    if (!HANDLE_RE.test(handle)) return fail(res, 400, "Handles are 3–30 characters: lowercase letters, numbers, and underscores.");
    if (handle !== (user.handle || "").toLowerCase()) {
      const taken = await repo.users.findByHandle(handle);
      if (taken && taken.id !== user.id) return fail(res, 409, "That handle is already taken.");
      patch.handle = handle;
    }
  }
  let updated;
  try {
    updated = await repo.users.update(user.id, patch);
  } catch (e) {
    // Both drivers throw HANDLE_TAKEN when a concurrent claim wins the race for the
    // same handle (the pre-check above can't be atomic). Return a clean 409, not a 500.
    if (e && e.code === "HANDLE_TAKEN") return fail(res, 409, "That handle is already taken.");
    throw e;
  }
  if (!updated) return fail(res, 404, "Account not found.");
  audit("profile.update", { userId: user.id, ip });
  return ok(res, publicUser(updated));
});

// Banner image — upload (data-URI) or remove. Uploads to Supabase Storage when
// configured (CDN URL), else stores inline (dev). Kept off the main profile save so
// the heavy image payload only travels when the banner actually changes. Same
// magic-byte intake as sealing: PNG/JPEG/WebP only, type from the bytes.
router.post("/api/profile/banner", async ({ res, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to edit your profile.");
  if (!(await rateLimit(`banner:${ip}`, 12, 60000))) return fail(res, 429, "Slow down a moment.");
  const profile = { ...(user.profile || {}) };
  if (body.remove === true) {
    profile.bannerUrl = "";
  } else {
    const img = decodeImageDataUri(body.image, { maxBytes: 2_000_000 });
    if (!img) return fail(res, 400, "Upload a JPG, PNG, or WebP under 2MB.");
    const url = blobStoreActive ? await putImage("banner_" + user.id, img) : img.dataUri;
    if (!url) return fail(res, 502, "Couldn't store the image. Try again.");
    profile.bannerUrl = url;
  }
  const updated = await repo.users.update(user.id, { profile });
  audit("profile.banner", { userId: user.id, storage: blobStoreActive ? "supabase" : "inline", removed: body.remove === true, ip });
  return ok(res, publicUser(updated));
});

// Public profile lookup by @handle (for vanity links / the /@handle redirect).
router.get("/api/handle/:handle", async ({ res, params }) => {
  const u = await repo.users.findByHandle(String(params.handle || "").toLowerCase());
  if (!u) return fail(res, 404, "No such profile.");
  return ok(res, publicProfile(u));
});

// Public profile by user id — honors the owner's public/private choice server-side.
router.get("/api/users/:id", async ({ res, params }) => {
  const u = await repo.users.findById(params.id);
  if (!u) return fail(res, 404, "No such profile.");
  return ok(res, publicProfile(u));
});

/* ---- works + verification ------------------------------------------ */
router.get("/api/works", async ({ res, url }) => {
  const cat = url.searchParams.get("cat");
  const q = url.searchParams.get("q") || "";
  const limit = Number(url.searchParams.get("limit")) || undefined;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const list = await repo.works.list({ cat, q, limit, offset }); // driver drops the blob + adds hasImage
  return ok(res, list);
});

router.get("/api/works/:id", async ({ res, params }) => {
  const w = await repo.works.findById(params.id);
  if (!w) return fail(res, 404, "Work not found.");
  // CDN-hosted image: hand back the URL (an <img src> takes it like a data URI)
  // and never touch blob bytes. Otherwise fall back to the repo's blob store.
  if (w.imgUrl) return ok(res, { ...w, img: w.imgUrl, hasImage: true });
  const img = await repo.works.getImage(params.id);
  return ok(res, { ...w, img: img || undefined, hasImage: !!img });
});

// Publish + SERVER-SIDE seal. The server hashes the received bytes and signs
// them with the SecurityArts key — the client never signs the authoritative seal.
// Signed-in users only (audit HIGH #3): a seal names its owner, and anonymous
// uploads were an unmetered write path into our storage bucket.
router.post("/api/works", async ({ res, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to seal a work.");
  if (!(await rateLimit(`pub:${ip}`, 20, 60000, CRITICAL))) return fail(res, 429, "Slow down a moment.");
  const title = str(body.title, { min: 1, max: 80 });
  const artist = str(body.artist, { min: 1, max: 60 });
  const cat = CATS.includes(body.cat) ? body.cat : null;
  if (!title || !artist || !cat) return fail(res, 400, "title, artist, a valid medium, and an image are required.");
  // Magic-byte intake: PNG / JPEG / WebP only, the declared MIME is ignored, SVG is
  // rejected outright (it's XML and can script). ~8MB of data URI ≈ 6MB of pixels.
  const img = decodeImageDataUri(body.image, { maxBytes: 6_000_000 });
  if (!img) return fail(res, 400, "Upload a PNG, JPEG, or WebP image under 6MB.");
  // v1 cert: { v:1, kid, hash, sig, signer, algo, ts } — the signature covers kid+hash+ts
  // (lib/seal.mjs). Async so a KMS-backed signer slots in without touching this route.
  const cert = await seal(img.bytes);
  // Identical image bytes → identical seal hash → already sealed (works.hash is UNIQUE).
  // Check up front so we don't upload/store a doomed duplicate, and return a clean 409.
  if (await repo.works.findByHash(cert.hash)) return fail(res, 409, "This exact image has already been sealed.");
  // Per-user daily quota, counted only for a genuinely new seal (re-sending the same
  // image, or a rejected upload, doesn't spend it).
  if (!(await rateLimit(`seal:${user.id}`, SEAL_DAILY_QUOTA, DAY_MS, CRITICAL))) return fail(res, 429, `Daily sealing limit reached (${SEAL_DAILY_QUOTA} per day). Try again tomorrow.`);
  const id = "u_" + crypto.randomUUID().slice(0, 12);
  // No `price`: a seal is provenance, not a listing. (Sealing used to attach a
  // synthetic price to every work — audit §0 fabricated content.)
  const meta = { id, own: true, title, artist, cat, medium: MEDIUM[cat], cert, ownerId: user.id, createdAt: cert.ts };
  // Prefer object storage + CDN (Supabase Storage) when configured; on any upload
  // failure fall back to the repo driver's blob store so publish never breaks.
  const imgUrl = blobStoreActive ? await putImage(id, img) : null;
  if (imgUrl) meta.imgUrl = imgUrl;
  try {
    await repo.works.create(meta, imgUrl ? null : img.dataUri); // blob out of the hot path
  } catch (e) {
    if (e && e.code === "DUP_SEAL") return fail(res, 409, "This exact image has already been sealed."); // race backstop
    throw e;
  }
  audit("work.publish", { workId: id, hash: cert.hash, ownerId: meta.ownerId, type: img.type, storage: imgUrl ? "supabase" : "db", ip });
  return created(res, { ...meta, img: imgUrl || img.dataUri });
});

// Owner-only delete. "Not yours" answers exactly like "doesn't exist" so the route
// can't be used to probe which ids are real. Admin takedown is a separate, future
// concern (no admin role exists yet).
router.del("/api/works/:id", async ({ res, params, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in first.");
  const removed = await repo.works.remove(params.id, user.id);
  if (!removed) return fail(res, 404, "Work not found.");
  if (removed.imgUrl) deleteImage(removed.imgUrl).catch(() => {}); // best-effort CDN cleanup
  audit("work.delete", { workId: params.id, ownerId: user.id, ip });
  return ok(res, { deleted: true });
});

// Public provenance check — the whole point of the brand.
// Hashes are stored lowercase; the lookup is case-sensitive in both drivers, so
// normalize first. A malformed hash answers exactly like an unknown one (no format
// oracle). `kid`/`signer` come from the registry entry that was matched — the
// record's own `signer` field is unsigned in v0 and is never echoed unchecked.
router.get("/api/verify/:hash", async ({ res, params }) => {
  const hash = String(params.hash || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return fail(res, 404, "No sealed work found for that hash.");
  const work = await repo.works.findByHash(hash);
  if (!work) return fail(res, 404, "No sealed work found for that hash.");
  const r = verifySeal(work.cert);
  return ok(res, {
    verified: r.verified, v: r.v, kid: r.kid, signer: r.signer, alg: r.alg,
    sealedAt: work.cert.ts, signedFields: r.signedFields, hash,
    ...(r.verified ? {} : { reason: r.reason }),
    work: { id: work.id, title: work.title, artist: work.artist, medium: work.medium },
  });
});

/* ---- boards (auth required) ---------------------------------------- */
function requireUser(ctx) { if (!ctx.user) { fail(ctx.res, 401, "Sign in to use boards."); return false; } return true; }
router.get("/api/boards", async (ctx) => { if (!requireUser(ctx)) return; ok(ctx.res, await repo.boards.listByUser(ctx.user.id)); });
router.post("/api/boards", async (ctx) => {
  if (!requireUser(ctx)) return;
  const name = str(ctx.body.name, { min: 1, max: 40 });
  if (!name) return fail(ctx.res, 400, "A board name is required.");
  const board = { id: "brd_" + crypto.randomUUID().slice(0, 10), userId: ctx.user.id, name, pins: [] };
  await repo.boards.create(board);
  return created(ctx.res, board);
});
router.del("/api/boards/:id", async (ctx) => {
  if (!requireUser(ctx)) return;
  const removed = await repo.boards.remove(ctx.user.id, ctx.params.id);
  if (!removed) return fail(ctx.res, 404, "Board not found.");
  return ok(ctx.res, { deleted: true });
});
router.post("/api/boards/:id/pins", async (ctx) => {
  if (!requireUser(ctx)) return;
  const workId = str(ctx.body.workId, { min: 1, max: 60 });
  if (!workId) return fail(ctx.res, 400, "workId is required.");
  const result = await repo.boards.togglePin(ctx.user.id, ctx.params.id, workId);
  if (!result) return fail(ctx.res, 404, "Board not found.");
  return ok(ctx.res, result);
});

/* ---- comments ------------------------------------------------------- */
// Public shape — never leaks the full liker list, just whether the viewer liked it.
function publicComment(c, viewerId) {
  return {
    id: c.id, workId: c.workId, userId: c.userId, authorName: c.authorName,
    text: c.text, parentId: c.parentId || null, likes: c.likes || 0, createdAt: c.createdAt,
    likedByMe: !!(viewerId && (c.likedBy || []).includes(viewerId)),
  };
}

// Writes that hang rows off a work id must reference a work that exists (finding 16):
// otherwise any string is a bucket an anonymous caller can grow without bound.
async function workExists(id) { return !!(await repo.works.findById(id)); }

router.get("/api/works/:id/comments", async ({ res, params, user }) => {
  const list = await repo.comments.listByWork(params.id);
  const viewerId = user ? user.id : null;
  return ok(res, list.map((c) => publicComment(c, viewerId)));
});

router.post("/api/works/:id/comments", async ({ res, params, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to comment.");
  if (!(await rateLimit(`cmt:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  if (!(await workExists(params.id))) return fail(res, 404, "Work not found.");
  const text = str(body.text, { min: 1, max: 500 });
  if (!text) return fail(res, 400, "Say something first (1–500 characters).");
  let parentId = null;
  if (body.parentId) {
    // A reply must target an existing top-level comment on the same work (no reply chains).
    const parent = await repo.comments.findById(str(body.parentId, { max: 60 }) || "");
    if (!parent || parent.workId !== params.id || parent.parentId) return fail(res, 400, "Can't reply to that comment.");
    parentId = parent.id;
  }
  const comment = {
    id: "cmt_" + crypto.randomUUID().slice(0, 12),
    workId: params.id, userId: user.id, authorName: user.name || "Member",
    text, parentId, likes: 0, likedBy: [], createdAt: new Date().toISOString(),
  };
  await repo.comments.create(comment);
  audit("comment.create", { commentId: comment.id, workId: params.id, userId: user.id, ip });
  return created(res, publicComment(comment, user.id));
});

router.post("/api/comments/:id/like", async ({ res, params, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to like comments.");
  if (!(await rateLimit(`clike:${ip}`, 60, 60000))) return fail(res, 429, "Slow down a moment.");
  const result = await repo.comments.toggleLike(params.id, user.id);
  if (!result) return fail(res, 404, "Comment not found.");
  return ok(res, { likes: result.likes, likedByMe: result.liked });
});

router.del("/api/comments/:id", async ({ res, params, user }) => {
  if (!user) return fail(res, 401, "Sign in first.");
  const removed = await repo.comments.remove(params.id, user.id);
  if (!removed) return fail(res, 404, "Comment not found or not yours.");
  return ok(res, { deleted: true, removed });
});

/* ---- creator hub / analytics --------------------------------------- */
// Count a view when a work's detail is opened. Anonymous-friendly; excess is dropped
// (a beacon should never error the page). The client de-dupes per session.
router.post("/api/works/:id/view", async ({ res, params, ip }) => {
  if (!(await rateLimit(`view:${ip}`, 120, 60000))) return ok(res, { views: null });
  if (!(await workExists(params.id))) return fail(res, 404, "Work not found.");
  const views = await repo.stats.incrementView(params.id);
  return ok(res, { views });
});

// Work-level likes (the public "❤ 998" signal). Read is public + session-aware.
router.get("/api/works/:id/likes", async ({ res, params, user }) => {
  const [counts, likedByMe] = await Promise.all([
    repo.likes.countByWorks([params.id]),
    user ? repo.likes.likedBy(params.id, user.id) : Promise.resolve(false),
  ]);
  return ok(res, { likes: counts[params.id] || 0, likedByMe });
});
router.post("/api/works/:id/like", async ({ res, params, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to like a work.");
  if (!(await rateLimit(`wlike:${ip}`, 60, 60000))) return fail(res, 429, "Slow down a moment.");
  if (!(await workExists(params.id))) return fail(res, 404, "Work not found.");
  const r = await repo.likes.toggle(params.id, user.id);
  return ok(res, { likes: r.likes, likedByMe: r.liked });
});

// Analytics for the signed-in creator: their works with real views + comment counts,
// ranked by engagement, plus totals.
router.get("/api/me/stats", async ({ res, user }) => {
  if (!user) return fail(res, 401, "Sign in to see your analytics.");
  const works = await repo.works.listByOwner(user.id);
  const ids = works.map((w) => w.id);
  const [views, comments, likes] = await Promise.all([
    repo.stats.viewsFor(ids), repo.comments.countByWorks(ids), repo.likes.countByWorks(ids),
  ]);
  const items = works.map((w) => ({
    id: w.id, title: w.title, cat: w.cat, createdAt: w.createdAt,
    views: views[w.id] || 0, comments: comments[w.id] || 0, likes: likes[w.id] || 0,
  }));
  // rank by engagement — likes and comments weigh more than a raw view
  items.sort((a, b) => (b.views + b.likes * 2 + b.comments * 3) - (a.views + a.likes * 2 + a.comments * 3));
  const totals = items.reduce((t, i) => ({ works: t.works + 1, views: t.views + i.views, comments: t.comments + i.comments, likes: t.likes + i.likes }), { works: 0, views: 0, comments: 0, likes: 0 });
  // Full per-work map (keyed by id) so the studio grid shows correct stats for EVERY
  // work, not just the top 12 returned for the ranked "top posts" table.
  const byId = {};
  items.forEach((i) => { byId[i.id] = { views: i.views, likes: i.likes, comments: i.comments }; });
  return ok(res, { totals, top: items.slice(0, 12), byId });
});

// Sales for the signed-in creator: every PAID purchase line that references one of
// their sealed works, plus gross + earned (90% after the flat 10% marketplace fee).
// Pending (unpaid) orders are excluded by the driver — they are not revenue.
router.get("/api/me/sales", async ({ res, user }) => {
  if (!user) return fail(res, 401, "Sign in to see your sales.");
  const works = await repo.works.listByOwner(user.id);
  const titleById = {}; works.forEach((w) => { titleById[w.id] = w.title; });
  const ids = works.map((w) => w.id);
  const sales = ids.length ? await repo.orders.salesForWorks(ids) : [];
  sales.forEach((s) => { s.title = titleById[s.workId] || "Untitled"; });
  sales.sort((a, b) => new Date(b.date) - new Date(a.date));
  const gross = sales.reduce((t, s) => t + (s.amt || 0), 0);
  const earned = Math.round(gross * 0.9);
  return ok(res, { sales: sales.slice(0, 100), totals: { count: sales.length, gross, earned } });
});

/* ---- checkout / orders --------------------------------------------- */
// Signed-in buyers only (audit HIGH #4): the receipt goes to the ACCOUNT's address —
// never to one typed into the request — so this can't be used as an email relay, and
// every line must be a real sealed work that is actually for sale.
router.post("/api/checkout", async ({ res, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to check out.");
  if (!(await rateLimit(`ck:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : null;
  if (!items || !items.length) return fail(res, 400, "A non-empty cart is required.");
  const lics = ["personal", "commercial", "exclusive"];
  const lines = [];
  for (const it of items) {
    const id = str(it.id, { min: 1, max: 60 });
    const license = lics.includes(it.license) ? it.license : null;
    if (!id || !license) return fail(res, 400, "Malformed cart item.");
    const price = await priceOf(id); // server-authoritative; null = unknown id or not for sale
    const amt = price ? Number(price[license]) : NaN;
    if (!Number.isFinite(amt) || amt <= 0) return fail(res, 400, "That item isn't available for purchase.");
    lines.push({ id, license, price: amt });
  }
  const total = lines.reduce((s, l) => s + l.price, 0);
  const email = user.email;
  const order = {
    id: "SA-" + crypto.randomBytes(9).toString("hex").toUpperCase(), // unguessable (was 3 bytes)
    lines, total, email, name: str(body.name, { max: 80 }) || null,
    userId: user.id,
    // Orders are born "pending". ONLY a verified payment-provider webhook (Stripe
    // signature checked) may flip this to "paid" — nothing in this handler, and
    // nothing reachable from a browser, is allowed to. /api/me/sales counts paid only.
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await repo.orders.create(order);
  audit("order.placed", { orderId: order.id, total, userId: user.id, emailKey: emailKey(email), ip }); // NOTE: real payment (Stripe) goes here
  // Order acknowledgement (Resend when configured; dev-logged otherwise). Best-effort.
  // Line text is built from validated ids + enum licenses + server prices — no free text.
  const receiptLines = lines.map((l) => `  • ${l.id} — ${l.license} license — $${l.price}`).join("\n");
  await sendMail({
    to: email, subject: `Your SecurityArts order · ${order.id}`,
    text: `Thanks for your order.\n\nOrder ${order.id} (pending payment)\n${receiptLines}\n\nTotal: $${total}\n\nEvery piece is sealed and publicly verifiable. Keep this for your records.\n\n— SecurityArts`,
  }).catch(() => {});
  return created(res, { orderId: order.id, total, lines, status: order.status });
});
router.get("/api/orders/:id", async ({ res, params, user }) => {
  const o = await repo.orders.findById(params.id);
  if (!o) return fail(res, 404, "Order not found.");
  // Deny-by-default: only the authenticated owner may read an order. Guest orders
  // (userId=null) are never readable online — the buyer has their emailed receipt.
  // (Previously the guard was skipped when userId was null, exposing buyer PII to anyone.)
  if (!user || user.id !== o.userId) return fail(res, 403, "Not your order.");
  return ok(res, o);
});

/* ---- newsletter ----------------------------------------------------- */
router.post("/api/newsletter", async ({ res, body, ip }) => {
  if (!(await rateLimit(`news:${ip}`, 5, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  if (!isEmail(body.email)) return fail(res, 400, "Enter a valid email address.");
  const email = body.email.trim().toLowerCase();
  const added = await repo.newsletter.add(email, ip);
  if (added) audit("newsletter.subscribe", { emailKey: emailKey(email), ip }); // NOTE: hand off to ESP (double opt-in) here
  return ok(res, { subscribed: true });
});
