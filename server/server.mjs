// SecurityArts server — serves the static site AND the API on one port, with
// security headers, rate limiting, and a same-origin CSRF guard.
//   Run:  node server.mjs      (then open http://localhost:8137)
//
// Scale knobs (env):
//   DB_DRIVER=file|postgres     storage backend (default: postgres if DATABASE_URL set, else file)
//   DATABASE_URL=...            Supabase/Postgres connection string
//   RATELIMIT_DRIVER=memory|postgres   shared limiter for multi-instance
//   CLUSTER=max|<N>            run N worker processes (needs postgres driver)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cluster from "node:cluster";
import { fileURLToPath } from "node:url";
import { router } from "./routes.mjs";
import { initRepo, repo } from "./lib/repo.mjs";
import { fail } from "./lib/http.mjs";
import { currentUser } from "./lib/auth.mjs";
import { setSecurityHeaders, rateLimit, sameOrigin, readBody, audit, clientIp } from "./lib/security.mjs";
import { reportError } from "./lib/sentry.mjs";
import { resolvePublicPath } from "./lib/static.mjs";
import { assertProdConfig } from "./lib/config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".."); // static site root == repo root (see lib/static.mjs for why that needs an allowlist)
const PORT = Number(process.env.PORT) || 8137;
const HTTPS = process.env.TRUST_PROXY_HTTPS === "1"; // set behind a TLS terminator

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".map": "application/json",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
};

// SPA-ish fallback: unknown non-API path → home, with a 404 status. ALSO the answer
// for every path outside the allowlist, so "denied" and "absent" are indistinguishable.
function notFound(res) {
  fs.readFile(path.join(ROOT, "index.html"), (err, buf) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); res.end(buf);
  });
}

function serveStatic(req, res, pathname) {
  // Allowlist + traversal guard (OWASP A01; audit CRITICAL #1). Only the public
  // site is reachable — never server/, .git/, .env, data/, docs, screenshots…
  const r = resolvePublicPath(ROOT, pathname);
  if (r && r.status) { res.writeHead(r.status).end(r.status === 400 ? "Bad request" : "Forbidden"); return; }
  if (!r) return notFound(res);
  fs.stat(r.abs, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const type = TYPES[path.extname(r.abs).toLowerCase()] || "application/octet-stream";
    const cache = /\.(png|jpe?g|webp|svg|woff2|ico)$/i.test(r.abs) ? "public, max-age=86400" : "no-cache";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
    fs.createReadStream(r.abs).pipe(res);
  });
}

async function handler(req, res) {
  setSecurityHeaders(res, { https: HTTPS });
  const ip = clientIp(req);
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  try {
    if (pathname.startsWith("/api/")) {
      // global + mutation guards
      if (!(await rateLimit(`ip:${ip}`, 240, 60000))) return fail(res, 429, "Rate limit exceeded.");
      if (!sameOrigin(req)) { audit("csrf.block", { ip, pathname }); return fail(res, 403, "Cross-origin request blocked."); }

      const route = router.match(req.method.toUpperCase(), pathname);
      if (!route) return fail(res, 404, "No such endpoint.");

      let body = {};
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
        // /api/works accepts an image up to ~8MB (routes.mjs), so give that route a
        // matching transport cap — otherwise a valid large image is 413'd before the
        // handler ever validates it. Every other route keeps the tighter default.
        const maxBody = pathname === "/api/works" ? 8_000_000 + 65_536 : undefined;
        const raw = await readBody(req, maxBody);
        if (raw) { try { body = JSON.parse(raw); } catch { return fail(res, 400, "Invalid JSON body."); } }
      }
      const user = await currentUser(req, { https: HTTPS }); // https picks the __Host- cookie name
      return await route.handler({ req, res, params: route.params, body, url, user, ip, https: HTTPS });
    }
    // Vanity handle URLs: /@name → the public profile page for that handle.
    const vanity = /^\/@([a-zA-Z0-9_]{1,30})$/.exec(pathname);
    if (vanity && req.method === "GET") {
      const dest = "/SecurityArts Design System/website/ui_kits/discover/profile.html?h=" + vanity[1].toLowerCase();
      res.writeHead(302, { Location: encodeURI(dest) });
      res.end();
      return;
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) { audit("server.error", { ip, pathname, msg: err.message }); reportError(err, { pathname, method: req.method, ip }).catch(() => {}); }
    // Never leak internals to the client (OWASP A05 / info exposure).
    fail(res, status, status >= 500 ? "Something went wrong." : err.message);
  }
}

function workerCount() {
  const v = (process.env.CLUSTER || "").toLowerCase();
  if (["max", "true", "all"].includes(v)) return os.cpus().length;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? Math.min(n, os.cpus().length) : 1;
}

async function start() {
  assertProdConfig(); // refuse to boot a production process without PUBLIC_BASE_URL (CWE-640)
  await initRepo(); // connect DB / load store before we accept traffic
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`SecurityArts server → http://localhost:${PORT}  [pid ${process.pid}, driver ${repo.driver}]`);
  });
  const shutdown = (sig) => {
    console.log(`\n${sig} — draining connections…`);
    server.close(async () => { try { await repo.close(); } catch {} process.exit(0); });
    setTimeout(() => process.exit(0), 10_000).unref?.(); // hard stop if drain hangs
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

const workers = workerCount();
if (cluster.isPrimary && workers > 1) {
  if (repo.driver === "file") {
    // The file driver can't be shared across processes without corrupting db.json.
    console.warn("⚠ CLUSTER requested but DB_DRIVER=file is single-process only — running one process. Use DB_DRIVER=postgres to cluster.");
    start();
  } else {
    if ((process.env.RATELIMIT_DRIVER || "memory") === "memory")
      console.warn("⚠ clustering with the in-memory rate limiter — limits are per-worker. Set RATELIMIT_DRIVER=postgres for shared limits.");
    console.log(`SecurityArts primary [pid ${process.pid}] → forking ${workers} workers`);
    for (let i = 0; i < workers; i++) cluster.fork();
    cluster.on("exit", (w, code) => { console.warn(`worker ${w.process.pid} exited (${code}) — restarting`); cluster.fork(); });
  }
} else {
  start();
}
