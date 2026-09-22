# SecurityArts seal — verification specification

**Version:** 1.0 · **Date:** 2026-09-21 · **Applies to:** every seal SecurityArts has ever issued (payload v0 and v1)

This is the exact procedure for checking a SecurityArts seal with nothing but the public key — no account, no API, no trust in this page. It is the document `how-it-works.html` refers to as "the exact verification procedure is published alongside the public key". The public key registry is served live at `GET /api/seal/pubkey` and links here.

If anything on this page disagrees with the server, the server is wrong and this page is the contract: file an issue.

---

## 1. What a seal proves — and what it does not

A seal is an ECDSA signature made by the SecurityArts service key. When it verifies, it proves exactly this:

> **The SecurityArts service key signed the SHA-256 of these exact file bytes**, and (for v1 seals) **did so at the recorded time, using the recorded key**.

It does **not** prove that the work is human-made, original, or owned by the account that uploaded it. It does not survive re-encoding, resizing, screenshots or metadata edits: change one byte and the hash — and therefore the seal — no longer matches. The signer id on every certificate identifies the **SecurityArts service key**, never the artist; artists are identified by their account and hold no signing key.

Two payload versions exist. Both are supported forever.

| | v0 (before 2026-09-21) | v1 (current) |
|---|---|---|
| Identified by | certificate has **no** `v` field | `v: 1` |
| What is signed | the file hash only | key id + file hash + sealing timestamp |
| Timestamp trustworthy? | **No** — `ts` is stored next to the signature but not covered by it | **Yes** — a changed `ts` breaks the signature |
| Key selection | `signer` field | `kid` field |

---

## 2. Certificate format

A certificate (`cert` on every work record, also echoed by `POST /api/works`) is a JSON object:

| Field | v0 | v1 | Meaning |
|---|---|---|---|
| `v` | absent | `1` | payload version |
| `kid` | absent | string | key id of the signing key (see §3) |
| `hash` | ✓ | ✓ | SHA-256 of the raw uploaded file bytes, **64 lowercase hex chars** |
| `sig` | ✓ | ✓ | ECDSA P-256 signature, **ASN.1 DER, hex-encoded** (140–144 hex chars) |
| `signer` | ✓ | ✓ | signer id; in v1 this always equals `kid` |
| `ts` | ✓ | ✓ | sealing time, ISO-8601 UTC with millisecond precision (`2026-09-21T10:18:08.152Z`) |
| `algo` | ✓ | ✓ | human label `"ECDSA P-256 · SHA-256"` (informational) |

`sig` is a standard DER `SEQUENCE { INTEGER r, INTEGER s }` — what OpenSSL produces and consumes natively. It is **not** the fixed-width `r||s` form used by JOSE/JWS, even though the registry labels the algorithm `ES256`.

---

## 3. Key registry — `GET /api/seal/pubkey`

```json
{
  "data": {
    "signer":    "sa:key:15be11a640e2d9872d53ec3c",   // legacy: id of the ACTIVE key
    "publicKey": "-----BEGIN PUBLIC KEY-----\n…",     // legacy: PEM of the ACTIVE key
    "kid":       "sa:key:15be11a640e2d9872d53ec3c",   // active key id
    "alg":       "ES256",
    "version":   1,                                   // payload version new seals use
    "keys": [
      { "kid": "sa:key:15be11a640e2d9872d53ec3c", "signer": "sa:key:15be11a640e2d9872d53ec3c",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n…", "alg": "ES256",
        "validFrom": null, "validTo": null, "status": "active" }
      /* …retired keys follow, same shape, "status": "retired" with validFrom/validTo set… */
    ],
    "spec": "https://…/docs/seal-spec.md",
    "procedure": { "v1": { … }, "v0": { … } }        // machine-readable summary of §4 and §5
  },
  "error": null
}
```

* Exactly **one** key is `active`; only it signs new seals.
* `retired` keys never sign again but stay listed so every seal they made keeps verifying.
* `validFrom` / `validTo` bound a key's signing period. For **v1** seals the signed `ts` must fall inside that window; for v0 seals `ts` is unsigned so the window is not applied.
* **Key id derivation.** `kid` (and the identical `signer`) is `"sa:key:"` followed by the first 24 hex characters of SHA-256 over the key's SPKI PEM text — the exact `publicKeyPem` string, which ends with a single `\n`:

  ```sh
  # pub.pem = the publicKeyPem string written to a file with exactly one trailing newline
  printf '%s\n' "$(cat pub.pem)" | sha256sum | cut -c1-24 | sed 's/^/sa:key:/'
  # → sa:key:15be11a640e2d9872d53ec3c
  ```
  The id is a lookup handle, not a security boundary: verification depends on the key bytes, not on the id.

**Pin the key.** The registry is served by the same origin that issues seals. A verifier who does not want to trust that origin should fetch the public key once, keep it, and verify against the pinned copy. All keys are P-256 (`prime256v1`).

---

## 4. Verifying a v1 seal

### 4.1 Byte-exact payload

```
payload = "SA-SEAL-v1" LF kid LF hash LF ts
```

* `LF` is a single `0x0A`. There is **no trailing newline**, no BOM, no CR.
* `kid` is copied verbatim from `cert.kid`.
* `hash` is `cert.hash` in **lowercase** hex (64 chars). Recompute it from the file and compare — do not trust the record.
* `ts` is `cert.ts` verbatim, ISO-8601 UTC with exactly three fractional digits and a `Z`.
* Encoding is UTF-8 (all characters are ASCII). For the sample below the payload is exactly 132 bytes: 10 + 1 + 31 + 1 + 64 + 1 + 24.

The signature is `ECDSA-P256( SHA-256(payload) )` — the ordinary "sign a message with SHA-256" operation. OpenSSL hashes the payload for you.

### 4.2 Procedure

1. `sha256sum file` → must equal `cert.hash`. If not, stop: this is not the sealed file.
2. Fetch the registry; take `keys[i]` where `keys[i].kid == cert.kid`. Unknown `kid` → **not verified** (fail closed).
3. If that key has `validFrom`/`validTo`, check `validFrom ≤ cert.ts ≤ validTo`. Outside → **not verified**.
4. Build the payload (§4.1), decode `cert.sig` from hex to DER, verify with the key.

### 4.3 With OpenSSL — worked example

Everything below is a **real seal issued by a local development server** signed with the dev key `sa:key:15be11a640e2d9872d53ec3c`. It is *not* the production key — fetch the production registry from the live `/api/seal/pubkey`. The file is a 1×1 transparent PNG so you can reproduce the hash yourself.

```sh
# the sealed file (67 bytes)
base64 -d > pixel.png <<'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
EOF
sha256sum pixel.png
# 497790947d4666760ce38f3c00e852c71fdb66cae849bae8e9ede352719e1581

# the public key for kid sa:key:15be11a640e2d9872d53ec3c (dev key)
cat > pub.pem <<'EOF'
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2u5DUN2fz+EeD+zh1njDF6csUmyV
OdraQ2I5nCaxgp34mvcx2Qr3mapEYAeRfbY/PpxfAKYl9lTbWX8s+SiLSg==
-----END PUBLIC KEY-----
EOF

# the certificate, exactly as returned by the server
KID="sa:key:15be11a640e2d9872d53ec3c"
HASH="497790947d4666760ce38f3c00e852c71fdb66cae849bae8e9ede352719e1581"
TS="2026-09-21T10:18:08.152Z"
SIG="30460221008cb3cab4eb18d114a2457bacc2febcd75ac1e5ab0dfc41a4574eabd56f30f92a022100d4927d6eb2e8fa916b5bbd4bcd07f635d4c227a6fff9835b660e6cb2973b96cc"

# rebuild the payload (printf, not echo: no trailing newline) and the DER signature
printf 'SA-SEAL-v1\n%s\n%s\n%s' "$KID" "$HASH" "$TS" > payload.bin
xxd -r -p <<< "$SIG" > sig.der

openssl dgst -sha256 -verify pub.pem -signature sig.der payload.bin
# Verified OK
```

Change any byte of `payload.bin` — for example `TS` to `…08.153Z` — and OpenSSL prints `Verification failure`. That is the property v0 lacked.

The full certificate for reference:

```json
{
  "v": 1,
  "kid": "sa:key:15be11a640e2d9872d53ec3c",
  "hash": "497790947d4666760ce38f3c00e852c71fdb66cae849bae8e9ede352719e1581",
  "sig": "30460221008cb3cab4eb18d114a2457bacc2febcd75ac1e5ab0dfc41a4574eabd56f30f92a022100d4927d6eb2e8fa916b5bbd4bcd07f635d4c227a6fff9835b660e6cb2973b96cc",
  "signer": "sa:key:15be11a640e2d9872d53ec3c",
  "algo": "ECDSA P-256 · SHA-256",
  "ts": "2026-09-21T10:18:08.152Z"
}
```

### 4.4 Without OpenSSL — Node.js

```js
import crypto from "node:crypto";
const payload = `SA-SEAL-v1\n${cert.kid}\n${cert.hash.toLowerCase()}\n${cert.ts}`;
const ok = crypto.verify("sha256", Buffer.from(payload, "utf8"), publicKeyPem, Buffer.from(cert.sig, "hex"));
```

---

## 5. Verifying a v0 seal (certificates without `v`)

### 5.1 What was signed — the double hash

The original code signed the **32 raw bytes of the file hash** using the standard SHA-256-then-ECDSA operation. The ECDSA message digest is therefore

```
SHA-256( SHA-256(file) )
```

not `SHA-256(file)`. This is why `openssl dgst -verify` against the *file itself* fails on a v0 seal: the message you must hand OpenSSL is `cert.hash` decoded from hex (32 bytes), and OpenSSL's own SHA-256 step supplies the second hash.

Only the hash is signed. `ts`, `signer` and the work id are plain stored fields — treat the v0 timestamp as a claim by the database, not by the key.

### 5.2 Procedure

1. `sha256sum file` → must equal `cert.hash`.
2. Take the registry key where `keys[i].signer == cert.signer` (v0 has no `kid`). Unknown signer → **not verified**.
3. Message = the 32 bytes of `cert.hash` hex-decoded. Verify `cert.sig` (DER) over that message with SHA-256.

### 5.3 With OpenSSL — worked example

A real v0 seal from the same development database, signed by the same dev key (`pub.pem` from §4.3):

```sh
HASH="8efd8c2765ae80a651e64df8201115797582d38619294d75f542dc671be55416"
SIG="3045022100b6abe765847a0f74e59feb31966143f0b847ae959a1fa1ddc53dab06d5bebab10220785a74505f42d501ca7982c15b8af65969c41ca004f0c0e3c1b9b0f834a5237c"

xxd -r -p <<< "$HASH" > msg.bin        # 32 raw bytes — NOT the file
xxd -r -p <<< "$SIG"  > sig.der

openssl dgst -sha256 -verify pub.pem -signature sig.der msg.bin
# Verified OK
```

```json
{
  "hash": "8efd8c2765ae80a651e64df8201115797582d38619294d75f542dc671be55416",
  "sig": "3045022100b6abe765847a0f74e59feb31966143f0b847ae959a1fa1ddc53dab06d5bebab10220785a74505f42d501ca7982c15b8af65969c41ca004f0c0e3c1b9b0f834a5237c",
  "signer": "sa:key:15be11a640e2d9872d53ec3c",
  "algo": "ECDSA P-256 · SHA-256",
  "ts": "2026-09-21T05:31:19.925Z"
}
```

(The sealed file for this record is a random-bytes test image and is not reproduced here; the signature is checkable from the hash alone, which is the point of §5.1.)

### 5.4 Node.js

```js
const ok = crypto.verify("sha256", Buffer.from(cert.hash, "hex"), publicKeyPem, Buffer.from(cert.sig, "hex"));
```

---

## 6. Verifying through the API — `GET /api/verify/<sha256-hex>`

Convenience only: it tells you whether SecurityArts *has* a record for that hash and whether the record's signature verifies against the registry. The hash is case-insensitive. Response:

```json
{ "data": {
    "verified": true,
    "v": 1,
    "kid": "sa:key:…", "signer": "sa:key:…", "alg": "ES256",
    "sealedAt": "2026-09-21T10:18:08.152Z",
    "signedFields": ["kid", "hash", "ts"],           // ["hash"] for v0
    "hash": "497790…",
    "work": { "id": "u_…", "title": "…", "artist": "…", "medium": "…" }
} }
```

* `kid` / `signer` are taken from the **registry entry that was matched**, never echoed from the stored record.
* On failure `verified` is `false` and `reason` is one of `unknown_kid`, `unknown_signer`, `bad_signature`, `signer_mismatch`, `outside_key_validity`, `unsupported_version`, `malformed`. Everything unknown fails closed.
* `404` means no record for that hash (a malformed hash gets the same answer).
* The API is a shortcut. Anyone who cares about the answer should run §4 or §5 against a pinned public key.

---

## 7. Key rotation

The registry exists so the signing key can be rotated **without invalidating a single existing seal**. Operator procedure:

1. **Generate** a new P-256 pair (see `server/.env.example` for the one-liner). Do not deploy it yet.
2. **Retire the current key.** Add its *public* key to `SEAL_KEYS_JSON` (the current `SEAL_PUBLIC_KEY_B64` value can be pasted as `publicKeyB64`), with `"status": "retired"`, `validFrom` = when it started signing, `validTo` = a moment slightly *after* the planned swap (clock skew), e.g.
   ```json
   [{"publicKeyB64":"<old SEAL_PUBLIC_KEY_B64>","status":"retired","validFrom":"2026-07-06T00:00:00Z","validTo":"2026-10-01T00:10:00Z"}]
   ```
3. **Swap** `SEAL_PRIVATE_KEY_B64` (and `SEAL_PUBLIC_KEY_B64`, optional) to the new pair and set `SEAL_KEYS_JSON` on **every** instance in the same deploy.
4. **Check:** `GET /api/seal/pubkey` lists the new `kid` as `active` and the old one as `retired`; `GET /api/verify/<any old hash>` still answers `verified: true` with the old `kid`.
5. Destroy the old private key. Nothing needs it any more: retired entries hold public keys only and cannot sign.

Boot-time guards: a `SEAL_KEYS_JSON` that is not valid JSON, lists a duplicate key, marks a second key `active`, gives a `kid` that does not match its key, uses a non-P-256 key, or gives the active key a `validTo` in the past **stops the server** rather than silently degrading verification. A `SEAL_PUBLIC_KEY_B64` that does not belong to `SEAL_PRIVATE_KEY_B64` is refused for the same reason.

**Compromise.** If the private key leaks, rotate as above but set the old key's `validTo` to the last moment you are confident it was uncompromised. v1 seals dated after that moment will be refused (`outside_key_validity`); v0 seals cannot be time-bounded because their `ts` was never signed, which is exactly why v1 exists.

---

## 8. Where the private key lives (and the KMS path)

Today the signing key is an environment variable (`SEAL_PRIVATE_KEY_B64`) on the API hosts, or `server/data/seal-key.pem` in local development. It is **not** in an HSM/KMS. The registry design is what makes a KMS move cheap: `lib/seal.mjs` builds its signer from a single `sign(payloadBytes) → DER signature` callback (`createSealer({ publicKeyPem, sign })`). A KMS-backed signer (e.g. AWS KMS `Sign` with `ECDSA_SHA_256`, `MessageType: RAW`, which returns DER) replaces that callback; the registry, the payload, verification and every published procedure on this page are unchanged, and the KMS key is listed in the registry by the same `kid` derivation over its public key.

---

## 9. Threat-model notes

* **DB edit of "sealed at"** — detectable for v1 (signed); not detectable for v0 (documented above, and reported by `signedFields`).
* **DB edit of `signer`/`kid`** — the record cannot be pointed at a different key: the signature only verifies under the key that made it, and a v1 record whose `signer` disagrees with the matched registry entry is refused (`signer_mismatch`).
* **Serving a wrong public key** — the origin that issues seals also serves the registry; pin the key out of band if that matters to you (§3).
* **Key substitution across versions** — the payload prefix `SA-SEAL-v1` and the `kid` inside it mean a v1 signature can never be replayed as a v0 signature or under another key id.
* **Not covered by the seal:** who uploaded the file, whether it is original, whether it is human-made. See §1.

---

## 10. Change log

* **1.0 — 2026-09-21.** v1 payload (`SA-SEAL-v1\nkid\nhash\nts`), key registry with retired keys and validity windows, `/api/verify` reports `v`, `kid`, `signedFields`. v0 (hash-only, double-hash message) documented and kept verifiable forever.
