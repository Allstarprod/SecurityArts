// All API routes. Handlers receive a ctx: { req,res,params,body,user,ip,https }.
// Data access goes through the async `repo` (file or postgres) — never touch a
// concrete store here, so the same routes serve 10 users or 100k.
import crypto from "node:crypto";
import { repo } from "./lib/repo.mjs";
import { putImage, blobStoreActive } from "./lib/blobstore.mjs";
import { seal, verifySeal, publicKeyPem, SIGNER_ID } from "./lib/seal.mjs";
import { Router, ok, created, fail, str, isEmail, CATS } from "./lib/http.mjs";
import {
  hashPassword, verifyPassword, createSession, sessionCookie, clearCookie, parseCookies,
} from "./lib/auth.mjs";
import { rateLimit, audit } from "./lib/security.mjs";
import { sendMail } from "./lib/mailer.mjs";
import { googleConfigured, redirectUri, authUrl, exchangeCode } from "./lib/oauth.mjs";

const LOGIN_PATH = "/SecurityArts Design System/website/ui_kits/discover/";

// Canonical public origin for links we EMAIL out (password resets). Pin it via
// PUBLIC_BASE_URL in production so a spoofed Host header can't point a reset link at
// an attacker domain (host-header / reset poisoning — CWE-640). Falls back to the
// request host for local dev, where no canonical URL is configured.
function publicOrigin(req, https) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return `${https ? "https" : "http"}://${req.headers.host}`;
}

const MEDIUM = {
  illustration: "Digital illustration", painting: "Oil on linen", "3d": "3D render",
  photography: "35mm photograph", lettering: "Hand lettering", concept: "Concept art", mixed: "Mixed media",
};

/* Authoritative pricing — never trust a client-sent price (OWASP A04/A08). */
function priceFor(seed) {
  const base = 60 + (Math.abs(seed) % 11) * 40;
  return { personal: Math.round(base / 5) * 5, commercial: Math.round((base * 3) / 10) * 10, exclusive: Math.round((base * 9) / 25) * 25 };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h; }

// Authoritative prices for the design-system marketplace catalog
// (ui_kits/market/index.html), whose product ids are "m"+i for i = 0..15.
// The client shows base ×1 / ×3 / ×9 with base = 120 + ((i*47)%9)*60 — mirror it
// here so the server records exactly the price the buyer saw. (The root
// marketplace uses "p"+i ids, priced deterministically via the regex below.)
const MARKET = {};
for (let i = 0; i < 16; i++) {
  const base = 120 + ((i * 47) % 9) * 60;
  MARKET["m" + i] = { personal: base, commercial: base * 3, exclusive: base * 9 };
}

async function priceOf(id) {
  const w = await repo.works.findById(id);
  if (w && w.price) return w.price;
  if (MARKET[id]) return MARKET[id];
  const m = /^p(\d+)$/.exec(id);
  return priceFor(m ? Number(m[1]) * 7 + 3 : hashStr(id));
}

// Self view — returned only to the authenticated owner (register / login / me).
// Includes email (their own), their editable profile, and their @handle (stored or,
// until claimed, one derived from their email so the UI always has something to show).
function publicUser(u) { return u ? { id: u.id, email: u.email, name: u.name, handle: u.handle || handleFrom(u.email), handleClaimed: !!u.handle, profile: u.profile || {} } : null; }

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

// A throwaway scrypt hash used to spend equivalent CPU on failed logins for
// unknown emails, so timing can't distinguish "no such user" from "wrong password".
const DUMMY_HASH = hashPassword(crypto.randomBytes(32).toString("hex"));

export const router = new Router();

/* ---- health --------------------------------------------------------- */
router.get("/api/health", ({ res }) => ok(res, { status: "ok", signer: SIGNER_ID, driver: repo.driver }));

// Keep-alive: a trivial real DB read so a free-tier database registers activity and
// doesn't auto-pause. Hit by a daily Vercel cron (see vercel.json). Cheap + public.
router.get("/api/keepalive", async ({ res }) => {
  try { await repo.works.list({ limit: 1 }); return ok(res, { alive: true, ts: new Date().toISOString() }); }
  catch { return ok(res, { alive: false }); }
});
router.get("/api/seal/pubkey", ({ res }) => ok(res, { signer: SIGNER_ID, publicKey: publicKeyPem }));

/* ---- auth ----------------------------------------------------------- */
router.post("/api/auth/register", async ({ res, req, body, ip, https }) => {
  if (!(await rateLimit(`reg:${ip}`, 5, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  const password = str(body.password, { min: 8, max: 200 });
  const name = str(body.name, { min: 1, max: 80 }) || "Artist";
  if (!email || !password) return fail(res, 400, "Valid email and an 8+ character password are required.");
  if (await repo.users.findByEmail(email)) return fail(res, 409, "That email is already registered.");
  const user = { id: "usr_" + crypto.randomUUID(), email, name, pass: hashPassword(password), createdAt: new Date().toISOString() };
  await repo.users.create(user);
  audit("auth.register", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user.id), { https }));
  // Welcome email (Resend when configured; a no-op dev log otherwise). Best-effort —
  // never let a mail hiccup fail the signup.
  await sendMail({
    to: user.email, subject: "Welcome to SecurityArts",
    text: `Hi ${name},\n\nYour SecurityArts account is ready — seal your work to prove it's yours, collect verified human art, and carry provenance with every piece.\n\nOpen your studio: ${publicOrigin(req, https)}\n\n— SecurityArts`,
  }).catch(() => {});
  return created(res, publicUser(user));
});

router.post("/api/auth/login", async ({ res, body, ip, https }) => {
  if (!(await rateLimit(`login:${ip}`, 10, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = String(body.email || "").trim().toLowerCase();
  const user = await repo.users.findByEmail(email);
  // Always run the (deliberately slow) scrypt compare — against a dummy hash when
  // the email is unknown — so response time can't reveal whether an account exists
  // (same message alone isn't enough: skipping scrypt for missing users leaks timing).
  const okPass = verifyPassword(String(body.password || ""), user ? user.pass : DUMMY_HASH);
  if (!user || !okPass) {
    audit("auth.login.fail", { email, ip });
    return fail(res, 401, "Incorrect email or password."); // same message = no user enumeration
  }
  audit("auth.login.ok", { userId: user.id, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(user.id), { https }));
  return ok(res, publicUser(user));
});

router.post("/api/auth/logout", ({ res }) => { res.setHeader("Set-Cookie", clearCookie()); return ok(res, { loggedOut: true }); });
router.get("/api/auth/me", ({ res, user }) => ok(res, publicUser(user)));

// What optional sign-in methods are wired (so the login page shows the right buttons).
router.get("/api/auth/config", ({ res }) => ok(res, {
  google: googleConfigured,
  // Public client-side keys (safe to expose): PostHog project key + host for analytics.
  posthog: process.env.POSTHOG_KEY || null,
  posthogHost: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
}));

/* ---- password reset ------------------------------------------------- */
// Request a reset link. Always returns the same response — never reveals whether an
// account exists (no user enumeration). Delivery is via the mailer (or, unconfigured,
// the link is logged server-side so the flow is usable in dev).
router.post("/api/auth/forgot", async ({ res, req, body, ip, https }) => {
  if (!(await rateLimit(`forgot:${ip}`, 5, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  if (email) {
    const user = await repo.users.findByEmail(email);
    if (user) {
      await repo.passwordResets.removeByUser(user.id); // one active token at a time
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await repo.passwordResets.create({ tokenHash, userId: user.id, expiresAt: Date.now() + 3600_000, createdAt: new Date().toISOString() });
      const link = publicOrigin(req, https) + encodeURI(LOGIN_PATH + "login.html") + "?token=" + token;
      await sendMail({ to: email, subject: "Reset your SecurityArts password", text: `Reset your SecurityArts password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request it, you can ignore this email.` });
      audit("auth.forgot", { userId: user.id, ip });
    } else {
      audit("auth.forgot.unknown", { email, ip });
    }
  }
  return ok(res, { sent: true });
});

// Complete a reset: swap the password for a valid, unexpired token and sign in.
router.post("/api/auth/reset", async ({ res, body, ip, https }) => {
  if (!(await rateLimit(`reset:${ip}`, 10, 60000))) return fail(res, 429, "Too many attempts. Try again shortly.");
  const token = str(body.token, { min: 32, max: 200 });
  const password = str(body.password, { min: 8, max: 200 });
  if (!token || !password) return fail(res, 400, "A valid reset link and an 8+ character password are required.");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const rec = await repo.passwordResets.findByHash(tokenHash);
  if (!rec || rec.expiresAt < Date.now()) {
    if (rec) await repo.passwordResets.consume(tokenHash); // clear an expired one
    return fail(res, 400, "This reset link is invalid or has expired.");
  }
  await repo.users.update(rec.userId, { pass: hashPassword(password) });
  await repo.passwordResets.removeByUser(rec.userId); // single-use: kill all their tokens
  audit("auth.reset", { userId: rec.userId, ip });
  res.setHeader("Set-Cookie", sessionCookie(createSession(rec.userId), { https })); // sign in
  return ok(res, publicUser(await repo.users.findById(rec.userId)));
});

/* ---- Google OAuth --------------------------------------------------- */
// Kick off the flow: set a signed-state cookie (CSRF) and bounce to Google.
router.get("/api/auth/google", ({ res, req, https }) => {
  if (!googleConfigured) return fail(res, 503, "Google sign-in isn't configured.");
  const state = crypto.randomBytes(16).toString("hex");
  const cookie = [`sa_oauth=${state}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=600"];
  if (https) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
  res.writeHead(302, { Location: authUrl({ state, redirect: redirectUri(req, https) }) });
  res.end();
});

// Google redirects back here with ?code&state. Verify state, exchange the code, then
// find-or-create the user (matched by email) and drop them into the app signed in.
router.get("/api/auth/google/callback", async ({ res, req, url, ip, https }) => {
  if (!googleConfigured) return fail(res, 503, "Google sign-in isn't configured.");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== parseCookies(req).sa_oauth) { audit("auth.google.badstate", { ip }); return fail(res, 400, "Sign-in couldn't be verified. Please try again."); }
  let profile;
  try { profile = await exchangeCode({ code, redirect: redirectUri(req, https) }); }
  catch (e) { audit("auth.google.exchangefail", { ip, msg: e.message }); return fail(res, 502, "Google sign-in failed. Please try again."); }
  // Only trust a Google email we KNOW is verified — otherwise an unverified id_token
  // claim could be used to link to (or pre-create) an account for an email the caller
  // doesn't own. exchangeCode already surfaces email_verified as profile.emailVerified.
  if (!profile.emailVerified) { audit("auth.google.unverified", { ip, email: profile.email }); return fail(res, 403, "Your Google account's email isn't verified."); }
  let user = await repo.users.findByEmail(profile.email);
  const isNew = !user;
  if (isNew) {
    // Passwordless account (unusable random hash); they'll keep using Google.
    user = { id: "usr_" + crypto.randomUUID(), email: profile.email, name: profile.name || "Artist", pass: hashPassword(crypto.randomBytes(24).toString("hex")), createdAt: new Date().toISOString() };
    await repo.users.create(user);
    audit("auth.google.register", { userId: user.id, ip });
  } else {
    audit("auth.google.login", { userId: user.id, ip });
  }
  const clearState = "sa_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (https ? "; Secure" : "");
  res.setHeader("Set-Cookie", [sessionCookie(createSession(user.id), { https }), clearState]);
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
// the heavy image payload only travels when the banner actually changes.
router.post("/api/profile/banner", async ({ res, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to edit your profile.");
  if (!(await rateLimit(`banner:${ip}`, 12, 60000))) return fail(res, 429, "Slow down a moment.");
  const profile = { ...(user.profile || {}) };
  if (body.remove === true) {
    profile.bannerUrl = "";
  } else {
    const image = typeof body.image === "string" && /^data:image\//.test(body.image) && body.image.length < 3_000_000 ? body.image : null;
    if (!image) return fail(res, 400, "Upload a JPG or PNG under ~2MB.");
    const url = blobStoreActive ? await putImage("banner_" + user.id, image) : image;
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
router.post("/api/works", async ({ res, body, user, ip }) => {
  if (!(await rateLimit(`pub:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  const title = str(body.title, { min: 1, max: 80 });
  const artist = str(body.artist, { min: 1, max: 60 });
  const cat = CATS.includes(body.cat) ? body.cat : null;
  const image = typeof body.image === "string" && body.image.length < 8_000_000 ? body.image : null;
  if (!title || !artist || !cat || !image) return fail(res, 400, "title, artist, a valid medium, and an image are required.");
  const cert = seal(image);
  // Identical image bytes → identical seal hash → already sealed (works.hash is UNIQUE).
  // Check up front so we don't upload/store a doomed duplicate, and return a clean 409.
  if (await repo.works.findByHash(cert.hash)) return fail(res, 409, "This exact image has already been sealed.");
  const id = "u_" + crypto.randomUUID().slice(0, 12);
  const meta = {
    id, own: true, title, artist, cat, medium: MEDIUM[cat],
    price: priceFor(hashStr(id)), cert, ownerId: user ? user.id : null, createdAt: cert.ts,
  };
  // Prefer object storage + CDN (Supabase Storage) when configured; on any upload
  // failure fall back to the repo driver's blob store so publish never breaks.
  const imgUrl = blobStoreActive ? await putImage(id, image) : null;
  if (imgUrl) meta.imgUrl = imgUrl;
  try {
    await repo.works.create(meta, imgUrl ? null : image); // blob out of the hot path
  } catch (e) {
    if (e && e.code === "DUP_SEAL") return fail(res, 409, "This exact image has already been sealed."); // race backstop
    throw e;
  }
  audit("work.publish", { workId: id, hash: cert.hash, ownerId: meta.ownerId, storage: imgUrl ? "supabase" : "db", ip });
  return created(res, { ...meta, img: imgUrl || image });
});

// Public provenance check — the whole point of the brand.
router.get("/api/verify/:hash", async ({ res, params }) => {
  const work = await repo.works.findByHash(params.hash);
  if (!work) return fail(res, 404, "No sealed work found for that hash.");
  const valid = verifySeal(work.cert.hash, work.cert.sig);
  return ok(res, { verified: valid, signer: work.cert.signer, sealedAt: work.cert.ts,
    work: { id: work.id, title: work.title, artist: work.artist, medium: work.medium } });
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

router.get("/api/works/:id/comments", async ({ res, params, user }) => {
  const list = await repo.comments.listByWork(params.id);
  const viewerId = user ? user.id : null;
  return ok(res, list.map((c) => publicComment(c, viewerId)));
});

router.post("/api/works/:id/comments", async ({ res, params, body, user, ip }) => {
  if (!user) return fail(res, 401, "Sign in to comment.");
  if (!(await rateLimit(`cmt:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
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

// Sales for the signed-in creator: every purchase line that references one of their
// sealed works, plus gross + earned (90% after the flat 10% marketplace fee).
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
router.post("/api/checkout", async ({ res, body, user, ip }) => {
  if (!(await rateLimit(`ck:${ip}`, 20, 60000))) return fail(res, 429, "Slow down a moment.");
  const items = Array.isArray(body.items) ? body.items.slice(0, 50) : null;
  const email = isEmail(body.email) ? body.email.trim().toLowerCase() : null;
  if (!items || !items.length || !email) return fail(res, 400, "A non-empty cart and a valid email are required.");
  const lics = ["personal", "commercial", "exclusive"];
  const lines = [];
  for (const it of items) {
    const id = str(it.id, { min: 1, max: 60 });
    const license = lics.includes(it.license) ? it.license : null;
    if (!id || !license) return fail(res, 400, "Malformed cart item.");
    lines.push({ id, license, price: (await priceOf(id))[license] }); // server-authoritative price
  }
  const total = lines.reduce((s, l) => s + l.price, 0);
  const order = {
    id: "SA-" + crypto.randomBytes(9).toString("hex").toUpperCase(), // unguessable (was 3 bytes)
    lines, total, email, name: str(body.name, { max: 80 }) || null,
    userId: user ? user.id : null, status: "paid", createdAt: new Date().toISOString(),
  };
  await repo.orders.create(order);
  audit("order.placed", { orderId: order.id, total, email, ip }); // NOTE: real payment (Stripe) goes here
  // Order receipt (Resend when configured; dev-logged otherwise). Best-effort.
  const receiptLines = lines.map((l) => `  • ${l.id} — ${l.license} license — $${l.price}`).join("\n");
  await sendMail({
    to: email, subject: `Your SecurityArts receipt · ${order.id}`,
    text: `Thanks for your purchase.\n\nOrder ${order.id}\n${receiptLines}\n\nTotal: $${total}\n\nEvery piece is sealed and publicly verifiable. Keep this receipt for your records.\n\n— SecurityArts`,
  }).catch(() => {});
  return created(res, { orderId: order.id, total, lines });
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
  if (added) audit("newsletter.subscribe", { email, ip }); // NOTE: hand off to ESP (double opt-in) here
  return ok(res, { subscribed: true });
});
