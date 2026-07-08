// Security middleware primitives — all hand-rolled, no dependencies.
// Maps to: OWASP A05 (misconfig) / A04 (design) / NIST PR.DS & DE.CM / CIS 4,8.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./paths.mjs";

// Shared, pluggable rate limiter (memory or postgres) lives in its own module now.
export { rateLimit } from "./ratelimit.mjs";

const AUDIT_FILE = path.join(DATA_DIR, "audit.log");
ensureDataDir(); // so the first audit append never races a missing dir

/* ---- Security headers (CSP + hardening) ------------------------------ */
// Pragmatic CSP: the static pages inline their <style>/<script>, so script/style
// allow 'unsafe-inline' for now. Hardening path (externalize JS → nonce CSP) is
// tracked in COMPLIANCE.md. img/font/connect are locked to self + fonts + data.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function setSecurityHeaders(res, { https = false } = {}) {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (https) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
}

/* ---- Same-origin (CSRF) guard for state-changing requests ------------ */
// Maps to: OWASP A01 / CSRF. Rejects cross-site mutation attempts.
export function sameOrigin(req) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin) return true; // same-origin form posts may omit Origin; header check below still applies
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ---- Body reader with hard size cap ---------------------------------- */
// Maps to: OWASP A03 (injection surface) / DoS protection.
export function readBody(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (tooLarge) {
        // Already over the cap: keep draining (and discarding) so the client can
        // finish sending and actually receive our 413 instead of a connection reset.
        // Bound the drain to 2× the cap so a malicious huge upload can't be read
        // indefinitely — past that we cut the socket.
        if (size > maxBytes * 2) req.destroy();
        return;
      }
      if (size > maxBytes) {
        // Stop buffering and reject so the caller can send a clean 413. We do NOT
        // destroy here — the drain above keeps the socket alive long enough for the
        // response to reach the client.
        tooLarge = true;
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => { if (!tooLarge) resolve(Buffer.concat(chunks).toString("utf8")); });
    req.on("error", reject);
  });
}

/* ---- Audit log (JSON lines) ------------------------------------------ */
// Maps to: NIST DE.CM / SOC 2 CC7 / ISO A.12.4 (logging & monitoring).
export function audit(event, data = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + "\n";
  fs.appendFile(AUDIT_FILE, line, () => {});
}

// X-Forwarded-For is fully client-controlled, so honoring it on a directly-exposed
// server lets any client spoof its IP and defeat every per-IP rate limit + poison
// the audit log (OWASP A04). Only trust it when we sit behind a proxy we operate,
// gated by TRUST_PROXY — mirroring the TRUST_PROXY_HTTPS switch in server.mjs.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/; // plausible IPv4/IPv6
export function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      const first = String(xff).split(",")[0].trim();
      if (IP_RE.test(first)) return first;
    }
  }
  return (req.socket.remoteAddress || "").trim();
}
