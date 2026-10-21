// Clerk sign-in. Clerk owns sign-up, sign-in, email verification, passwords and Google;
// we verify its session token and map each Clerk user onto our own user record (which
// keeps handles, profiles, works, boards). No SDK: the token is an RS256 JWT verified
// with node:crypto (Clerk's documented "manual JWT verification"), and the two Backend
// API calls we need are plain fetches.
//
// Switched on by CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY. While it's on, the legacy
// password/Google routes are closed (routes.mjs) and the legacy session cookie is ignored.
import crypto from "node:crypto";
import { repo } from "./repo.mjs";
import { sendMail } from "./mailer.mjs";

/** The welcome email, sent once an address is proven. Says only what a seal records. */
export const WELCOME_TEXT = (name) =>
  `Hi ${name},\n\nYour SecurityArts account is ready.\n\n` +
  "When you seal a finished piece, you get a public certificate showing that your account sealed that exact file, and when. " +
  "Anyone can check it, no account needed. Change a single pixel and it stops matching, so keep your original file.\n\n" +
  "A seal is a receipt, not a judgement: it can't say who made the art or whether it's original. That part's yours.\n\n— SecurityArts";

const PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || "";
const SECRET_KEY = process.env.CLERK_SECRET_KEY || "";
const JWT_KEY = process.env.CLERK_JWT_KEY || "";            // optional PEM: networkless verification
const API = "https://api.clerk.com/v1";
const CLOCK_SKEW_S = 5;
const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_MIN_REFETCH_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const DEV_ORIGINS = ["http://localhost:4174", "http://127.0.0.1:4174", "http://localhost:8137", "http://127.0.0.1:8137"];

export const clerkEnabled = Boolean(PUBLISHABLE_KEY && SECRET_KEY);
export const clerkPublishableKey = clerkEnabled ? PUBLISHABLE_KEY : null;

/** The Frontend API host is encoded in the publishable key: pk_(test|live)_<base64("host$")>. */
export function frontendApiHost(pk = PUBLISHABLE_KEY) {
  const m = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(pk);
  if (!m) return null;
  try {
    const host = Buffer.from(m[1], "base64").toString("utf8").replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? host : null;
  } catch { return null; }
}
const ISSUER = frontendApiHost() ? `https://${frontendApiHost()}` : null;

// Origins allowed to have minted the token (the `azp` claim).
function authorizedParties() {
  const listed = (process.env.CLERK_AUTHORIZED_PARTIES || process.env.PUBLIC_BASE_URL || "")
    .split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const dev = process.env.NODE_ENV === "production" || process.env.VERCEL ? [] : DEV_ORIGINS;
  return new Set([...listed, ...dev]);
}

/* ---- keys ------------------------------------------------------------ */
let jwks = { keys: new Map(), at: 0 };
async function fetchJwks() {
  const res = await fetch(`${ISSUER}/.well-known/jwks.json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`clerk jwks: HTTP ${res.status}`);
  const body = await res.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    if (jwk.kty === "RSA" && jwk.kid) keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
  }
  jwks = { keys, at: Date.now() };
}
async function publicKeyFor(kid) {
  if (JWT_KEY) return crypto.createPublicKey(JWT_KEY.replace(/\\n/g, "\n"));
  const stale = Date.now() - jwks.at > JWKS_TTL_MS;
  const unknown = !jwks.keys.has(kid) && Date.now() - jwks.at > JWKS_MIN_REFETCH_MS;
  if (stale || unknown) await fetchJwks();
  return jwks.keys.get(kid) || null;
}

/* ---- token ----------------------------------------------------------- */
const b64json = (part) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

/**
 * Verifies a Clerk session token. Returns its claims, or null when it isn't a valid,
 * current token minted for one of our origins.
 * @param {string} token
 * @param {{ now?: number, keyFor?: (kid: string) => Promise<crypto.KeyObject|null>, issuer?: string, parties?: Set<string> }} [opts]  test seams
 */
export async function verifySessionToken(token, opts = {}) {
  if (typeof token !== "string" || token.split(".").length !== 3) return null;
  const [h, p, s] = token.split(".");
  let header, claims;
  try { header = b64json(h); claims = b64json(p); } catch { return null; }
  if (header.alg !== "RS256" || !header.kid) return null;
  let key;
  try { key = await (opts.keyFor || publicKeyFor)(header.kid); } catch { return null; }
  if (!key) return null;
  const valid = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(s, "base64url"));
  if (!valid) return null;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_S < now) return null;
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_S > now) return null;
  const issuer = opts.issuer ?? ISSUER;
  if (!issuer || claims.iss !== issuer) return null;
  const parties = opts.parties ?? authorizedParties();
  if (!claims.azp || !parties.has(claims.azp)) return null;        // must be minted for one of our origins
  if (typeof claims.sub !== "string" || !claims.sub.startsWith("user_")) return null;
  return claims;
}

/** The Clerk session token: Authorization: Bearer … (preferred), else the __session cookie. */
export function tokenFrom(req, cookies) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return cookies.__session || null;
}

/* ---- Backend API ----------------------------------------------------- */
async function clerkApi(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`clerk ${method} ${path}: HTTP ${res.status}`), { status: res.status, body: json });
  return json;
}
export const clerkUsers = {
  get: (id) => clerkApi(`/users/${encodeURIComponent(id)}`),
  setExternalId: (id, externalId) => clerkApi(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: { external_id: externalId } }),
  create: (body) => clerkApi("/users", { method: "POST", body }),
};

/** The primary email of a Clerk user, and whether Clerk has verified it. */
export function primaryEmail(cu) {
  const list = Array.isArray(cu?.email_addresses) ? cu.email_addresses : [];
  const e = list.find((x) => x.id === cu.primary_email_address_id) || list[0];
  return e ? { email: String(e.email_address || "").trim().toLowerCase(), verified: e.verification?.status === "verified" } : null;
}
const displayName = (cu, email) =>
  [cu.first_name, cu.last_name].filter(Boolean).join(" ").trim().slice(0, 80) || cu.username || email.split("@")[0] || "Artist";

/* ---- mapping a Clerk user to our user record --------------------------- */
// Order: already linked (clerkId) → imported (external_id = our id) → same VERIFIED
// email → brand new. An email match is only trusted once Clerk has verified it, so an
// unverified address can never take over an existing account.
export async function linkClerkUser(clerkId, { users = repo.users, api = clerkUsers, welcome = sendWelcome } = {}) {
  const linked = await users.findByClerkId(clerkId);
  if (linked) return linked;

  const cu = await api.get(clerkId);
  if (cu.external_id) {
    const imported = await users.findById(cu.external_id);
    if (imported && !imported.clerkId) return users.update(imported.id, { clerkId, emailVerified: true });
    if (imported?.clerkId === clerkId) return imported;
  }
  const primary = primaryEmail(cu);
  if (!primary?.email || !primary.verified) return null;           // Clerk hasn't verified it yet
  const byEmail = await users.findByEmail(primary.email);
  if (byEmail) {
    if (byEmail.clerkId && byEmail.clerkId !== clerkId) return null; // that account belongs to another Clerk user
    const user = await users.update(byEmail.id, { clerkId, emailVerified: true });
    api.setExternalId(clerkId, user.id).catch(() => {});
    return user;
  }
  try {
    const user = await users.create({
      // `pass` is NOT NULL in the schema; "clerk" is not a scrypt hash, so no password can ever match it.
      id: "usr_" + crypto.randomUUID(), email: primary.email, name: displayName(cu, primary.email), pass: "clerk",
      createdAt: new Date().toISOString(), sessionVersion: 1, emailVerified: true, googleSub: null, clerkId,
    });
    api.setExternalId(clerkId, user.id).catch(() => {});
    welcome(user);                                                   // brand-new accounts only; imports already had one
    return user;
  } catch (e) {
    if (e?.code === "CLERK_ID_TAKEN") return users.findByClerkId(clerkId); // a concurrent first request won
    throw e;
  }
}

function sendWelcome(user) {
  sendMail({ to: user.email, subject: "Welcome to SecurityArts", text: WELCOME_TEXT(user.name) })
    .catch((e) => console.error("clerk: welcome mail failed:", e.message));
}

/** The signed-in user for this request, via Clerk; null when not signed in. */
export async function currentClerkUser(req, cookies) {
  const claims = await verifySessionToken(tokenFrom(req, cookies));
  if (!claims) return null;
  try { return await linkClerkUser(claims.sub); }
  catch (e) { console.error("clerk: couldn't link user", claims.sub, e.message); return null; }
}
