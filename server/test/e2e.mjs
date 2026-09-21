// End-to-end suite — works against EITHER driver. Boots nothing itself: point it
// at a running server.  Usage:
//   node server.mjs                      (terminal 1 — file driver)
//   node test/e2e.mjs                    (terminal 2)
// or against Supabase:
//   node --env-file=.env server.mjs      (terminal 1)
//   node test/e2e.mjs                    (terminal 2)
// Env: PORT (default 8137), EXPECT_DRIVER=file|postgres (optional strict check),
//      E2E_SEAL_QUOTA=<n> (only when the server runs with SEAL_DAILY_QUOTA=<n>: proves the quota).
//
// Every run uses a fresh random image + random email, so re-runs never collide on the
// UNIQUE seal hash (finding 20). The lockout section at the end deliberately burns 11
// login attempts; the per-IP login limiter allows 20/min, so leave a minute between
// back-to-back runs against the same server (or restart it).
//
// Flows that need an emailed link (verification, reset) are exercised through the dev
// mailer's outbox (server/data/outbox.log) when this suite runs on the same machine as a
// file-driver server; against a remote/postgres server those checks are skipped.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || "8137";
const O = `http://localhost:${PORT}`;
const EXPECT_DRIVER = process.env.EXPECT_DRIVER || process.argv[2] || ""; // arg form works on Windows npm too
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(HERE, "..", "data");
const OUTBOX = path.join(DATA_DIR, "outbox.log");
const AUDIT = path.join(DATA_DIR, "audit.log");
let pass = 0, fail = 0, cookie = "";
const check = (n, c, got = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${got ? "  (" + got + ")" : ""}`); c ? pass++ : fail++; };
const skip = (n, why) => console.log(`SKIP  ${n}  (${why})`);

async function api(path, { method = "GET", body, origin = O, xff, noCookie = false, cookieOverride, redirect = "follow" } = {}) {
  const h = { "Content-Type": "application/json" };
  if (method !== "GET") h.Origin = origin;
  const c = cookieOverride !== undefined ? cookieOverride : cookie;
  if (c && !noCookie) h.Cookie = c;
  if (xff) h["X-Forwarded-For"] = xff;
  const r = await fetch(`${O}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect });
  const sc = r.headers.get("set-cookie");
  if (sc && cookieOverride === undefined && !noCookie) cookie = sc.split(";")[0];
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, j, headers: r.headers };
}

// A fresh, valid-looking PNG each run: real signature, random body. The server sniffs
// magic bytes only, so this is enough to pass intake and yields a never-seen seal hash.
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngDataUri = (size = 40_000) => "data:image/png;base64," + Buffer.concat([PNG_SIG, crypto.randomBytes(size)]).toString("base64");
const asDataUri = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

// Latest dev-outbox message for an address whose subject matches. null when the
// outbox isn't reachable (postgres / remote server).
function outboxFor(email, subjectRe) {
  if (!fs.existsSync(OUTBOX)) return null;
  const lines = fs.readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const m = JSON.parse(lines[i]); if (m.to === email && subjectRe.test(m.subject)) return m; } catch {}
  }
  return null;
}

const main = async () => {
  const health = await api("/api/health");
  const driver = health.j?.data?.driver;
  check("health", health.status === 200 && !!driver, `driver=${driver}`);
  if (EXPECT_DRIVER) check(`driver is ${EXPECT_DRIVER}`, driver === EXPECT_DRIVER, driver);
  const local = driver === "file" && fs.existsSync(DATA_DIR);

  /* ---- CRITICAL #1: static allowlist + finding 17 ---------------------- */
  for (const p of ["/server/.env", "/server/data/seal-key.pem", "/server/data/db.json", "/.git/HEAD", "/.env", "/package.json", "/.claude/project-context.md",
    "/api/%5B...path%5D.mjs", "/supabase/migrations/20260708192811_securityarts_initial_schema.sql", "/HANDOFF.md", "/SecurityArts-site.zip", "/js/../server/.env"]) {
    const r = await fetch(`${O}${p}`);
    const text = await r.text();
    check(`static denied: ${p} → 404`, r.status === 404 && !/DATABASE_URL|PRIVATE KEY|ref: refs/.test(text), `HTTP ${r.status}`);
  }
  for (const p of ["/", "/index.html", "/js/api.js", "/robots.txt", "/SecurityArts%20Design%20System/website/ui_kits/discover/"]) {
    const r = await fetch(`${O}${p}`);
    check(`static allowed: ${p} → 200`, r.status === 200, `HTTP ${r.status}`);
  }
  const bad = await fetch(`${O}/%E0%A4%A`);
  check("malformed %-encoding → 400 (was 500)", bad.status === 400, `HTTP ${bad.status}`);
  const home = await fetch(`${O}/`);
  const csp = home.headers.get("content-security-policy") || "";
  check("CSP: img-src pinned to project CDN, no *.supabase.co, none in connect-src",
    /img-src[^;]*https:\/\/ixdkfakibuctwhgwngsw\.supabase\.co/.test(csp) && !/\*\.supabase\.co/.test(csp) && !/connect-src[^;]*supabase/.test(csp));

  /* ---- auth round-trip + HIGH #7 verification ------------------------- */
  const email = `e2e_${crypto.randomUUID().slice(0, 8)}@x.com`;
  const reg = await api("/api/auth/register", { method: "POST", body: { email, password: "supersecret1", name: "E2E" } });
  check("register", reg.status === 201 && reg.j?.data?.email === email, `HTTP ${reg.status}`);
  check("register: account starts unverified", reg.j?.data?.emailVerified === false);
  check("cookie name matches transport (plain http → sa_session, https → __Host-sa_session)", cookie.startsWith("sa_session="), cookie.split("=")[0]);
  const me = await api("/api/auth/me");
  check("session → /me", me.status === 200 && me.j?.data?.email === email);
  const badVerify = await api("/api/auth/verify-email?token=" + "0".repeat(64), { redirect: "manual" });
  check("verify-email: bogus token → redirect ?verified=0", badVerify.status === 302 && /verified=0/.test(badVerify.headers.get("location") || ""), `HTTP ${badVerify.status}`);
  if (local) {
    const mail = outboxFor(email, /verify/i);
    const token = mail && /token=([0-9a-f]{64})/.exec(mail.text)?.[1];
    check("register: verification link emailed (dev outbox), no welcome mail yet", !!token && !outboxFor(email, /welcome/i));
    const welcomeBefore = !!outboxFor(email, /welcome/i);
    const v = await api(`/api/auth/verify-email?token=${token}`, { redirect: "manual", noCookie: true });
    check("verify-email: valid token → redirect ?verified=1", v.status === 302 && /verified=1/.test(v.headers.get("location") || ""), `HTTP ${v.status}`);
    const me2 = await api("/api/auth/me");
    check("verify-email: /me now emailVerified", me2.j?.data?.emailVerified === true);
    check("welcome mail only AFTER verification", !welcomeBefore && !!outboxFor(email, /welcome/i));
    const v2 = await api(`/api/auth/verify-email?token=${token}`, { redirect: "manual", noCookie: true });
    check("verify-email: token is single-use", /verified=0/.test(v2.headers.get("location") || ""));
  } else skip("verification link flow", "needs local file driver outbox");
  const badLogin = await api("/api/auth/login", { method: "POST", body: { email, password: "wrong" } });
  check("wrong password → 401", badLogin.status === 401);
  const login = await api("/api/auth/login", { method: "POST", body: { email, password: "supersecret1" } });
  check("correct login → 200", login.status === 200);
  const sessionA = cookie;

  /* ---- HIGH #3: sealing intake ---------------------------------------- */
  const anon = await api("/api/works", { method: "POST", noCookie: true, body: { title: "Anon", artist: "A", cat: "painting", image: pngDataUri() } });
  check("seal: anonymous → 401", anon.status === 401, `HTTP ${anon.status}`);
  const svg = await api("/api/works", { method: "POST", body: { title: "SVG", artist: "A", cat: "painting", image: "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>") } });
  check("seal: SVG → 400", svg.status === 400, `HTTP ${svg.status}`);
  const html = await api("/api/works", { method: "POST", body: { title: "HTML", artist: "A", cat: "painting", image: asDataUri("image/png", "<html><script>alert(1)</script></html>") } });
  check("seal: HTML bytes labelled image/png → 400", html.status === 400, `HTTP ${html.status}`);
  const spoof = await api("/api/works", { method: "POST", body: { title: "Spoof", artist: "A", cat: "painting", image: asDataUri("image/jpeg", Buffer.concat([PNG_SIG, crypto.randomBytes(2000)])) } });
  const spoofImg = String(spoof.j?.data?.img || "");
  check("seal: MIME comes from bytes (image/jpeg label, PNG bytes → stored as png)", spoof.status === 201 && (spoofImg.startsWith("data:image/png;base64,") || /\.png$/.test(spoofImg)), `HTTP ${spoof.status}`);
  let sealsMade = spoof.status === 201 ? 1 : 0;

  // publish → list → detail → verify
  const image = pngDataUri();
  const pub = await api("/api/works", { method: "POST", body: { title: "E2E Piece", artist: "E2E", cat: "painting", image } });
  const id = pub.j?.data?.id, hash = pub.j?.data?.cert?.hash, imgOut = pub.j?.data?.img || "";
  if (pub.status === 201) sealsMade++;
  check("publish + seal", pub.status === 201 && !!id && !!hash, `id=${id} storage=${imgOut.startsWith("http") ? "supabase-cdn" : "db"}`);
  check("publish: no synthetic price attached", pub.status === 201 && pub.j?.data?.price === undefined);
  check("publish: ownerId is the signed-in user", pub.j?.data?.ownerId === reg.j?.data?.id);
  const dup = await api("/api/works", { method: "POST", body: { title: "Dup", artist: "E2E", cat: "painting", image } });
  check("publish: identical bytes → 409", dup.status === 409, `HTTP ${dup.status}`);
  const list = await api("/api/works?cat=painting&q=e2e");
  const inList = (list.j?.data || []).find((w) => w.id === id);
  check("list (filtered): blob stripped + hasImage", !!inList && inList.img === undefined && inList.hasImage === true);
  const one = await api(`/api/works/${id}`);
  const img = one.j?.data?.img || "";
  check("detail serves image (data: or CDN url)", one.status === 200 && (img.startsWith("data:image/png;base64,") || img.startsWith("http")), img.slice(0, 40));
  const ver = await api(`/api/verify/${hash}`);
  check("verify by hash", ver.status === 200 && ver.j?.data?.verified === true);

  /* ---- HIGH #6 / LOW #14: versioned seal + key registry ------------------ */
  const cert = pub.j?.data?.cert || {};
  check("seal: new certs are v1 with a kid", cert.v === 1 && typeof cert.kid === "string" && cert.kid.startsWith("sa:key:") && cert.signer === cert.kid, `v=${cert.v} kid=${cert.kid}`);
  const vd = ver.j?.data || {};
  check("verify: reports v:1, kid, alg and that ts is signed", vd.v === 1 && vd.kid === cert.kid && vd.signer === cert.kid && vd.alg === "ES256" && Array.isArray(vd.signedFields) && vd.signedFields.includes("ts") && vd.sealedAt === cert.ts && vd.hash === hash, JSON.stringify({ v: vd.v, kid: vd.kid, alg: vd.alg, signedFields: vd.signedFields }));
  const verUpper = await api(`/api/verify/${hash.toUpperCase()}`);
  check("verify: incoming hash is lowercased before lookup", verUpper.status === 200 && verUpper.j?.data?.verified === true && verUpper.j?.data?.hash === hash, `HTTP ${verUpper.status}`);
  const verBad = await api(`/api/verify/${"zz".repeat(32)}`);
  check("verify: non-hex hash → 404 (same answer as unknown)", verBad.status === 404, `HTTP ${verBad.status}`);
  const pk = await api("/api/seal/pubkey");
  const pkd = pk.j?.data || {};
  const active = (pkd.keys || []).find((k) => k.kid === pkd.kid);
  check("pubkey: lists the registry with the active kid that signed this seal", pk.status === 200 && pkd.kid === cert.kid && !!active && active.status === "active" && active.publicKeyPem === pkd.publicKey && (pkd.keys || []).filter((k) => k.status === "active").length === 1, `kid=${pkd.kid} keys=${(pkd.keys || []).length}`);
  check("pubkey: legacy top-level fields + alg + spec + procedure present", pkd.signer === cert.kid && /BEGIN PUBLIC KEY/.test(pkd.publicKey || "") && pkd.alg === "ES256" && pkd.version === 1 && /\/docs\/seal-spec\.md$/.test(pkd.spec || "") && /SA-SEAL-v1/.test(pkd.procedure?.v1?.payload || "") && /SHA-256\(SHA-256/.test(pkd.procedure?.v0?.signature || ""), `spec=${pkd.spec}`);
  check("pubkey: never exposes private key material", !/PRIVATE/.test(JSON.stringify(pkd)));
  // Every already-issued seal must keep verifying: find any v0 record (no `v`) and check it.
  const all = await api("/api/works?limit=1000");
  const legacy = (all.j?.data || []).find((w) => w.cert && w.cert.v === undefined && w.cert.hash && w.cert.sig);
  if (legacy) {
    const v0 = await api(`/api/verify/${legacy.cert.hash}`);
    check("verify: pre-existing v0 seal still verifies (v:0, hash-only signature)", v0.status === 200 && v0.j?.data?.verified === true && v0.j?.data?.v === 0 && v0.j?.data?.kid === legacy.cert.signer && v0.j?.data?.signer === legacy.cert.signer, `work=${legacy.id} ${JSON.stringify({ verified: v0.j?.data?.verified, v: v0.j?.data?.v, reason: v0.j?.data?.reason })}`);
  } else skip("verify: pre-existing v0 seal", "no v0 records in this database");

  // boards
  const board = await api("/api/boards", { method: "POST", body: { name: "E2E Faves" } });
  const bid = board.j?.data?.id;
  check("board create", board.status === 201 && !!bid);
  const pin = await api(`/api/boards/${bid}/pins`, { method: "POST", body: { workId: id } });
  check("togglePin add", pin.status === 200 && pin.j?.data?.saved === true);
  const unpin = await api(`/api/boards/${bid}/pins`, { method: "POST", body: { workId: id } });
  check("togglePin remove", unpin.status === 200 && unpin.j?.data?.saved === false);
  const del = await api(`/api/boards/${bid}`, { method: "DELETE" });
  check("board delete", del.status === 200 && del.j?.data?.deleted === true);

  /* ---- finding 16: engagement rows need a real work ------------------- */
  const ghost = "u_" + crypto.randomUUID().slice(0, 12);
  const gv = await api(`/api/works/${ghost}/view`, { method: "POST", noCookie: true });
  const gl = await api(`/api/works/${ghost}/like`, { method: "POST" });
  const gc = await api(`/api/works/${ghost}/comments`, { method: "POST", body: { text: "hi" } });
  check("view/like/comment on a nonexistent work → 404", gv.status === 404 && gl.status === 404 && gc.status === 404, `${gv.status}/${gl.status}/${gc.status}`);
  const rv = await api(`/api/works/${id}/view`, { method: "POST", noCookie: true });
  const rc = await api(`/api/works/${id}/comments`, { method: "POST", body: { text: "real" } });
  check("view/comment on a real work still work", rv.status === 200 && rv.j?.data?.views >= 1 && rc.status === 201);

  /* ---- HIGH #4: checkout is auth-only, real works only, pending -------- */
  const victim = `victim_${crypto.randomUUID().slice(0, 8)}@example.com`; // unique per run so the audit-log check below is about THIS run
  const ckAnon = await api("/api/checkout", { method: "POST", noCookie: true, body: { email: victim, items: [{ id, license: "personal" }] } });
  check("checkout: anonymous → 401 (no more email relay)", ckAnon.status === 401, `HTTP ${ckAnon.status}`);
  const ckFree = await api("/api/checkout", { method: "POST", body: { items: [{ id: "m0 — see attached invoice http://evil.example", license: "commercial" }] } });
  const ckM0 = await api("/api/checkout", { method: "POST", body: { items: [{ id: "m0", license: "commercial" }] } });
  check("checkout: free-text / catalog ids that aren't sealed works → 400", ckFree.status === 400 && ckM0.status === 400, `${ckFree.status}/${ckM0.status}`);
  const ckUnpriced = await api("/api/checkout", { method: "POST", body: { items: [{ id, license: "personal" }] } });
  check("checkout: sealed work with no price is not purchasable → 400", ckUnpriced.status === 400, `HTTP ${ckUnpriced.status}`);
  const sales = await api("/api/me/sales");
  check("me/sales: nothing pending or fabricated counts as revenue", sales.status === 200 && sales.j?.data?.totals?.count === 0 && sales.j?.data?.totals?.gross === 0);

  // newsletter idempotency
  const n1 = await api("/api/newsletter", { method: "POST", body: { email } });
  const n2 = await api("/api/newsletter", { method: "POST", body: { email } });
  check("newsletter subscribe + idempotent", n1.status === 200 && n2.status === 200);

  // security posture
  const csrf = await api("/api/checkout", { method: "POST", origin: "http://evil.example", body: { items: [{ id, license: "personal" }] } });
  check("CSRF cross-origin blocked", csrf.status === 403, `HTTP ${csrf.status}`);

  /* ---- HIGH #3: owner-only delete -------------------------------------- */
  const emailB = `e2e_${crypto.randomUUID().slice(0, 8)}@x.com`;
  cookie = "";
  const regB = await api("/api/auth/register", { method: "POST", body: { email: emailB, password: "supersecret2", name: "E2E B" } });
  const delOther = await api(`/api/works/${id}`, { method: "DELETE" });
  check("delete: another user → 404 (no ownership oracle)", regB.status === 201 && delOther.status === 404, `HTTP ${delOther.status}`);
  const delAnon = await api(`/api/works/${id}`, { method: "DELETE", noCookie: true });
  check("delete: anonymous → 401", delAnon.status === 401, `HTTP ${delAnon.status}`);
  cookie = sessionA;
  const delOwn = await api(`/api/works/${id}`, { method: "DELETE" });
  const gone = await api(`/api/works/${id}`);
  const verGone = await api(`/api/verify/${hash}`);
  check("delete: owner → 200, work + seal lookup gone", delOwn.status === 200 && gone.status === 404 && verGone.status === 404, `${delOwn.status}/${gone.status}/${verGone.status}`);

  /* ---- HIGH #5: session revocation -------------------------------------- */
  const stale = cookie;
  const la = await api("/api/auth/logout-all", { method: "POST" });
  const meStale = await api("/api/auth/me", { cookieOverride: stale });
  check("logout-all: previously issued cookie no longer authenticates", la.status === 200 && meStale.status === 200 && meStale.j?.data === null, `HTTP ${la.status}`);
  const relogin = await api("/api/auth/login", { method: "POST", body: { email, password: "supersecret1" } });
  check("login after logout-all → fresh session works", relogin.status === 200 && (await api("/api/auth/me")).j?.data?.email === email);
  let password = "supersecret1";
  if (local) {
    const beforeReset = cookie;
    const fg = await api("/api/auth/forgot", { method: "POST", noCookie: true, body: { email } });
    const rmail = outboxFor(email, /reset/i);
    const rtoken = rmail && /token=([0-9a-f]{64})/.exec(rmail.text)?.[1];
    const rs = await api("/api/auth/reset", { method: "POST", noCookie: true, cookieOverride: "", body: { token: rtoken, password: "supersecret3" } });
    const meOld = await api("/api/auth/me", { cookieOverride: beforeReset });
    const loginNew = await api("/api/auth/login", { method: "POST", body: { email, password: "supersecret3" } });
    check("password reset revokes every other session", fg.status === 200 && rs.status === 200 && meOld.j?.data === null && loginNew.status === 200, `${fg.status}/${rs.status}/${loginNew.status}`);
    if (rs.status === 200) password = "supersecret3";
  } else skip("password reset revocation", "needs local file driver outbox");

  /* ---- MEDIUM #13: PII in the audit log --------------------------------- */
  if (local && fs.existsSync(AUDIT)) {
    await new Promise((r) => setTimeout(r, 150)); // appendFile is async
    const log = fs.readFileSync(AUDIT, "utf8");
    check("audit log never contains a raw email address", !log.includes(email) && !log.includes(emailB) && !log.includes(victim));
  } else skip("audit log PII", "needs local file driver");

  /* ---- HIGH #3: daily seal quota (opt-in) -------------------------------- */
  const quota = Number(process.env.E2E_SEAL_QUOTA);
  if (quota > 0) {
    let last = 201;
    while (sealsMade < quota && last === 201) {
      const r = await api("/api/works", { method: "POST", body: { title: "Q" + sealsMade, artist: "E2E", cat: "painting", image: pngDataUri(2000) } });
      last = r.status; if (last === 201) sealsMade++;
    }
    const over = await api("/api/works", { method: "POST", body: { title: "Over", artist: "E2E", cat: "painting", image: pngDataUri(2000) } });
    check(`seal quota: ${quota}/day then 429`, sealsMade === quota && over.status === 429, `HTTP ${over.status}`);
  } else skip("seal quota", "set SEAL_DAILY_QUOTA=n on the server and E2E_SEAL_QUOTA=n here");

  /* ---- HIGH #5: per-account lockout (LAST — burns login attempts) --------- */
  const LIMIT = Number(process.env.E2E_LOGIN_FAIL_LIMIT) || 10;
  let acctFails = 1; // the "wrong password → 401" step above was this account's first failure
  let waited = false, early429 = false;
  while (acctFails < LIMIT) {
    const r = await api("/api/auth/login", { method: "POST", noCookie: true, body: { email, password: "nope" + acctFails } });
    if (r.status === 401) { acctFails++; continue; }
    if (r.status === 429 && !/this account/.test(r.j?.error || "") && !waited) {
      // Per-IP login window still holds a previous run's attempts — let it roll over once.
      console.log("      (per-IP login window busy — waiting 61s for it to clear)");
      await new Promise((res) => setTimeout(res, 61_000)); waited = true; continue;
    }
    early429 = true; break; // locked before LIMIT failures, or some other error
  }
  const locked = await api("/api/auth/login", { method: "POST", noCookie: true, body: { email, password } });
  check(`account lockout: ${LIMIT} failures → correct password refused with 429`, !early429 && acctFails === LIMIT && locked.status === 429 && /this account/.test(locked.j?.error || ""), `fails=${acctFails} HTTP ${locked.status}`);
  const lockedUnknown = await api("/api/auth/login", { method: "POST", noCookie: true, body: { email: "nobody_" + email, password: "x" } });
  check("lockout is per account (other emails unaffected)", lockedUnknown.status === 401, `HTTP ${lockedUnknown.status}`);

  console.log(`\n${fail === 0 ? "ALL GREEN" : fail + " FAILED"} — ${pass} passed, ${fail} failed  [driver=${driver}]`);
  process.exit(fail === 0 ? 0 : 1);
};
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
