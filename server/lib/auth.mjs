// Authentication: scrypt password hashing + HMAC-signed stateless session cookies.
// Maps to: OWASP A02 (crypto) / A07 (auth) / NIST PR.AC / ISO A.9 / CIS 5,6.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./paths.mjs";
import { repo } from "./repo.mjs";

const SECRET_FILE = path.join(DATA_DIR, "session.secret");
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const COOKIE = "sa_session";

function loadSecret() {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  try {
    return fs.readFileSync(SECRET_FILE);
  } catch {
    const s = crypto.randomBytes(48);
    try {
      ensureDataDir();
      fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
    } catch {
      // Read-only FS (serverless) and no SESSION_SECRET env: ephemeral key for this
      // instance — sessions won't survive redeploys/instances. Set SESSION_SECRET in prod.
      console.warn("auth: no SESSION_SECRET env and disk not writable — using an EPHEMERAL session key. Set SESSION_SECRET in production.");
    }
    return s;
  }
}
const SECRET = loadSecret();

/* ---- Password hashing (scrypt) --------------------------------------- */
// Parameters follow the OWASP Password Storage Cheat Sheet floor (N=2^17, r=8, p=1;
// audit MEDIUM #10 — was N=2^14 and synchronous). Each hash costs 128·N·r ≈ 134 MB
// and ~100–300 ms; the async form keeps that off the event loop. Rate limits bound
// concurrency (per-IP + per-account) so this can't be turned into a memory DoS.
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LEN = 64;
const scrypt = (pw, salt, params) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, KEY_LEN, params, (err, key) => (err ? reject(err) : resolve(key))));

// Stored form: scrypt$N$r$p$saltHex$keyHex. Legacy rows (scrypt$saltHex$keyHex, the
// old N=2^14 default) still verify and are transparently re-hashed on next login.
export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}
function parseHash(stored) {
  const parts = String(stored || "").split("$");
  if (parts[0] !== "scrypt") return null;
  if (parts.length === 6) {
    const [, N, r, p, saltHex, keyHex] = parts;
    const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
    if (![params.N, params.r, params.p].every((n) => Number.isInteger(n) && n > 0)) return null;
    return { params, saltHex, keyHex };
  }
  if (parts.length === 3) return { params: { N: 16384, r: 8, p: 1 }, saltHex: parts[1], keyHex: parts[2], legacy: true };
  return null;
}
export async function verifyPassword(pw, stored) {
  try {
    const h = parseHash(stored);
    if (!h) return false;
    const key = Buffer.from(h.keyHex, "hex");
    const test = await scrypt(pw, Buffer.from(h.saltHex, "hex"), h.params);
    return key.length === test.length && crypto.timingSafeEqual(key, test);
  } catch {
    return false;
  }
}
// True when a stored hash predates the current parameters (re-hash after a
// successful login, while we still have the plaintext).
export function passwordNeedsRehash(stored) {
  const h = parseHash(stored);
  return !h || !!h.legacy || h.params.N !== SCRYPT.N || h.params.r !== SCRYPT.r || h.params.p !== SCRYPT.p;
}
// A well-formed hash that matches nothing, so a login for an unknown email spends
// the same scrypt work as a real one (timing-based user enumeration). Fixed rather
// than generated at boot so cold starts don't pay a 134 MB hash for it.
export const DUMMY_HASH = `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${"00".repeat(16)}$${"00".repeat(KEY_LEN)}`;

/* ---- Stateless signed session token ---------------------------------- */
// Payload { uid, sv, exp }. `sv` is the user's session_version (audit HIGH #5): the
// token is only honoured while it matches the stored value, so bumping the version
// (password reset, logout-everywhere, Google account merge) revokes every
// outstanding cookie without any server-side session table.
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}
export function createSession(user) {
  return sign({ uid: user.id, sv: sessionVersionOf(user), exp: Date.now() + SESSION_TTL });
}
export function sessionVersionOf(user) {
  const v = Number(user?.sessionVersion);
  return Number.isInteger(v) && v > 0 ? v : 1; // rows that predate the column
}
export function readSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    // Tokens minted before session versioning carry no `sv` — reject them (one forced
    // re-login) rather than grandfather in unrevocable sessions.
    if (!Number.isInteger(p.sv)) return null;
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

/* ---- Cookies ---------------------------------------------------------- */
// Over HTTPS the cookie carries every attribute the `__Host-` prefix requires
// (Secure, Path=/, no Domain), so we use the prefixed name: the browser then refuses
// to accept it from a subdomain or an insecure origin (cookie tossing / fixation).
// Over plain HTTP (local dev) the prefix is illegal without Secure, so the bare name
// stays — which is why the name is chosen per request from the `https` flag, and
// why currentUser() only reads the prefixed cookie once https is on.
export function cookieName({ https = false } = {}) { return https ? `__Host-${COOKIE}` : COOKIE; }

export function sessionCookie(token, { https = false } = {}) {
  const parts = [`${cookieName({ https })}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_TTL / 1000}`];
  if (https) parts.push("Secure");
  return parts.join("; ");
}
export function clearCookie({ https = false } = {}) {
  return `${cookieName({ https })}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` + (https ? "; Secure" : "");
}
export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
export async function currentUser(req, { https = false } = {}) {
  const s = readSession(parseCookies(req)[cookieName({ https })]);
  if (!s) return null;
  const user = await repo.users.findById(s.uid);
  if (!user || sessionVersionOf(user) !== s.sv) return null; // revoked (reset / logout-all / merge)
  return user;
}
