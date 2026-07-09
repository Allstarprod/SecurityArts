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
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [, saltHex, keyHex] = stored.split("$");
    const key = Buffer.from(keyHex, "hex");
    const test = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), key.length);
    return key.length === test.length && crypto.timingSafeEqual(key, test);
  } catch {
    return false;
  }
}

/* ---- Stateless signed session token ---------------------------------- */
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}
export function createSession(userId) {
  return sign({ uid: userId, exp: Date.now() + SESSION_TTL });
}
export function readSession(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

export function sessionCookie(token, { https = false } = {}) {
  const parts = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${SESSION_TTL / 1000}`];
  if (https) parts.push("Secure");
  return parts.join("; ");
}
export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > -1) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
export async function currentUser(req) {
  const s = readSession(parseCookies(req)[COOKIE]);
  if (!s) return null;
  return (await repo.users.findById(s.uid)) || null;
}
