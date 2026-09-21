// Error reporting to Sentry — dependency-free (raw HTTP to Sentry's store endpoint),
// inert by default. Fits this repo's no-SDK style.
//
// Configure: set SENTRY_DSN (Sentry → Project → Settings → Client Keys (DSN)).
//   e.g. https://<publicKey>@o12345.ingest.sentry.io/67890
// Unconfigured: reportError() is a no-op. Nothing is sent; nothing throws.
import crypto from "node:crypto";

const DSN = process.env.SENTRY_DSN || "";

function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId) return null;
    return {
      publicKey: u.username,
      // Sentry legacy "store" ingest — accepts a plain JSON event, no SDK needed.
      endpoint: `${u.protocol}//${u.host}/api/${projectId}/store/`,
    };
  } catch { return null; }
}

const cfg = DSN ? parseDsn(DSN) : null;
export const sentryActive = Boolean(cfg);

// PII policy (audit MEDIUM #13) — the raw-API equivalent of the SDK's
// `sendDefaultPii: false`: no `user` block (so Sentry can't infer/attach an IP), no
// `request` block (headers/cookies), and the caller-supplied context is stripped of
// `ip` before it lands in `extra`. Only the pathname/method needed to reproduce go out.
const SEND_DEFAULT_PII = false;
const PII_KEYS = new Set(["ip", "email", "cookie", "cookies", "headers", "authorization"]);
function scrub(ctx) {
  if (SEND_DEFAULT_PII) return ctx;
  const out = {};
  for (const [k, v] of Object.entries(ctx || {})) if (!PII_KEYS.has(k)) out[k] = v;
  return out;
}

// Report an error to Sentry. Best-effort and swallow-all — error reporting must never
// throw or block a request's own error handling.
export async function reportError(err, ctx = {}) {
  if (!cfg) return;
  try {
    const safe = scrub(ctx);
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      platform: "node",
      level: "error",
      logger: "securityarts.api",
      server_name: "securityarts-api",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
      release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
      exception: { values: [{ type: (err && err.name) || "Error", value: (err && String(err.message || err)) || "Unknown error" }] },
      tags: { pathname: safe.pathname, method: safe.method, code: err && err.code },
      extra: { stack: err && err.stack, ...safe },
    };
    const auth = `Sentry sentry_version=7, sentry_client=securityarts/1.0, sentry_key=${cfg.publicKey}`;
    await fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2000), // don't let a slow/paused Sentry stall the 5xx response
    });
  } catch { /* never let error reporting throw */ }
}
