// Server-side artwork sealing — the trust core of SecurityArts.
//
// A seal is an ECDSA P-256 / SHA-256 signature made by the SecurityArts service key.
// Two payload versions exist and BOTH must keep verifying forever (docs/seal-spec.md
// is the third-party procedure; keep the two in sync):
//
//   v0 — certs with no `v` field (everything issued before 2026-09-21)
//     message   = the 32 raw bytes of SHA-256(file)         (cert.hash, hex-decoded)
//     signature = ECDSA-P256( SHA-256(message) )            i.e. SHA-256(SHA-256(file))
//     Only the hash is signed. `ts`, `signer` and the work id are NOT covered, so a DB
//     edit of "sealed at" was undetectable (audit HIGH #6 / LOW #14).
//
//   v1 — cert.v === 1
//     payload   = "SA-SEAL-v1\n" + kid + "\n" + hash + "\n" + ts
//                 hash = lowercase SHA-256 hex of the raw file bytes
//                 ts   = ISO-8601 UTC with millisecond precision, cert.ts verbatim
//                 UTF-8, LF separators, NO trailing newline
//     signature = ECDSA-P256( SHA-256(payload) )
//     Binds the key id, the file hash and the sealing time to the signature.
//
// Signatures are ASN.1 DER, hex-encoded — exactly what `openssl dgst -sha256 -verify`
// consumes, so anyone can check a seal with the public key alone.
//
// Keys live in a REGISTRY: exactly one `active` key signs; `retired` keys only verify
// what they signed while they were active. The active key comes from
// SEAL_PRIVATE_KEY_B64 (or the dev key on disk); retired public keys come from
// SEAL_KEYS_JSON. That is the rotation path. It is also the KMS path: a KMS-backed
// signer replaces only the `sign()` callback handed to createSealer() — the registry,
// the payload and verification are unchanged.
// Maps to: OWASP A02 (crypto) / NIST PR.DS-6 (integrity) / product provenance.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./paths.mjs";

const KEY_FILE = path.join(DATA_DIR, "seal-key.pem");
const PUB_FILE = path.join(DATA_DIR, "seal-pub.pem");

export const SEAL_VERSION = 1;
// ECDSA on P-256 with SHA-256. NOTE: the signature is DER-encoded (OpenSSL style), not
// the JOSE r||s form the "ES256" JWS label usually implies.
export const SEAL_ALG = "ES256";
export const ALGO_LABEL = "ECDSA P-256 · SHA-256"; // human label kept on every cert for the UI
const V1_PREFIX = "SA-SEAL-v1";
const HASH_RE = /^[0-9a-f]{64}$/;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STATUSES = new Set(["active", "retired"]);

// Machine-readable statement of both procedures, served by GET /api/seal/pubkey so a
// verifier has the byte-exact construction even without fetching the spec document.
export const SEAL_PROCEDURE = Object.freeze({
  v1: Object.freeze({
    payload: "SA-SEAL-v1\\n<kid>\\n<sha256-hex-lowercase>\\n<ts>",
    encoding: "UTF-8, LF (0x0A) separators, no trailing newline",
    hash: "SHA-256 over the raw uploaded file bytes, lowercase hex (cert.hash)",
    ts: "ISO-8601 UTC with millisecond precision, exactly cert.ts (e.g. 2026-09-21T05:31:19.925Z)",
    signature: "ECDSA P-256 over SHA-256(payload); ASN.1 DER, hex-encoded (cert.sig)",
    key: "registry entry whose kid equals cert.kid (must also satisfy validFrom/validTo against ts)",
    openssl: "openssl dgst -sha256 -verify pub.pem -signature sig.der payload.bin",
  }),
  v0: Object.freeze({
    message: "the 32 raw bytes of SHA-256(file) — cert.hash decoded from hex",
    signature: "ECDSA P-256 over SHA-256(message), i.e. SHA-256(SHA-256(file)); ASN.1 DER, hex-encoded (cert.sig)",
    key: "registry entry whose signer equals cert.signer",
    unsigned: ["ts", "signer", "work id"],
    openssl: "xxd -r -p <<< \"$hash\" > msg.bin && openssl dgst -sha256 -verify pub.pem -signature sig.der msg.bin",
  }),
});

/* ---- primitives ------------------------------------------------------------- */

export function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// Decode a data URL or raw base64 to bytes.
function toBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  const s = String(input);
  const comma = s.indexOf(",");
  const b64 = s.startsWith("data:") && comma > -1 ? s.slice(comma + 1) : s;
  return Buffer.from(b64, "base64");
}

// Canonical SPKI PEM for a P-256 public key (accepts a PEM string or a KeyObject).
// Re-exporting through Node normalizes line endings / trailing newline so the id
// below is the same whether the PEM came from env, disk, or SEAL_KEYS_JSON.
export function canonicalPublicKeyPem(input) {
  const key = typeof input === "string" ? crypto.createPublicKey(input) : input;
  if (key.type !== "public" || key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("seal: public key must be EC P-256 (prime256v1)");
  }
  return key.export({ type: "spki", format: "pem" });
}

// Key id == signer id: "sa:key:" + first 24 hex chars of SHA-256 over the canonical
// PEM text. This is the ORIGINAL single-key derivation, kept byte-for-byte so every
// v0 cert's `signer` resolves to a registry entry.
export function signerIdOf(publicKeyPem) {
  return "sa:key:" + sha256Hex(canonicalPublicKeyPem(publicKeyPem)).slice(0, 24);
}

// v0 ECDSA message: the raw 32 hash bytes (the digest step then hashes them again).
export function canonicalMessageV0(hashHex) {
  const h = String(hashHex || "").toLowerCase();
  if (!HASH_RE.test(h)) throw new Error("seal: hash must be 64 hex chars");
  return Buffer.from(h, "hex");
}

// v1 signed payload — the exact string a third party must rebuild.
export function canonicalPayloadV1(kid, hashHex, ts) {
  const h = String(hashHex || "").toLowerCase();
  if (typeof kid !== "string" || !kid || /[\r\n]/.test(kid)) throw new Error("seal: invalid kid");
  if (!HASH_RE.test(h)) throw new Error("seal: hash must be 64 hex chars");
  if (typeof ts !== "string" || !TS_RE.test(ts) || Number.isNaN(Date.parse(ts))) throw new Error("seal: ts must be ISO-8601 UTC with milliseconds");
  return `${V1_PREFIX}\n${kid}\n${h}\n${ts}`;
}

/* ---- key registry ------------------------------------------------------------ */

function pemOfEntry(e, i) {
  if (typeof e.publicKeyPem === "string") return e.publicKeyPem;
  if (typeof e.publicKeyB64 === "string") return Buffer.from(e.publicKeyB64, "base64").toString("utf8");
  throw new Error(`seal: SEAL_KEYS_JSON[${i}] needs publicKeyPem or publicKeyB64`);
}

function isoOrNull(v, label) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) throw new Error(`seal: ${label} must be an ISO-8601 date`);
  return new Date(v).toISOString();
}

// SEAL_KEYS_JSON → normalized public-key entries. Loud on any malformed entry: a
// silently dropped retired key would make every seal it signed unverifiable.
export function parseKeysJson(raw) {
  if (raw === undefined || raw === null || !String(raw).trim()) return [];
  let arr;
  try { arr = JSON.parse(raw); } catch { throw new Error("seal: SEAL_KEYS_JSON is not valid JSON"); }
  if (!Array.isArray(arr)) throw new Error("seal: SEAL_KEYS_JSON must be a JSON array");
  return arr.map((e, i) => {
    if (!e || typeof e !== "object") throw new Error(`seal: SEAL_KEYS_JSON[${i}] must be an object`);
    const publicKeyPem = canonicalPublicKeyPem(pemOfEntry(e, i));
    const kid = signerIdOf(publicKeyPem);
    if (e.kid !== undefined && e.kid !== kid) throw new Error(`seal: SEAL_KEYS_JSON[${i}] kid does not match its public key (derived ${kid})`);
    if (e.alg !== undefined && e.alg !== SEAL_ALG) throw new Error(`seal: SEAL_KEYS_JSON[${i}] alg must be ${SEAL_ALG}`);
    const status = e.status === undefined ? "retired" : e.status;
    if (!STATUSES.has(status)) throw new Error(`seal: SEAL_KEYS_JSON[${i}] status must be "active" or "retired"`);
    const validFrom = isoOrNull(e.validFrom, `SEAL_KEYS_JSON[${i}].validFrom`);
    const validTo = isoOrNull(e.validTo, `SEAL_KEYS_JSON[${i}].validTo`);
    if (validFrom && validTo && validFrom > validTo) throw new Error(`seal: SEAL_KEYS_JSON[${i}] validFrom is after validTo`);
    return { kid, signer: kid, publicKeyPem, alg: SEAL_ALG, validFrom, validTo, status };
  });
}

// Merge the signing key (always the single `active` entry) with SEAL_KEYS_JSON.
// An entry for the signing key itself may carry validFrom/validTo metadata; every
// other entry must be `retired`. Duplicates and a second `active` key are refused.
export function buildRegistry({ publicKeyPem, keysJson }) {
  const activePem = canonicalPublicKeyPem(publicKeyPem);
  const activeKid = signerIdOf(activePem);
  let active = { kid: activeKid, signer: activeKid, publicKeyPem: activePem, alg: SEAL_ALG, validFrom: null, validTo: null, status: "active" };
  const entries = parseKeysJson(keysJson);
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.kid)) throw new Error(`seal: duplicate key ${e.kid} in SEAL_KEYS_JSON`);
    seen.add(e.kid);
  }
  const retired = [];
  for (const e of entries) {
    if (e.kid === activeKid) { active = { ...active, validFrom: e.validFrom, validTo: e.validTo }; continue; }
    if (e.status !== "retired") throw new Error(`seal: SEAL_KEYS_JSON marks ${e.kid} active but the signing key is ${activeKid} — exactly one key may be active`);
    retired.push(e);
  }
  if (active.validTo && Date.parse(active.validTo) < Date.now()) throw new Error(`seal: the active key ${activeKid} has a validTo in the past — new seals would never verify`);
  const keys = [active, ...retired];
  return { active, keys, byId: new Map(keys.map((k) => [k.kid, k])) };
}

/* ---- sealer ------------------------------------------------------------------ */

// Build a signer + verifier over a registry.
//   privateKeyPem  local signing key (PKCS#8 PEM). Its public half is derived.
//   publicKeyPem   optional; when given it must belong to privateKeyPem (fail loudly —
//                  a mismatched pair silently mints seals nobody can verify).
//   keysJson       SEAL_KEYS_JSON text (retired keys + optional metadata).
//   sign           optional (bytes) => DER signature | Promise — the KMS slot. With it,
//                  privateKeyPem may be omitted and publicKeyPem is required.
export function createSealer({ privateKeyPem, publicKeyPem, keysJson, sign } = {}) {
  const privateKey = privateKeyPem ? crypto.createPrivateKey(privateKeyPem) : null;
  const derivedPub = privateKey ? crypto.createPublicKey(privateKey) : null;
  if (!derivedPub && !publicKeyPem) throw new Error("seal: a private key, or a public key plus sign(), is required");
  if (!privateKey && !sign) throw new Error("seal: no way to sign — provide privateKeyPem or sign()");
  if (derivedPub && publicKeyPem && canonicalPublicKeyPem(publicKeyPem) !== canonicalPublicKeyPem(derivedPub)) {
    throw new Error("seal: SEAL_PUBLIC_KEY_B64 does not belong to SEAL_PRIVATE_KEY_B64");
  }
  const registry = buildRegistry({ publicKeyPem: publicKeyPem || derivedPub, keysJson });
  const { active } = registry;
  const keyObjects = new Map(registry.keys.map((k) => [k.kid, crypto.createPublicKey(k.publicKeyPem)]));
  const signBytes = sign || ((msg) => crypto.sign("sha256", msg, privateKey));

  // Produce an authoritative v1 seal from file bytes. Only the active key ever signs;
  // asking for any other kid throws (retired entries hold no private key at all).
  async function seal(input, { kid } = {}) {
    if (kid !== undefined && kid !== active.kid) throw new Error(`seal: key ${kid} is not the active signing key`);
    const hash = sha256Hex(toBytes(input));
    const ts = new Date().toISOString();
    const payload = canonicalPayloadV1(active.kid, hash, ts);
    const sig = Buffer.from(await signBytes(Buffer.from(payload, "utf8"))).toString("hex");
    return { v: SEAL_VERSION, kid: active.kid, hash, sig, signer: active.signer, algo: ALGO_LABEL, ts };
  }

  function safeVerify(kid, msg, sigHex) {
    try { return crypto.verify("sha256", msg, keyObjects.get(kid), Buffer.from(sigHex, "hex")); } catch { return false; }
  }
  const failed = (out, reason) => ({ ...out, verified: false, reason });

  // v0: hash-only signature, key chosen by cert.signer (same namespace as kid).
  function verifyV0(cert) {
    const out = { verified: false, v: 0, kid: null, signer: null, alg: SEAL_ALG, signedFields: ["hash"] };
    let msg;
    try { msg = canonicalMessageV0(cert.hash); } catch { return failed(out, "malformed"); }
    const entry = typeof cert.signer === "string" ? registry.byId.get(cert.signer) : null;
    if (!entry) return failed(out, "unknown_signer");
    const at = { ...out, kid: entry.kid, signer: entry.signer };
    return safeVerify(entry.kid, msg, cert.sig) ? { ...at, verified: true } : failed(at, "bad_signature");
  }

  // v1: canonical payload, key chosen by cert.kid, ts must fall inside the key's window.
  function verifyV1(cert) {
    const out = { verified: false, v: 1, kid: null, signer: null, alg: SEAL_ALG, signedFields: ["kid", "hash", "ts"] };
    let payload;
    try { payload = canonicalPayloadV1(cert.kid, cert.hash, cert.ts); } catch { return failed(out, "malformed"); }
    const entry = registry.byId.get(cert.kid);
    if (!entry) return failed(out, "unknown_kid");
    const at = { ...out, kid: entry.kid, signer: entry.signer };
    if (cert.signer !== undefined && cert.signer !== entry.signer) return failed(at, "signer_mismatch");
    const t = Date.parse(cert.ts);
    if ((entry.validFrom && t < Date.parse(entry.validFrom)) || (entry.validTo && t > Date.parse(entry.validTo))) return failed(at, "outside_key_validity");
    return safeVerify(entry.kid, Buffer.from(payload, "utf8"), cert.sig) ? { ...at, verified: true } : failed(at, "bad_signature");
  }

  // Verify a stored cert against the registry. Never throws; unknown keys and
  // unknown versions fail closed. `signer`/`kid` in the result always come from the
  // registry entry that was matched — never echoed from the (unsigned) record.
  function verifySeal(cert) {
    const out = { verified: false, v: null, kid: null, signer: null, alg: SEAL_ALG, signedFields: [] };
    if (!cert || typeof cert !== "object" || typeof cert.sig !== "string" || !/^[0-9a-f]+$/i.test(cert.sig)) return failed(out, "malformed");
    const v = cert.v === undefined || cert.v === null ? 0 : cert.v;
    if (v === 0) return verifyV0(cert);
    if (v === 1) return verifyV1(cert);
    return failed(out, "unsupported_version");
  }

  // Public view of the registry — public keys and metadata only.
  function publicKeys() {
    return registry.keys.map(({ kid, signer, publicKeyPem: pem, alg, validFrom, validTo, status }) => ({ kid, signer, publicKeyPem: pem, alg, validFrom, validTo, status }));
  }

  return { seal, verifySeal, publicKeys, activeKid: active.kid, signerId: active.signer, publicKeyPem: active.publicKeyPem };
}

/* ---- default instance (env / disk) ------------------------------------------- */

function loadSigningKey() {
  // 1) Env-provided key (production / multi-instance / ephemeral hosts): ONE signing
  //    identity shared by every instance and preserved across redeploys. Base64 of the
  //    PEM so it is a single token. The public half is derived from the private key;
  //    SEAL_PUBLIC_KEY_B64 is optional and, when set, must match.
  const b64priv = process.env.SEAL_PRIVATE_KEY_B64;
  if (b64priv) {
    const b64pub = process.env.SEAL_PUBLIC_KEY_B64;
    return {
      privateKeyPem: Buffer.from(b64priv, "base64").toString("utf8"),
      publicKeyPem: b64pub ? Buffer.from(b64pub, "base64").toString("utf8") : undefined,
      source: "env",
    };
  }
  // 2) On-disk key (dev): persisted so local restarts keep the same identity.
  try {
    const privateKeyPem = fs.readFileSync(KEY_FILE, "utf8");
    let publicKeyPem;
    try { publicKeyPem = fs.readFileSync(PUB_FILE, "utf8"); } catch { /* derived from the private key */ }
    return { privateKeyPem, publicKeyPem, source: "disk" };
  } catch {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    try {
      ensureDataDir();
      fs.writeFileSync(KEY_FILE, privateKey, { mode: 0o600 });
      fs.writeFileSync(PUB_FILE, publicKey);
      return { privateKeyPem: privateKey, publicKeyPem: publicKey, source: "disk" };
    } catch {
      // Read-only filesystem (e.g. Vercel serverless) with no SEAL_PRIVATE_KEY_B64 set:
      // fall back to an EPHEMERAL in-memory key so the function doesn't crash. Seals
      // won't verify across instances/redeploys until the env key is set — warn loudly.
      console.warn("seal: no SEAL_PRIVATE_KEY_B64 and disk is not writable — using an EPHEMERAL key. Set SEAL_PRIVATE_KEY_B64 in production.");
      return { privateKeyPem: privateKey, publicKeyPem: publicKey, source: "ephemeral" };
    }
  }
}

const LOADED = loadSigningKey();
const DEFAULT = createSealer({ privateKeyPem: LOADED.privateKeyPem, publicKeyPem: LOADED.publicKeyPem, keysJson: process.env.SEAL_KEYS_JSON });

export const seal = DEFAULT.seal;                 // async (input) => cert
export const verifySeal = DEFAULT.verifySeal;     // (cert) => { verified, v, kid, signer, alg, signedFields, reason? }
export const publicKeys = DEFAULT.publicKeys;     // () => registry (public keys only)
export const ACTIVE_KID = DEFAULT.activeKid;
export const SIGNER_ID = DEFAULT.signerId;        // === ACTIVE_KID; kept for /api/health and existing consumers
export const publicKeyPem = DEFAULT.publicKeyPem;
export const KEY_SOURCE = LOADED.source;          // "env" | "disk" | "ephemeral"
