// Vercel serverless entry for the SecurityArts API.
//
// NOTE: this entry file's hash is part of Vercel's function build-cache key. Touch it
// (this line) whenever the function must be force-rebuilt even though only imported
// modules (routes.mjs, lib/*.mjs) changed. Rebuild marker: post-review-1 (2026-07-12).
//
// Reuses the SAME router + security stack as the standalone server (server/server.mjs);
// this file is just the serverless adapter — no persistent listener, no cluster. Every
// /api/* request is routed here (catch-all). Static files are served by Vercel's CDN.
//
// Requires (Vercel project env): DB_DRIVER=postgres, DATABASE_URL (Supabase POOLER url,
// port 6543), RATELIMIT_DRIVER=postgres, SESSION_SECRET, SEAL_PRIVATE_KEY_B64,
// SEAL_PUBLIC_KEY_B64, SUPABASE_URL, SUPABASE_SERVICE_KEY, TRUST_PROXY=1. See VERCEL.md.
import { router } from "../server/routes.mjs";
import { initRepo } from "../server/lib/repo.mjs";
import { fail } from "../server/lib/http.mjs";
import { currentUser } from "../server/lib/auth.mjs";
import { setSecurityHeaders, rateLimit, sameOrigin, readBody, audit, clientIp } from "../server/lib/security.mjs";
import { reportError } from "../server/lib/sentry.mjs";

// Memoized across warm invocations of a function instance.
let repoReady = null;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  // Vercel terminates TLS in front of us.
  setSecurityHeaders(res, { https: true });

  const ip = clientIp(req); // TRUST_PROXY=1 → first X-Forwarded-For hop
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  // Vercel's filesystem catch-all ([...path]) only resolves a SINGLE segment on this
  // project (custom outputDirectory), so nested /api/* paths 404 before ever reaching
  // this function. The vercel.json rewrite forwards the real path as ?__path=… — prefer
  // it (and strip it so route handlers see a clean query) when present.
  const forwardedPath = url.searchParams.get("__path");
  if (forwardedPath !== null) url.searchParams.delete("__path");
  const pathname = forwardedPath !== null ? "/api/" + forwardedPath : url.pathname;
  const method = req.method.toUpperCase();

  try {
    if (!repoReady) repoReady = initRepo();
    // Don't cache a FAILED init: if the DB was briefly unreachable (e.g. Supabase
    // free-tier resume), clear the memo so the next request retries and the API
    // self-heals — instead of a warm instance serving 500s until it's recycled.
    try { await repoReady; } catch (e) { repoReady = null; throw e; }

    if (!(await rateLimit(`ip:${ip}`, 240, 60000))) return fail(res, 429, "Rate limit exceeded.");
    if (!sameOrigin(req)) { audit("csrf.block", { ip, pathname }); return fail(res, 403, "Cross-origin request blocked."); }

    const route = router.match(method, pathname);
    if (!route) return fail(res, 404, "No such endpoint.");

    let body = {};
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      if (req.body !== undefined && req.body !== null && req.body !== "") {
        // Vercel already parsed the body (object for JSON, or a raw string).
        if (typeof req.body === "string") {
          try { body = JSON.parse(req.body); } catch { return fail(res, 400, "Invalid JSON body."); }
        } else {
          body = req.body;
        }
      } else {
        // Fall back to reading the raw stream ourselves (matches the standalone server).
        const maxBody = pathname === "/api/works" ? 8_000_000 + 65_536 : undefined;
        const raw = await readBody(req, maxBody);
        if (raw) { try { body = JSON.parse(raw); } catch { return fail(res, 400, "Invalid JSON body."); } }
      }
    }

    const user = await currentUser(req);
    return await route.handler({ req, res, params: route.params, body, url, user, ip, https: true });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      audit("server.error", { ip, pathname, msg: err.message });
      // Server-side only (client still gets the generic message) — surfaces the real
      // cause (e.g. ENOTFOUND on a bad DATABASE_URL, MODULE_NOT_FOUND for pg) in Vercel logs.
      console.error(`[api] ${status} ${pathname} — ${err && (err.stack || err.message)}${err && err.code ? " (code " + err.code + ")" : ""}`);
      // Also report to Sentry when SENTRY_DSN is set (no-op otherwise). Awaited so the
      // event actually flushes before this serverless invocation ends.
      await reportError(err, { pathname, method, ip });
    }
    return fail(res, status, status >= 500 ? "Something went wrong." : err.message);
  }
}
