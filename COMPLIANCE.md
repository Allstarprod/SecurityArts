# SecurityArts — Security Controls & Framework Mapping

For a brand whose product *is* trust, the platform has to be defensible. This maps the
controls **actually implemented** in this codebase to the six frameworks you named, and is
honest about what's implemented vs. what needs infrastructure (payments, TLS, SSO) that only
exists at deploy time. Keep this document current — it's the artifact SOC 2 / ISO auditors ask for.

Legend: ✅ implemented in code · 🟡 partial / config-dependent · ⬜ deploy-time / roadmap.

---

## OWASP Top 10 (2021)

| # | Risk | Status | Where / how |
|---|------|--------|-------------|
| A01 | Broken Access Control | ✅ | Board/order ownership checks; path-traversal guard in static server; auth-gated routes (`routes.mjs`, `server.mjs`). |
| A02 | Cryptographic Failures | ✅ | scrypt password hashing; HMAC-signed sessions; ECDSA P-256 artwork signing (`auth.mjs`, `seal.mjs`). |
| A03 | Injection | ✅ | Parameterized queries only — the Postgres driver uses `$1`/`$2` placeholders, never string-built SQL (`drivers/postgres.mjs`); strict input validation at the boundary; JSON-only bodies; output escaped client-side. |
| A04 | Insecure Design | ✅ | Server-authoritative pricing (client can't set price); rate limiting; least-data responses (`/works` omits base64). |
| A05 | Security Misconfiguration | ✅ | CSP + full security-header set; errors never leak internals; secrets off-repo (`security.mjs`, `.gitignore`). |
| A06 | Vulnerable Components | ✅ | Minimal surface, `npm audit` **clean** (root + server). Server core is dependency-free; the only runtime dep is `pg` (Postgres driver, optional — for the Supabase backend, audit clean). Build-only tool `esbuild` compiles page JSX and is **not shipped** to the browser. Vendored React is pinned + committed. Backlog: wire Dependabot + `npm audit` into CI. |
| A07 | Auth / Identification Failures | ✅ | Rate-limited login/register; uniform error (no user enumeration); scrypt + `timingSafeEqual`. |
| A08 | Software & Data Integrity | ✅ | Server re-hashes + signs uploads; public `/api/verify/:hash`; atomic writes to the store. |
| A09 | Logging & Monitoring Failures | ✅ | JSON-line audit log for auth, publish, orders, CSRF blocks, server errors (`audit()`). |
| A10 | SSRF | ✅ | Server makes no outbound requests from user input; uploads handled as bytes, not URLs. |

## MITRE ATT&CK (relevant techniques mitigated)

- **T1110 Brute Force** → per-IP rate limits on login/register/newsletter.
- **T1078 Valid Accounts** → HttpOnly + SameSite signed sessions, short TTL, no enumeration.
- **T1190 Exploit Public-Facing App** → input validation, body-size caps, no dependencies, hardened static serving.
- **T1565 Data Manipulation** → cryptographic seal + registry make tampering detectable.
- **T1499 Endpoint DoS** → payload size limits + rate limiting (single-node; add WAF/CDN at scale — see user-scaling).
- Detection (**TA0007-adjacent**) → audit log feeds a SIEM in production.

## NIST Cybersecurity Framework (CSF 2.0)

- **Identify** — data map + control inventory in this doc and `HANDOFF.md`.
- **Protect** — access control, scrypt/ECDSA crypto, security headers, least privilege on data files (`0o600` keys/secret).
- **Detect** — audit logging of security-relevant events; CSRF/rate-limit rejections recorded.
- **Respond** — uniform error handling, session revocation (logout), key rotation path documented.
- **Recover** — atomic JSON store writes; 🟡 backups are a deploy-time concern (managed DB + PITR).

## ISO/IEC 27001 (Annex A, 2022) — representative controls

- **A.5 Access control / A.8 Identity** → auth, sessions, ownership checks. ✅
- **A.8.24 Use of cryptography** → documented algorithms (scrypt, HMAC-SHA256, ECDSA P-256). ✅
- **A.8.15 Logging** → audit trail. ✅
- **A.8.9 Configuration management** → security headers, CSP, hardened defaults. ✅
- **A.5.34 Privacy & PII** → `privacy.html`, data minimization, retention statement. ✅
- ⬜ **A.5.7 Threat intel / A.8.16 Monitoring** → SIEM + alerting at deploy.

## SOC 2 (Trust Services Criteria)

- **Security (CC6/CC7)** → logical access controls, encryption, rate limiting, audit logging, incident-ready logs. ✅
- **Confidentiality** → password hashes (never plaintext), keys `0o600`, secrets git-ignored. ✅
- **Processing Integrity** → server-authoritative pricing; seal verifies content integrity. ✅
- **Privacy** → posted policy, consent-based newsletter, subject-rights process. ✅
- **Availability** → 🟡 single-node today; HA/backup/monitoring is the scaling phase.

## CIS (Controls v8 / Benchmark posture)

- **CIS 3 Data Protection** → encryption in transit (TLS at proxy), hashing at rest for secrets. 🟡/✅
- **CIS 4 Secure Configuration** → CSP, HSTS (behind TLS), nosniff, frame-deny, referrer/permissions policy. ✅
- **CIS 5/6 Account & Access Mgmt** → scrypt, session TTL, least privilege. ✅
- **CIS 8 Audit Log Management** → structured audit log. ✅
- **CIS 16 App Software Security** → input validation, no vulnerable deps, secure SDLC notes here. ✅

---

## Known hardening backlog (be honest with auditors)

1. **CSP is pragmatic, not strict.** Page app JS is now external (precompiled `*.app.js` +
   vendored React), but a small inline no-flash theme `<script>` and inline `<style>` blocks
   remain, so `script-src`/`style-src` still allow `'unsafe-inline'`. **Fix:** move the theme
   script to a nonce and externalize the remaining inline styles → nonce-based CSP.
2. **TLS/HSTS** are terminated by the proxy/host, not this process — enable in prod (`TRUST_PROXY_HTTPS=1`).
3. **JSON file store → DONE.** Pluggable repository with a Postgres/Supabase driver
   (`DB_DRIVER=postgres`), connection pooling, shared rate limiting, and Supabase Storage for
   images. The file driver remains the zero-setup dev default. Managed encryption-at-rest +
   PITR backups come with Supabase.
4. **Signing key on disk → PARTIAL.** The seal key can now be supplied via env
   (`SEAL_*_B64`) so it's stable across instances/redeploys. Still move it to an HSM/KMS and
   add rotation + a key registry for production.
5. **Payments** are simulated → integrate a PCI-compliant processor (never handle raw PAN).
6. **Newsletter** stores raw emails → add double opt-in + ESP hand-off + suppression list.
7. **Dependencies added** since the "dependency-free" era: `pg` (runtime, Postgres) and
   `esbuild` (build-only). `npm audit` is **clean** today — wire `npm audit` + Dependabot into
   CI to keep it that way.
8. **ISO 27001 / SOC 2 are certifications, not code.** This doc maps *controls that align with*
   their criteria; it is **not** a certificate (ISO 27001, issued by an accredited body after
   an ISMS audit) or an auditor's attestation report (SOC 2, issued by a CPA firm over an
   observation period). Implementing aligned controls does **not** make the org certified.
   The marketing "Standards" section should read "aligned with / built to the controls behind"
   — never imply the org holds a SOC 2 report or ISO 27001 certificate until an accredited
   audit is actually complete.
