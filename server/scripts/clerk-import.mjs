// Import every existing SecurityArts account into Clerk, once.
//
//   node --env-file=<env file> server/scripts/clerk-import.mjs            # dry run: what WOULD happen
//   node --env-file=<env file> server/scripts/clerk-import.mjs --apply    # do it
//
// Reads accounts from whichever database the env points at (DB_DRIVER / DATABASE_URL),
// creates each one in Clerk with external_id = our user id, then stores Clerk's id on
// our row (users.clerk_id). Safe to re-run: linked accounts are skipped, and an email
// that already exists in Clerk is linked instead of duplicated (if it isn't claimed).
//
// Passwords do NOT carry over: ours are scrypt with a binary salt, a format Clerk can't
// import. Imported people sign in with an emailed code, or set a new password with
// "Forgot password". Unverified accounts are imported the same way — without a
// password, only whoever controls the inbox can get in.
//
// Needs CLERK_SECRET_KEY. Emails are masked in the output; a full report (ids only)
// is written to server/data/.
import fs from "node:fs/promises";
import path from "node:path";
import { initRepo, repo } from "../lib/repo.mjs";
import { DATA_DIR, ensureDataDir } from "../lib/paths.mjs";

const APPLY = process.argv.includes("--apply");
const SECRET = process.env.CLERK_SECRET_KEY || "";
const API = "https://api.clerk.com/v1";
const PAGE = 200;
const GAP_MS = 250;                  // ~4 requests a second, well under Clerk's limits
const MAX_RETRIES = 5;

if (!SECRET) { console.error("CLERK_SECRET_KEY is not set."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (email) => String(email).replace(/^(.)[^@]*(@.*)$/, "$1***$2");

async function clerk(pathname, { method = "GET", body } = {}, attempt = 0) {
  await sleep(GAP_MS);
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const wait = (Number(res.headers.get("retry-after")) || 2 ** attempt) * 1000;
    await sleep(wait);
    return clerk(pathname, { method, body }, attempt + 1);
  }
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts.join(" ") === "Artist") return {};
  return { first_name: parts[0].slice(0, 60), last_name: parts.slice(1).join(" ").slice(0, 60) || undefined };
}

const isEmailTaken = (json) => (json?.errors || []).some((e) => e.code === "form_identifier_exists");

async function importOne(u) {
  const body = {
    external_id: u.id,
    email_address: [u.email],
    ...splitName(u.name),
    skip_password_requirement: true,
    created_at: u.createdAt || undefined,
  };
  const made = await clerk("/users", { method: "POST", body });
  if (made.status === 200 || made.status === 201) {
    await repo.users.update(u.id, { clerkId: made.json.id });
    return { outcome: "created", clerkId: made.json.id };
  }
  if (made.status === 422 && isEmailTaken(made.json)) {
    // Already in Clerk (e.g. they signed up there first): link it if nobody else claimed it.
    const found = await clerk(`/users?email_address=${encodeURIComponent(u.email)}`);
    const existing = Array.isArray(found.json) ? found.json[0] : null;
    if (!existing) return { outcome: "error", detail: "email exists in Clerk but lookup failed" };
    if (existing.external_id && existing.external_id !== u.id) return { outcome: "conflict", detail: "Clerk user already linked to another account", clerkId: existing.id };
    if (!existing.external_id) await clerk(`/users/${existing.id}`, { method: "PATCH", body: { external_id: u.id } });
    await repo.users.update(u.id, { clerkId: existing.id });
    return { outcome: "linked", clerkId: existing.id };
  }
  const reason = (made.json?.errors || []).map((e) => e.code || e.message).join(", ") || `HTTP ${made.status}`;
  return { outcome: "error", detail: reason };
}

async function main() {
  await initRepo();
  console.log(`${APPLY ? "IMPORTING" : "DRY RUN (add --apply to import)"} · database driver: ${repo.driver}`);
  const tally = { created: 0, linked: 0, skipped: 0, conflict: 0, error: 0, planned: 0 };
  const report = [];
  for (let offset = 0; ; offset += PAGE) {
    const batch = await repo.users.listAll({ limit: PAGE, offset });
    if (!batch.length) break;
    for (const u of batch) {
      if (u.clerkId) { tally.skipped++; continue; }
      const flags = [u.emailVerified ? null : "email not verified", u.googleSub ? "Google-linked" : null].filter(Boolean);
      if (!APPLY) {
        tally.planned++;
        console.log(`  would import ${u.id}  ${mask(u.email)}${flags.length ? `  (${flags.join(", ")})` : ""}`);
        continue;
      }
      const r = await importOne(u);
      tally[r.outcome === "created" ? "created" : r.outcome === "linked" ? "linked" : r.outcome]++;
      report.push({ userId: u.id, ...r, flags });
      console.log(`  ${r.outcome.padEnd(8)} ${u.id}  ${mask(u.email)}${r.detail ? `  — ${r.detail}` : ""}`);
    }
  }
  console.log("\nSummary:", JSON.stringify(tally));
  if (APPLY) {
    ensureDataDir();
    const file = path.join(DATA_DIR, `clerk-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.writeFile(file, JSON.stringify({ at: new Date().toISOString(), tally, report }, null, 2));
    console.log(`Report: ${file}`);
  }
  await repo.close?.();
  if (tally.conflict || tally.error) process.exitCode = 2;
}

main().catch((e) => { console.error("Import failed:", e.message); process.exit(1); });
