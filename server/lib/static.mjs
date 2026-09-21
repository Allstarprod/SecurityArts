// Static-file allowlist for the standalone server (server.mjs).
//
// The repo root is ALSO the site root, so a naive "serve anything under ROOT"
// exposed server/.env, server/data/*.pem, db.json, .git/HEAD, … (audit CRITICAL #1).
// Vercel never had this problem (its CDN serves only what the build emits), but
// Render / Docker / `node server.mjs` run this code directly against the repo.
//
// Policy: deny by default. Only the paths below are reachable; everything else
// (server/, .git/, .github/, .claude/, .remember/, api/, supabase/, scripts/,
// node_modules/, marketing/, "IMAGES & CODES"/, SecurityArts-site/, root *.md,
// root screenshots/zips, any dot-segment) resolves to the same 404 as a missing
// file — so a probe can't even tell "denied" from "absent".
import path from "node:path";

// Files allowed directly at the site root (exact names or patterns).
const ROOT_FILES = new Set(["og-image.png", "robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"]);
const ROOT_HTML = /^[A-Za-z0-9_-][A-Za-z0-9._-]*\.html$/;           // index.html, faq.html, services-*.html …
const ROOT_FAVICON = /^favicon[A-Za-z0-9_.-]*\.(ico|png|svg|webp)$/i; // favicon.ico, favicon-32.png …

// Directory trees allowed in full (the public site's assets + the design-system UI
// kits that vercel.json rewrites point at). Segment arrays, matched as a prefix.
const ROOT_DIRS = [
  ["js"],
  ["SecurityArts Design System", "website"],
  ["docs"], // /docs/seal-spec.md — linked from /api/seal/pubkey
];

// Returns { abs } for a servable path, { status } for a hard rejection, or null
// when the path is outside the allowlist (caller answers with the generic 404).
export function resolvePublicPath(root, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch { return { status: 400 }; } // malformed %-encoding (finding 17) — was an uncaught 500
  if (rel.includes("\0")) return { status: 400 };
  if (rel.endsWith("/")) rel += "index.html";

  const segs = rel.split("/").filter(Boolean);
  if (!segs.length) return null;
  for (const s of segs) {
    // No dot-segments (".", "..", ".env", ".git"), no backslashes (Windows separators
    // would let "js\..\server" slip past a forward-slash-only check).
    if (s.startsWith(".") || s.includes("\\")) return null;
  }

  const allowed =
    (segs.length === 1 && (ROOT_FILES.has(segs[0]) || ROOT_HTML.test(segs[0]) || ROOT_FAVICON.test(segs[0]))) ||
    ROOT_DIRS.some((dir) => dir.length < segs.length && dir.every((d, i) => segs[i] === d));
  if (!allowed) return null;

  const abs = path.join(root, ...segs);
  // Belt and braces: the resolved path must still sit under ROOT (OWASP A01).
  if (!abs.startsWith(root + path.sep)) return null;
  return { abs };
}
