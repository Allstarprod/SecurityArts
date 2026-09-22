// Unit tests for the pure security primitives — no server, no DB, no network.
//   node --test test/unit.mjs      (from server/)
// Env is set BEFORE the modules load because several read it at import time.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.TRUST_PROXY = "1";
process.env.SENTRY_DSN = "https://publickey@o1.ingest.sentry.io/42";
delete process.env.VERCEL;

const { resolvePublicPath } = await import("../lib/static.mjs");
const { decodeImageDataUri, sniffImageType } = await import("../lib/image.mjs");
const { clientIp, CSP, emailKey } = await import("../lib/security.mjs");
const { hashPassword, verifyPassword, passwordNeedsRehash, DUMMY_HASH, readSession, createSession, sessionCookie, clearCookie, cookieName } = await import("../lib/auth.mjs");
const { verifyIdTokenClaims, pkcePair } = await import("../lib/oauth.mjs");
const { _memoryBackendForTests, createPostgresBackend } = await import("../lib/ratelimit.mjs");
const { assertProdConfig } = await import("../lib/config.mjs");
const { reportError } = await import("../lib/sentry.mjs");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

/* ---- CRITICAL #1: static allowlist ------------------------------------ */
test("static: repo internals are outside the allowlist", () => {
  for (const p of ["/server/.env", "/server/data/seal-key.pem", "/server/data/db.json", "/.git/HEAD", "/.env", "/.github/workflows/ci.yml",
    "/.claude/project-context.md", "/api/[...path].mjs", "/supabase/migrations/x.sql", "/scripts/build-pages.mjs", "/node_modules/pg/package.json",
    "/marketing/x.md", "/IMAGES & CODES/x.png", "/SecurityArts-site/SecurityArts/HANDOFF.md", "/HANDOFF.md", "/COMPLIANCE.md", "/package.json",
    "/SecurityArts-site.zip", "/Screenshot 2026-06-30 124346.png", "/js/../server/.env", "/js/..%5Cserver/.env", "/SecurityArts Design System/x.html"]) {
    assert.equal(resolvePublicPath(ROOT, p), null, p);
  }
});
test("static: the public site is reachable", () => {
  for (const p of ["/", "/index.html", "/faq.html", "/services-penetration-testing.html", "/js/api.js", "/og-image.png", "/robots.txt", "/sitemap.xml",
    "/llms.txt", "/llms-full.txt", "/favicon.ico", "/favicon-32x32.png", "/SecurityArts Design System/website/ui_kits/discover/", "/SecurityArts%20Design%20System/website/styles.css"]) {
    const r = resolvePublicPath(ROOT, p);
    assert.ok(r && r.abs && r.abs.startsWith(ROOT + path.sep), p);
  }
});
test("static: malformed percent-encoding and NUL are a 400, not a crash", () => {
  assert.deepEqual(resolvePublicPath(ROOT, "/%E0%A4%A"), { status: 400 });
  assert.deepEqual(resolvePublicPath(ROOT, "/index.html%00.png"), { status: 400 });
});

/* ---- HIGH #3: image intake ------------------------------------------- */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(64, 7)]);
const dataUri = (mime, bytes) => `data:${mime};base64,${bytes.toString("base64")}`;

test("image: sniffs PNG / JPEG / WebP from bytes", () => {
  assert.equal(sniffImageType(PNG).type, "image/png");
  assert.equal(sniffImageType(JPG).type, "image/jpeg");
  assert.equal(sniffImageType(WEBP).type, "image/webp");
  assert.equal(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
});
test("image: the declared MIME is ignored — the stored type comes from the bytes", () => {
  const r = decodeImageDataUri(dataUri("image/jpeg", PNG));
  assert.equal(r.type, "image/png");
  assert.ok(r.dataUri.startsWith("data:image/png;base64,"));
});
test("image: SVG, HTML-as-image, non-base64, and oversize are rejected", () => {
  assert.equal(decodeImageDataUri("data:image/svg+xml," + encodeURIComponent("<svg/>")), null);
  assert.equal(decodeImageDataUri(dataUri("image/svg+xml", Buffer.from("<svg/>"))), null);
  assert.equal(decodeImageDataUri(dataUri("image/png", Buffer.from("<html><script>1</script></html>"))), null);
  assert.equal(decodeImageDataUri("data:text/html;base64," + Buffer.from("<b>x</b>").toString("base64")), null);
  assert.equal(decodeImageDataUri(PNG.toString("base64")), null); // raw base64 without a data: prefix
  assert.equal(decodeImageDataUri(dataUri("image/png", PNG), { maxBytes: 16 }), null);
  assert.equal(decodeImageDataUri(42), null);
});

/* ---- HIGH #5 / MEDIUM #10: passwords + sessions ------------------------ */
test("scrypt: new hashes carry N=2^17 params, verify, and legacy hashes still verify + flag rehash", async () => {
  const h = await hashPassword("correct horse battery staple");
  assert.match(h, /^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery staple", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(passwordNeedsRehash(h), false);
  // Legacy format (scrypt$salt$key, N=2^14) as written by the old hashPassword()
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16);
  const legacy = `scrypt$${salt.toString("hex")}$${scryptSync("pw123456", salt, 64).toString("hex")}`;
  assert.equal(await verifyPassword("pw123456", legacy), true);
  assert.equal(passwordNeedsRehash(legacy), true);
  assert.equal(await verifyPassword("anything", DUMMY_HASH), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});
test("sessions: token binds the session version; legacy tokens without sv are rejected", () => {
  const u = { id: "usr_1", sessionVersion: 3 };
  const s = readSession(createSession(u));
  assert.equal(s.uid, "usr_1"); assert.equal(s.sv, 3);
  assert.equal(readSession(createSession({ id: "usr_2" })).sv, 1); // pre-migration rows default to 1
  // A signed token without `sv` (minted by the pre-versioning code) must not be honoured.
  const [body, mac] = createSession(u).split(".");
  const legacyBody = Buffer.from(JSON.stringify({ uid: "usr_1", exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(readSession(`${legacyBody}.${mac}`), null); // wrong mac for that body
  assert.equal(readSession(`${body}.${mac}x`), null);
});
test("cookies: __Host- prefix only when Secure + Path=/ can be set (https)", () => {
  assert.equal(cookieName({ https: true }), "__Host-sa_session");
  assert.equal(cookieName({ https: false }), "sa_session");
  const c = sessionCookie("tok", { https: true });
  assert.ok(c.startsWith("__Host-sa_session=tok; Path=/; HttpOnly; SameSite=Lax;") && c.endsWith("; Secure") && !/Domain=/.test(c));
  assert.ok(sessionCookie("tok", { https: false }).startsWith("sa_session=tok; ") && !/Secure/.test(sessionCookie("tok")));
  assert.ok(clearCookie({ https: true }).startsWith("__Host-sa_session=; ") && /Max-Age=0/.test(clearCookie({ https: true })));
});

/* ---- HIGH #7 / finding 15: Google id_token claims + PKCE ---------------- */
test("oauth: id_token claims must match our client id, Google's issuer, and be unexpired", () => {
  const good = { iss: "https://accounts.google.com", aud: "client-1", exp: Math.floor(Date.now() / 1000) + 60, sub: "s", email: "a@b.c" };
  assert.ok(verifyIdTokenClaims(good, { clientId: "client-1" }));
  assert.ok(verifyIdTokenClaims({ ...good, iss: "accounts.google.com", aud: ["other", "client-1"] }, { clientId: "client-1" }));
  assert.equal(verifyIdTokenClaims({ ...good, aud: "someone-elses-app" }, { clientId: "client-1" }), null);
  assert.equal(verifyIdTokenClaims({ ...good, iss: "https://evil.example" }, { clientId: "client-1" }), null);
  assert.equal(verifyIdTokenClaims({ ...good, exp: Math.floor(Date.now() / 1000) - 1 }, { clientId: "client-1" }), null);
  assert.equal(verifyIdTokenClaims(good, { clientId: "" }), null);
  assert.equal(verifyIdTokenClaims(null, { clientId: "client-1" }), null);
});
test("oauth: PKCE pair is S256(verifier)", async () => {
  const { createHash } = await import("node:crypto");
  const { verifier, challenge } = pkcePair();
  assert.ok(verifier.length >= 43 && verifier.length <= 128);
  assert.equal(challenge, createHash("sha256").update(verifier).digest("base64url"));
});

/* ---- MEDIUM #9: client IP + limiter failure policy --------------------- */
test("clientIp: rightmost XFF hop wins; client-prepended hops are ignored", () => {
  const req = (headers, remote = "10.0.0.1") => ({ headers, socket: { remoteAddress: remote } });
  assert.equal(clientIp(req({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" })), "203.0.113.9");
  assert.equal(clientIp(req({ "x-forwarded-for": "spoofed, 203.0.113.9" })), "203.0.113.9");
  assert.equal(clientIp(req({ "x-vercel-forwarded-for": "198.51.100.7", "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "198.51.100.7");
  assert.equal(clientIp(req({ "x-real-ip": "198.51.100.8", "x-forwarded-for": "2.2.2.2" })), "2.2.2.2"); // x-real-ip untrusted off-Vercel
  process.env.VERCEL = "1";
  assert.equal(clientIp(req({ "x-real-ip": "198.51.100.8", "x-forwarded-for": "2.2.2.2" })), "198.51.100.8");
  delete process.env.VERCEL;
  assert.equal(clientIp(req({ "x-forwarded-for": "not an ip" })), "10.0.0.1");
  assert.equal(clientIp(req({})), "10.0.0.1");
});
test("ratelimit: memory backend honours long windows and peek/hit count only what's recorded", async () => {
  const m = _memoryBackendForTests();
  for (let i = 0; i < 3; i++) assert.equal(await m.allow("k", 3, 86_400_000), true);
  assert.equal(await m.allow("k", 3, 86_400_000), false);
  assert.equal(await m.peek("acct", 2, 60_000), true);
  await m.hit("acct", 60_000);
  assert.equal(await m.peek("acct", 2, 60_000), true);
  await m.hit("acct", 60_000);
  assert.equal(await m.peek("acct", 2, 60_000), false); // 2 failures recorded → locked
});
test("ratelimit: postgres backend fails CLOSED (memory) for critical buckets, open otherwise", async () => {
  const broken = { query: async () => { throw new Error("db down"); } };
  const b = await createPostgresBackend(broken);
  assert.equal(await b.allow("ip:x", 5, 60_000), true);
  assert.equal(await b.allow("ip:x", 5, 60_000), true); // fail-open: never denies
  let last;
  for (let i = 0; i < 3; i++) last = await b.allow("login:x", 2, 60_000, { critical: true });
  assert.equal(last, false); // fail-closed: the in-process fallback still enforces the limit
  assert.equal(await b.peek("acct:y", 1, 60_000, { critical: true }), true);
  await b.hit("acct:y", 60_000, { critical: true });
  assert.equal(await b.peek("acct:y", 1, 60_000, { critical: true }), false);
  assert.equal(await b.peek("acct:z", 1, 60_000), true); // non-critical peek fails open
});

/* ---- MEDIUM #8: CSP parity + content ----------------------------------- */
test("csp: standalone and vercel.json policies are identical and scoped to the project CDN", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const header = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy");
  assert.equal(header.value, CSP);
  assert.match(CSP, /img-src 'self' data: blob: https:\/\/ixdkfakibuctwhgwngsw\.supabase\.co(;|$)/);
  assert.ok(!/connect-src[^;]*supabase/.test(CSP), "connect-src must not list Supabase");
  assert.ok(!/\*\.supabase\.co/.test(CSP), "no Supabase wildcard");
});

/* ---- MEDIUM #12: production config ------------------------------------ */
test("config: production refuses to start without a valid https PUBLIC_BASE_URL", () => {
  assert.doesNotThrow(() => assertProdConfig({ NODE_ENV: "development" }));
  assert.throws(() => assertProdConfig({ NODE_ENV: "production" }), /PUBLIC_BASE_URL is required/);
  assert.throws(() => assertProdConfig({ NODE_ENV: "production", PUBLIC_BASE_URL: "http://plain.example" }), /https origin/);
  assert.throws(() => assertProdConfig({ NODE_ENV: "production", PUBLIC_BASE_URL: "https://x.example/app" }), /https origin/);
  assert.doesNotThrow(() => assertProdConfig({ NODE_ENV: "production", PUBLIC_BASE_URL: "https://security-arts.vercel.app" }));
});

/* ---- MEDIUM #13: PII ---------------------------------------------------- */
test("pii: emailKey is a stable 12-hex digest, not the address", () => {
  assert.match(emailKey("A@B.co"), /^[0-9a-f]{12}$/);
  assert.equal(emailKey("A@B.co"), emailKey(" a@b.co "));
  assert.notEqual(emailKey("a@b.co"), emailKey("c@d.co"));
});
test("pii: Sentry events carry no ip / email / headers", async () => {
  let sent = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { ok: true }; };
  try {
    await reportError(new Error("boom"), { pathname: "/api/x", method: "POST", ip: "203.0.113.5", email: "a@b.co", headers: { cookie: "x" } });
  } finally { globalThis.fetch = realFetch; }
  assert.ok(sent, "event was sent");
  assert.equal(sent.extra.ip, undefined); assert.equal(sent.extra.email, undefined); assert.equal(sent.extra.headers, undefined);
  assert.equal(sent.user, undefined); assert.equal(sent.request, undefined);
  assert.equal(sent.tags.pathname, "/api/x");
  assert.ok(!JSON.stringify(sent).includes("203.0.113.5"));
});

/* ---- HIGH #6 / LOW #14: versioned seal payload + key registry ------------- */
const sealLib = await import("../lib/seal.mjs");
const { createSealer, canonicalPayloadV1, canonicalMessageV0, signerIdOf, sha256Hex } = sealLib;
const crypto = await import("node:crypto");
const os = await import("node:os");
const { spawnSync } = await import("node:child_process");

const genKey = () => crypto.generateKeyPairSync("ec", { namedCurve: "P-256", privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const BYTES = Buffer.concat([PNG, Buffer.from("seal-me")]);
// A v0 cert exactly as the pre-2026-09-21 code minted it: ECDSA over the 32 raw hash bytes, no `v`, no `kid`.
function mintV0(privateKey, publicKey, bytes) {
  const hash = sha256Hex(bytes);
  const sig = crypto.sign("sha256", Buffer.from(hash, "hex"), privateKey).toString("hex");
  return { hash, sig, signer: signerIdOf(publicKey), algo: "ECDSA P-256 · SHA-256", ts: "2026-07-06T23:09:27.986Z" };
}

test("seal: v1 sign → verify round trip; the cert carries v, kid and a DER-hex signature", async () => {
  const k = genKey();
  const s = createSealer({ privateKeyPem: k.privateKey });
  const cert = await s.seal(BYTES);
  assert.equal(cert.v, 1);
  assert.equal(cert.kid, signerIdOf(k.publicKey));
  assert.equal(cert.signer, cert.kid);
  assert.equal(cert.hash, sha256Hex(BYTES));
  assert.match(cert.sig, /^30[0-9a-f]{136,142}$/); // ASN.1 DER SEQUENCE, hex
  assert.match(cert.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const r = s.verifySeal(cert);
  assert.deepEqual(r, { verified: true, v: 1, kid: cert.kid, signer: cert.kid, alg: "ES256", signedFields: ["kid", "hash", "ts"] });
  // data-URI input hashes the same bytes as the raw buffer
  assert.equal((await s.seal(dataUri("image/png", BYTES))).hash, cert.hash);
  assert.equal(s.publicKeys()[0].kid, s.activeKid);
  assert.equal(s.publicKeys()[0].status, "active");
});

test("seal: canonical v1 payload is byte-exact (LF, no trailing newline, lowercase hash) and rejects bad input", () => {
  const hash = "AB".repeat(32);
  const p = canonicalPayloadV1("sa:key:0123456789abcdef01234567", hash, "2026-09-21T05:31:19.925Z");
  assert.equal(p, "SA-SEAL-v1\nsa:key:0123456789abcdef01234567\n" + "ab".repeat(32) + "\n2026-09-21T05:31:19.925Z");
  assert.ok(!p.endsWith("\n"));
  assert.throws(() => canonicalPayloadV1("k\ninjected", hash, "2026-09-21T05:31:19.925Z"), /invalid kid/);
  assert.throws(() => canonicalPayloadV1("k", "nothex", "2026-09-21T05:31:19.925Z"), /64 hex/);
  assert.throws(() => canonicalPayloadV1("k", hash, "2026-09-21T05:31:19Z"), /milliseconds/); // no ms → ambiguous → refused
  assert.deepEqual(canonicalMessageV0(hash), Buffer.from("ab".repeat(32), "hex"));
});

test("seal: a v0 cert (hash-only signature, no v/kid) still verifies through its signer id", async () => {
  const k = genKey();
  const s = createSealer({ privateKeyPem: k.privateKey });
  const v0 = mintV0(k.privateKey, k.publicKey, BYTES);
  assert.equal(v0.v, undefined);
  const r = s.verifySeal(v0);
  assert.deepEqual(r, { verified: true, v: 0, kid: v0.signer, signer: v0.signer, alg: "ES256", signedFields: ["hash"] });
  // v0 never covered ts — changing it does NOT break the signature (that is the audit finding v1 fixes)
  assert.equal(s.verifySeal({ ...v0, ts: "1999-01-01T00:00:00.000Z" }).verified, true);
  // but a v0 cert whose signer names no registry key fails closed, and v0 is never accepted for the active key by hash alone
  assert.equal(s.verifySeal({ ...v0, signer: "sa:key:000000000000000000000000" }).reason, "unknown_signer");
  assert.equal(s.verifySeal({ ...v0, signer: undefined }).reason, "unknown_signer");
  assert.equal(s.verifySeal({ ...v0, hash: v0.hash.replace(/^./, (c) => (c === "0" ? "1" : "0")) }).reason, "bad_signature");
});

test("seal: tampering with ts / hash / kid / signer on a v1 cert fails; unknown kid and versions fail closed", async () => {
  const k = genKey();
  const s = createSealer({ privateKeyPem: k.privateKey });
  const cert = await s.seal(BYTES);
  assert.equal(s.verifySeal({ ...cert, ts: "2020-01-01T00:00:00.000Z" }).reason, "bad_signature");
  assert.equal(s.verifySeal({ ...cert, hash: sha256Hex(Buffer.from("other")) }).reason, "bad_signature");
  assert.equal(s.verifySeal({ ...cert, kid: "sa:key:000000000000000000000000" }).reason, "unknown_kid");
  assert.equal(s.verifySeal({ ...cert, signer: "sa:key:000000000000000000000000" }).reason, "signer_mismatch");
  assert.equal(s.verifySeal({ ...cert, ts: "2026-09-21T05:31:19Z" }).reason, "malformed");
  assert.equal(s.verifySeal({ ...cert, sig: cert.sig.slice(0, -2) + "00" }).reason, "bad_signature");
  assert.equal(s.verifySeal({ ...cert, sig: "zz" }).reason, "malformed");
  assert.equal(s.verifySeal({ ...cert, v: 2 }).reason, "unsupported_version");
  assert.equal(s.verifySeal({ ...cert, v: "1" }).reason, "unsupported_version");
  assert.equal(s.verifySeal(null).reason, "malformed");
  // uppercase hash in the record still verifies (payload is lowercase-normalized)
  assert.equal(s.verifySeal({ ...cert, hash: cert.hash.toUpperCase() }).verified, true);
  // the matched registry identity is reported even on failure, never the record's own signer
  const bad = s.verifySeal({ ...cert, ts: "2020-01-01T00:00:00.000Z" });
  assert.equal(bad.verified, false); assert.equal(bad.kid, cert.kid); assert.equal(bad.signer, cert.kid);
});

test("seal: rotation — a retired key verifies its old v0 + v1 seals but never signs; exactly one active key", async () => {
  const old = genKey(), fresh = genKey();
  const before = createSealer({ privateKeyPem: old.privateKey });
  const v1Old = await before.seal(BYTES);
  const v0Old = mintV0(old.privateKey, old.publicKey, Buffer.from("legacy"));
  const keysJson = JSON.stringify([
    { kid: signerIdOf(old.publicKey), publicKeyB64: Buffer.from(old.publicKey).toString("base64"), alg: "ES256", validFrom: "2026-07-01T00:00:00Z", validTo: "2099-01-01T00:00:00Z", status: "retired" },
  ]);
  const after = createSealer({ privateKeyPem: fresh.privateKey, keysJson });
  assert.equal(after.activeKid, signerIdOf(fresh.publicKey));
  assert.deepEqual(after.publicKeys().map((e) => [e.kid, e.status]), [[signerIdOf(fresh.publicKey), "active"], [signerIdOf(old.publicKey), "retired"]]);
  assert.equal(after.publicKeys()[1].validFrom, "2026-07-01T00:00:00.000Z");
  assert.ok(after.publicKeys().every((e) => !("privateKey" in e) && !JSON.stringify(e).includes("PRIVATE")));
  assert.equal(after.verifySeal(v1Old).verified, true);
  assert.equal(after.verifySeal(v1Old).kid, signerIdOf(old.publicKey));
  assert.equal(after.verifySeal(v0Old).verified, true);
  const v1New = await after.seal(BYTES);
  assert.equal(v1New.kid, after.activeKid);
  assert.equal(after.verifySeal(v1New).verified, true);
  assert.equal(before.verifySeal(v1New).reason, "unknown_kid"); // old deployment knows nothing of the new key → closed
  await assert.rejects(after.seal(BYTES, { kid: signerIdOf(old.publicKey) }), /not the active signing key/);
  // registry hygiene: a second "active", a duplicate, a kid that lies about its key, a non-P-256 key
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: old.publicKey, status: "active" }]) }), /exactly one key may be active/);
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: old.publicKey }, { publicKeyPem: old.publicKey }]) }), /duplicate key/);
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ kid: "sa:key:wrong", publicKeyPem: old.publicKey }]) }), /kid does not match/);
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: "not json" }), /not valid JSON/);
  const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: rsa.publicKey }]) }), /EC P-256/);
  // an entry for the signing key itself only contributes metadata and stays active
  const meta = createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: fresh.publicKey, validFrom: "2026-09-21T00:00:00Z", status: "retired" }]) });
  assert.equal(meta.publicKeys()[0].status, "active"); assert.equal(meta.publicKeys()[0].validFrom, "2026-09-21T00:00:00.000Z");
});

test("seal: a v1 seal whose signed ts falls outside its key's validity window is refused", async () => {
  const old = genKey(), fresh = genKey();
  const v1Old = await createSealer({ privateKeyPem: old.privateKey }).seal(BYTES); // ts = now
  const windowed = (validFrom, validTo) => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: old.publicKey, validFrom, validTo }]) });
  assert.equal(windowed("2000-01-01T00:00:00Z", "2099-01-01T00:00:00Z").verifySeal(v1Old).verified, true);
  assert.equal(windowed("2000-01-01T00:00:00Z", "2001-01-01T00:00:00Z").verifySeal(v1Old).reason, "outside_key_validity"); // retired before this seal claims to exist
  assert.equal(windowed("2099-01-01T00:00:00Z", null).verifySeal(v1Old).reason, "outside_key_validity");
  // v0 has an unsigned ts, so the window is not applied to it (it would prove nothing)
  const v0Old = mintV0(old.privateKey, old.publicKey, BYTES);
  assert.equal(windowed("2000-01-01T00:00:00Z", "2001-01-01T00:00:00Z").verifySeal(v0Old).verified, true);
  assert.throws(() => createSealer({ privateKeyPem: fresh.privateKey, keysJson: JSON.stringify([{ publicKeyPem: fresh.publicKey, validTo: "2001-01-01T00:00:00Z" }]) }), /validTo in the past/);
});

test("seal: a public key that does not belong to the private key is refused at boot; KMS-style sign() slots in", async () => {
  const a = genKey(), b = genKey();
  assert.throws(() => createSealer({ privateKeyPem: a.privateKey, publicKeyPem: b.publicKey }), /does not belong/);
  assert.doesNotThrow(() => createSealer({ privateKeyPem: a.privateKey, publicKeyPem: a.publicKey }));
  assert.throws(() => createSealer({ publicKeyPem: a.publicKey }), /no way to sign/);
  // External signer: only sign() changes — it receives the payload bytes and returns a DER signature.
  let seen = null;
  const kms = createSealer({ publicKeyPem: a.publicKey, sign: async (bytes) => { seen = bytes.toString("utf8"); return crypto.sign("sha256", bytes, a.privateKey); } });
  const cert = await kms.seal(BYTES);
  assert.equal(seen, canonicalPayloadV1(cert.kid, cert.hash, cert.ts));
  assert.equal(kms.verifySeal(cert).verified, true);
  assert.equal(createSealer({ privateKeyPem: a.privateKey }).verifySeal(cert).verified, true); // same key, local verifier
});

test("seal: the default (env/disk) instance signs v1 with the registry's active key", async () => {
  const cert = await sealLib.seal(BYTES);
  assert.equal(cert.kid, sealLib.ACTIVE_KID);
  assert.equal(sealLib.SIGNER_ID, sealLib.ACTIVE_KID);
  assert.equal(sealLib.verifySeal(cert).verified, true);
  assert.equal(sealLib.publicKeys()[0].publicKeyPem, sealLib.publicKeyPem);
  assert.equal(sealLib.publicKeys()[0].kid, sealLib.ACTIVE_KID);
  assert.ok(["env", "disk", "ephemeral"].includes(sealLib.KEY_SOURCE));
  assert.equal(sealLib.SEAL_PROCEDURE.v1.payload, "SA-SEAL-v1\\n<kid>\\n<sha256-hex-lowercase>\\n<ts>");
});

test("seal: openssl dgst -sha256 -verify accepts both v1 (payload) and v0 (raw hash bytes) signatures", async (t) => {
  const probe = spawnSync("openssl", ["version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) { t.skip("openssl is not on PATH — third-party compatibility not exercised"); return; }
  const k = genKey();
  const s = createSealer({ privateKeyPem: k.privateKey });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-seal-"));
  try {
    fs.writeFileSync(path.join(dir, "pub.pem"), s.publicKeyPem);
    const run = (msgFile, sigFile) => spawnSync("openssl", ["dgst", "-sha256", "-verify", "pub.pem", "-signature", sigFile, msgFile], { cwd: dir, encoding: "utf8" });
    // v1
    const cert = await s.seal(BYTES);
    fs.writeFileSync(path.join(dir, "payload.bin"), Buffer.from(canonicalPayloadV1(cert.kid, cert.hash, cert.ts), "utf8"));
    fs.writeFileSync(path.join(dir, "sig1.der"), Buffer.from(cert.sig, "hex"));
    const r1 = run("payload.bin", "sig1.der");
    assert.equal(r1.status, 0, r1.stdout + r1.stderr); assert.match(r1.stdout, /Verified OK/);
    // a payload with a trailing newline (the classic third-party mistake) must NOT verify
    fs.writeFileSync(path.join(dir, "payload-nl.bin"), Buffer.from(canonicalPayloadV1(cert.kid, cert.hash, cert.ts) + "\n", "utf8"));
    assert.notEqual(run("payload-nl.bin", "sig1.der").status, 0);
    // v0: the message is the 32 raw hash bytes, so openssl's own SHA-256 step makes it SHA-256(SHA-256(file))
    const v0 = mintV0(k.privateKey, k.publicKey, BYTES);
    fs.writeFileSync(path.join(dir, "msg.bin"), canonicalMessageV0(v0.hash));
    fs.writeFileSync(path.join(dir, "sig0.der"), Buffer.from(v0.sig, "hex"));
    const r0 = run("msg.bin", "sig0.der");
    assert.equal(r0.status, 0, r0.stdout + r0.stderr); assert.match(r0.stdout, /Verified OK/);
    // …and verifying the v0 signature against the raw FILE bytes fails (audit LOW #14: the double hash must be documented)
    fs.writeFileSync(path.join(dir, "file.bin"), BYTES);
    assert.notEqual(run("file.bin", "sig0.der").status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
