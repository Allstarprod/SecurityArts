// Startup configuration checks — fail fast, before the first request, on settings
// whose absence turns into a silent security hole rather than a crash.
//
// PUBLIC_BASE_URL (audit MEDIUM #12): every link we EMAIL (password reset, email
// verification) is built from it. Without it the server falls back to the request's
// Host header, which an attacker controls — so a poisoned reset link could point at
// their domain (CWE-640). Fine for local dev; never in production.
export function assertProdConfig(env = process.env) {
  if (env.NODE_ENV !== "production") return;
  const base = (env.PUBLIC_BASE_URL || "").trim();
  if (!base) throw new Error("PUBLIC_BASE_URL is required when NODE_ENV=production (e.g. https://security-arts.vercel.app) — see server/DEPLOY.md");
  let u;
  try { u = new URL(base); } catch { u = null; }
  if (!u || u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash) {
    throw new Error(`PUBLIC_BASE_URL must be an https origin with no path (got "${base}")`);
  }
}
