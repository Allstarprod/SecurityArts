// Server-side artwork sealing — the trust core of SecurityArts.
// A persistent ECDSA P-256 key (the "SecurityArts key") signs the SHA-256 of the
// original file bytes. In production this key lives in an HSM/KMS, not on disk.
// Maps to: OWASP A02 (crypto) / NIST PR.DS-6 (integrity) / product provenance.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, ensureDataDir } from "./paths.mjs";

const KEY_FILE = path.join(DATA_DIR, "seal-key.pem");
const PUB_FILE = path.join(DATA_DIR, "seal-pub.pem");

function loadKeys() {
  try {
    return {
      privateKey: fs.readFileSync(KEY_FILE, "utf8"),
      publicKey: fs.readFileSync(PUB_FILE, "utf8"),
    };
  } catch {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    ensureDataDir();
    fs.writeFileSync(KEY_FILE, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUB_FILE, publicKey);
    return { privateKey, publicKey };
  }
}
const KEYS = loadKeys();

export const SIGNER_ID =
  "sa:key:" + crypto.createHash("sha256").update(KEYS.publicKey).digest("hex").slice(0, 24);

// Decode a data URL or raw base64 to bytes.
function toBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  const s = String(input);
  const comma = s.indexOf(",");
  const b64 = s.startsWith("data:") && comma > -1 ? s.slice(comma + 1) : s;
  return Buffer.from(b64, "base64");
}

// Produce an authoritative seal from file bytes.
export function seal(input) {
  const bytes = toBytes(input);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const signer = crypto.createSign("SHA256");
  signer.update(Buffer.from(hash, "hex"));
  signer.end();
  const sig = signer.sign(KEYS.privateKey, "hex");
  return { hash, sig, signer: SIGNER_ID, algo: "ECDSA P-256 · SHA-256", ts: new Date().toISOString() };
}

// Verify a hash+sig against the SecurityArts public key (for /api/verify).
export function verifySeal(hashHex, sigHex) {
  try {
    const v = crypto.createVerify("SHA256");
    v.update(Buffer.from(hashHex, "hex"));
    v.end();
    return v.verify(KEYS.publicKey, sigHex, "hex");
  } catch {
    return false;
  }
}

export const publicKeyPem = KEYS.publicKey;
