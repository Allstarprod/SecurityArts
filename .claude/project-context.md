# Project Context — SecurityArts

**Last updated**: 2026-08-07

> Entry point for the marketing-skills library. SecurityArts is TWO products under
> one "seal" brand. Read the whole file; note which product a task targets.

---

## ⚠️ Dual-product brand (read first)

The seal — *"we sign our work"* — is the throughline across both:

| Product | What | Audience | GTM motion | Primary CTA |
|---------|------|----------|-----------|-------------|
| **A. Security studio** | Offensive + defensive security consultancy (red team, pentest, appsec, cloud, detection & response, vCISO). Every engagement ends in a **verifiable seal**, not a PDF. **This is the live homepage `/`.** | Companies (founders, CISO, eng leaders) | **Sales-led / high-ACV** — founder-led outbound, long cycles | "Request an engagement" |
| **B. Verified-human-art platform** | Cryptographically seals human-made art (ECDSA over raw bytes), a public wall (Discover), profiles, feed, DMs, marketplace. Secondary surface, entry band on homepage. | Independent artists (+ collectors) | **Product-led / community** — cold start | "Get your work verified" / "Enter the wall" |

**One brand metaphor, two motions.** Don't blend the copy: security buyers and artists want opposite things. Pick the target per task.

---

## Project Overview

| Field | Content |
|-------|---------|
| **Industry** | (A) Cybersecurity services · (B) Creator tools / authenticity |
| **Website** | Live: https://security-arts.vercel.app · Intended canonical: https://securityarts.studio |
| **Stage** | Launched — live, pre-traction (both products) |
| **Core product** | A security studio that signs its work — plus a platform that seals human-made art with the same cryptographic proof |
| **Slogan** | Studio: "Security is a craft. We sign our work." · Platform: "A wall of work no machine made." / "Proof a human made it." |
| **Contact** | hello@securityarts.studio |
| **Company** | SecurityArts (indie / solo-founder build), est. 2026 |

**Product form**: Web only. Studio = marketing site + contact. Platform = app (Discover, seal, profiles `/@handle`, marketplace).

---

## 1. Product Overview

**One-line descriptions**:
```
A. SecurityArts is a security studio: we break systems before adversaries do,
   harden what matters, and leave a verifiable seal behind — not a report you file away.
B. SecurityArts also seals human-made art — ECDSA-signed over the exact image bytes,
   published to a public registry anyone can verify.
```

**Category**: (A) Boutique security consultancy · (B) Human-authorship verification + artist community
**Business model**: (A) Services / engagements (high-ACV) · (B) PLG freemium (Pro/registry/API later)
**Pricing**: Studio = custom engagement scope. Platform = free core; paid tiers not public — **no pricing claims**.

**Core lines**:

| Line | Product | Description |
|------|---------|-------------|
| A | Offensive Security | Red teaming, pentest, adversary simulation, social engineering |
| A | Application Security | Threat modeling, code review, secure SDLC |
| A | Cloud & Infrastructure | AWS/GCP/Azure hardening, IAM, IaC review |
| A | Detection & Response | Detection engineering, threat hunting, IR readiness |
| A | Security Architecture | Design review, zero-trust, boundary design |
| A | Advisory & Training | vCISO, workshops, secure-by-design |
| B | Seal | Server hashes raw bytes (SHA-256), signs ECDSA P-256 → tamper-evident certificate |
| B | Discover (the wall) | Public, filterable wall of sealed human work |
| B | Marketplace | Sell verified human work to collectors |
| B | Profiles + feed + DMs | `/@handle`, For You feed, direct messages |

**Differentiation (shared)**: proof, not a promise. Studio: findings trace to a re-runnable test, sealed + dated. Platform: a cryptographic certificate anyone can verify — vs detectors that guess or metadata that gets stripped.

---

## 2. Positioning Statements

**A — Security studio**
> **For** teams shipping software they can't afford to have breached **who** are tired of pentest PDFs that rot in a drawer, **our** SecurityArts **is a** boutique security studio **that** attacks like a real adversary and ends every engagement in a verifiable, re-testable seal. **Unlike** checklist-sweep vendors, **we** scope to a named outcome and leave a mark you can trust because every claim traces to a test you can re-run.

**B — Verified-human-art platform**
> **For** independent artists **who** need to prove their work is human in an AI-flooded feed, **our** SecurityArts **is a** human-authorship verification platform + community **that** seals each piece and publishes it to a public registry anyone can check. **Unlike** AI-detectors that guess or private badges, **we** issue signed, verifiable proof because each seal is an ECDSA signature over the exact image bytes.

---

## 3. Value Proposition & Key Messages

**A (studio)**: Security that leaves proof, not paperwork.
- "We sign our work." A sealed, re-testable record — what was tested, what's fixed, what's still open.
- "We attack like adversaries do," not a checklist sweep.
- Scoped to a named outcome, not a bundle of hours.
- Works to the frameworks your auditors trust: OWASP, MITRE ATT&CK, NIST CSF, ISO 27001, SOC 2, CIS.

**B (platform)**: Prove your art is human — a receipt anyone can verify.
- "Get the receipt." Accused of AI? Show a tamper-proof seal instead of arguing.
- "Proof, not a probability." Detectors guess; a seal is signed math.
- "A public wall of verified human work." Discovery + credibility in one place.

**Proof points**: ECDSA P-256 · SHA-256 over raw bytes; public verify page per work. [Add real counts once available. No fabricated stats/testimonials.]

---

## 4. Target Audience / ICP

**A — Security studio (primary buyer = company)**
- **Who**: Founders / CTOs / CISOs / eng leaders at startups + scaleups shipping sensitive software or facing an audit.
- **Jobs**: Pass a security review; find real attack paths before adversaries; satisfy SOC 2 / ISO; raise the team's floor.
- **Triggers**: Enterprise deal needs a pentest; funding round; compliance audit; a scare/incident; a customer security questionnaire.
- **Motion**: Sales-led. Founder-led outbound (10–15 personalized/day), warm intros, credibility content. ACV high → long cycle.

**B — Art platform (primary user = artist)**
- **Who**: Independent digital + traditional artists posting work publicly.
- **Jobs**: Prove authorship; defend against false "that's AI" accusations; stand out as verified-human; build a credible portfolio; sell to collectors who care.
- **Triggers**: A public AI accusation; a platform flooding with AI; a client asking "is this AI?"; joining an anti-AI-art community.
- **Secondary**: collectors / commissioners wanting authenticity before paying.
- **Motion**: PLG. Community cold-start (Cara, Reddit, X), build-in-public.

**Locale**: en-US.

---

## 5. Existing Website

- **Live**: https://security-arts.vercel.app · **Canonical (intended)**: https://securityarts.studio
- **Stack**: Static React (vanilla, esbuild), dependency-free Node API on Vercel serverless, Supabase Postgres + Storage.
- **Homepage `/`** = **studio** marketing site (hero "We sign our work" → Practice, The Seal, Identity, Discover band, Standards, Contact, Newsletter).
- **Clean root pages exist**: `/`, `/discover.html`, `/market.html`, `/privacy.html`, `/terms.html`.
- **App pages** live deep: `/SecurityArts Design System/website/ui_kits/discover/*.html` (index, seal, foryou, profile, login, me, create, dms, pricing, verify, welcome) — **linked from homepage via ugly encoded paths; not SEO-clean or shareable.**
- **Vanity**: `/@handle` → profile (vercel.json rewrite).

**URL hierarchy**:

| Path | Purpose | State |
|------|---------|-------|
| `/` | Studio landing | Clean |
| `/discover.html`, `/market.html` | Art platform entry | Clean root copies exist |
| `/SecurityArts%20Design%20System/.../seal.html?work=<id>` | Public seal cert | **Ugly; fix — see P0** |
| `/@handle` | Profile | Rewrite exists |
| `/api/*` | Backend | Disallowed in robots |

**Files already present**: `robots.txt` (allows all, disallows `/api/`), `sitemap.xml` (lists `/`, `/discover.html`, `/market.html`, `/privacy.html`, `/terms.html`).

---

## 6. Keywords

**A (studio)** — Primary: boutique penetration testing, red team as a service, application security consulting, SOC 2 pentest, cloud security assessment. Long-tail: pentest for SaaS startup, security review for enterprise deal, vCISO for startup. Intent: commercial/transactional, low-volume/high-value.

**B (platform)** — Primary: verified human art, prove art is not AI, human-made art verification, proof of human authorship. Secondary: "made by a human" badge, C2PA / content credentials alternative. Long-tail: how to prove my art is not AI generated, defend against AI accusation as an artist. Competitor/brand: Not By AI alternative, Cara alternative.

**Programmatic (B)**: per-medium/scenario pages + per-work public seal pages (ensure indexable + schema).

---

## 7. Competitors

**A (studio)**: boutique security firms (Trail of Bits, Doyensec, Latacora-style vCISO, Bishop Fox), commodity pentest shops, big-4 advisory. Differentiator: the seal — verifiable, re-testable proof + outcome-scoped, not checklist PDFs.

**B (platform)**: C2PA / Adobe Content Credentials (metadata, strippable), "Not By AI" badge, Glaze/Nightshade (defense not proof), AI detectors (Hive, Optic, "AI or Not"). Community substitutes: Cara, ArtStation, Behance. Differentiator: verifiable cryptographic certificate + public registry + community. Comparison pages: vs detectors, vs C2PA, vs Not By AI, vs posting your PSD.

---

## 8. Brand & Voice

- **Voice**: Confident, plainspoken, craft-proud. "We sign our work." Credible/technical when it counts; never jargon-drunk or hypey.
- **Tone**: Studio = assured, precise, senior-practitioner. Platform = reassuring to the accused artist, sharp toward AI slop.
- **Archetype**: Sage + Hero (Creator undertone; Outlaw edge on the platform's anti-AI stance).
- **Avoid**: "revolutionize," "synergy," "next-gen," "unleash," "cutting-edge," overclaiming ("100% AI-proof," "unhackable"), fear-mongering.
- **Preferred**: "seal" (not "watermark"), "proof"/"receipt" (not "score"), "engagement" (not "project"), "human-made" (not "authentic" alone), "artist" (not "user"), "verify" (not "detect").
- **Visual** (from `index.html`): warm near-black `--ink #0c0c0b`, pale `--bone #f4f1e9`, brass accent `--brass #c2a14e`, cream light surface `#e8e4d8`. Type: Fraunces (display serif), Geist (body), Geist Mono (data/labels). Motif: the scalloped wax Seal mark; grain overlay.

---

## 9. Product Documentation

- Studio: services described on homepage; no separate docs.
- Platform: `server/lib/seal.mjs` (hash/sign), `blobstore.mjs` (images). No public `/how-it-works` yet — candidate page explaining the crypto in plain English + FAQ.

---

## 10. Other Context

- **Strategy**: Two motions. Studio needs founder-led outbound + credibility (low-volume, high-value). Platform needs community cold-start; the wedge is the **false-AI-accusation** moment = SecurityArts is the receipt.
- **Timeline**: Post-launch; pre-Product-Hunt.
- **Constraints**: No pricing claims. Studio: don't promise "unhackable." Platform: a seal proves *a specific human sealed specific bytes at a specific time* — NOT originality or ownership; don't overstate detector-beating.
- **Brand risk**: one domain, two audiences. Keep homepage clearly studio-first; route artists cleanly to the platform. Decide whether the platform eventually gets its own subdomain/domain.

---

## 11. Content / Blog Strategy

- **A**: credibility content — attack write-ups (sanitized), "what a real pentest finds," SOC 2 readiness, secure-by-design. Non-SEO but trust-building; distribute on LinkedIn/X.
- **B**: ~70% evergreen SEO (how-to-prove-human, AI-accusation defense, provenance explainers), ~30% timely (AI-art news, build-in-public). Every article → "Seal your next piece."

---

## 12. Features vs Use Cases vs Solutions

- **A**: /services/[discipline] (features) · /for-[startups|enterprise] (solutions) · /use-cases/[soc2|funding|enterprise-deal].
- **B**: /features/[seal|verify] · /for-[illustrators|photographers] (use cases) · /prove-human-made, /defend-ai-accusation (solutions).

---

## 13. Optimization Priorities

| Priority | SEO | GEO | Content |
|----------|-----|-----|---------|
| **P0** | Flatten platform URLs (`/discover`, `/seal/:id`, `/@handle`); make seal + wall crawlable/indexable; keep sitemap fresh | how-it-works + FAQ in Q&A form | Studio "we sign our work" clarity; platform "how to prove your art is human" pillar |
| **P1** | Title/meta per page type; schema (`Service`/`Organization` for studio, `CreativeWork`/`FAQPage` for platform); OG + Twitter cards on seal pages | plain-English crypto explainer | comparison pages (vs detectors/C2PA) |
| **P2** | Internal links wall↔profile↔seal; decide subdomain split | — | per-medium/scenario pages |

---

## 14. Visual Identity

Colors: `--ink #0c0c0b`, `--ink-2 #131312`, `--cream #e8e4d8`, `--bone #f4f1e9`, `--bone-dim #a39e92`, accent `--brass #c2a14e` / `--brass-deep #9c7e34`. Type: Fraunces / Geist / Geist Mono. Grain overlay, scalloped Seal mark, sparing brass. (Full tokens in `index.html` `:root`.)

---

## Sub-documents (create as needed)

`securityarts-keywords.md` · `securityarts-competitors.md` · `securityarts-task-tracker.md`
