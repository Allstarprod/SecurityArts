# SecurityArts redesign brief — 2026-09-21

Decided with Micah in a structured interview after five artist reviewers said the site "doesn't look like something an artist would use — no color, no fun; luxury is the wrong look." Micah: "the luxury-simplistic look was never something I liked." Goal: a full do-over of both products that shows the passion behind them.

## Decisions

| Branch | Decision |
|---|---|
| Scope | Full do-over, both products (studio + art platform) |
| Identity | One identity, **art leads**. Shared seal mark, logo, type, voice; studio is the same system run cooler. Design for the artist first, dial down for the studio — never the reverse. |
| Direction | **Vibrant editorial / magazine.** References: Love and Money (loud playful display type, saturated color, motion with personality) × Cosmos.so (image-first grid, quiet chrome, the work is the interface). Chrome is loud; the wall is reverent. |
| Canvas | Light warm base for the art platform; charcoal (not black) for the studio. Same three colors on both. |
| Name | Keep "SecurityArts" for both. |
| Palette | **Letterpress chop red** (chosen 2026-09-22; tangerine+violet rejected 2026-09-21). bg `#F5F4EF` paper · bg-2 `#D8E9F3` pale blue · ink `#171A1F` · act `#D42228` chop red (seal + primary action) · pop `#1585CF` process blue (sparingly) · studio `#241F21` warm charcoal. Red = the seal, historically (sealing wax, chop stamp). **Because red is the brand, errors need a distinct treatment** (icon + copy + outline, not just red text). |
| Type | Bold grotesk display + humanist body; mono only for hashes/signatures. Licensed face TBD (Söhne / GT America candidates, no preference yet) — **build on Instrument Sans + Inter at matched metrics, swap when licensed.** |
| Seal mark | **Keep the existing mark** (16-lobe scallop, ring, star). **THE seal = wax treatment** (`design-studies/stamp/wax.svg`): homepage hero, the Three.js object, certificate page. **Small sizes (58px badge, 24px nav, 16px favicon) = modernised** (12 lobes, heavier, optically-centred star). Ring text on the hero: **SEALED BY SECURITYARTS · SHA-256 · ECDSA P-256**. All six treatments are kept, each for a specific situation — see `design-studies/seal/`. Never replace the mark with a wordmark disc. |
| 3D on mobile | Interactive on desktop; **pre-rendered turntable fallback** on phones / reduced-motion / weak GPU. |
| Motion | A few signature moments: the stamp slam, page-load reveal, weighted hovers. Otherwise static. Respect `prefers-reduced-motion`. |
| Fun = | Real artwork everywhere as the visual system · the stamp as a character · playful microcopy · section background color shifts · one 3D object. |
| Homepage | **Layout resembles the ORIGINAL pre-redesign homepage** (Micah, 2026-09-22) — its section structure and composition, re-skinned in the letterpress palette (NOT the dark/brass look), with **full-bleed colour bands** between sections (from study A). Direction studies A/B/C were not chosen as layouts. **Resolved 2026-09-22:** original composition, **art-first order** (hero, wall and seal speak to artists; the studio is the second half). Study: `design-studies/original-reskin.html`. |
| Voice | **Big-hearted / earnest.** Headline: **"A receipt for your art."** Subline carries the mechanism. |
| Wall | One flowing masonry wall, newest first, every piece large. No filters until the volume needs them. |
| Profile | Fixed layout, their art fills it. No themes. |
| Stack | **Next.js** for pages (server-rendered `/seal/:id`, `/@handle`, `/discover`). **Node API in `server/` stays untouched** — `api/[...path].mjs` keeps serving `/api/*`; all 73 e2e + 27 unit tests remain valid. Retire the JSX-precompile pipeline and `SecurityArts Design System/` ui_kits. |
| Content pages | The 13 pages from PR #2 get **rewritten in the new voice** inside new layouts. Non-negotiable guardrails survive: the seal proves a specific account sealed these exact bytes at time T; it does not prove a human made it, does not prove originality, does not survive re-encoding/screenshots; no fabricated stats/testimonials/clients. JSON-LD carried forward. |
| Pricing | **Decided 2026-09-25 (Micah):** most features free; **Free · Pro $5/mo · Pro+ $15/mo**; yearly = two months free; **10%** fee on sales, **8%** on direct commissions; payouts within two business days once payments are live. Checking a seal is always free. No "Most popular" or other invented social proof. |
| Accounts | **Decided 2026-09-25:** sign-in moves to **Clerk** (Clerk's form, restyled in the letterpress palette). Existing accounts are **imported** into Clerk (external_id = our user id); passwords can't carry over, so people use an email code or reset. Runbook: `CLERK.md`. Switched on by env keys; the old routes close when it's on. |
| Order | 1. Direction studies (done: palette + seal chosen; layout = original structure + colour bands) → 2. 3D wax stamp prototype — **built + tuned 2026-09-22** (`design-studies/stamp3d/`) → 2b. Original homepage re-skinned art-first — **built, awaiting review** (`design-studies/original-reskin.html`) → 2c. Wall + join rebuilt as working studies (`design-studies/wall.html`, `join.html`) — **built 2026-09-23** → 2d. **Seal-a-piece (/create) next** (Micah, 2026-09-25) → 3. Homepage + wall + profile + seal page in Next.js → 4. Same 5 reviewers → 5. Studio + content pages. Each step gated on Micah's eyes. |
| Seeding | 20–40 real pieces sealed pre-launch by the reviewers + network; their work becomes the launch visuals. |
| Done | The same reviewers, **4 of 5 say "I'd use this."** |
| PR #2 | **Merge now**, redesign on top. Prereqs: `PUBLIC_BASE_URL` in Vercel env (preview API currently 500s without it), apply migration, rotate DB password + service_role key. |

## Reviewer signal
Looks only ("no color, no fun, luxury is wrong"). Inferred wants: see other artists' work (gallery is the draw, sealing is the utility); a profile good enough to link in a bio.

## Still open
- ~~Palette~~ → letterpress chop red, chosen 2026-09-22
- Which licensed font, and when (Micah buys; not before direction is proven)
- ~~Pricing~~ → decided 2026-09-25 (see Pricing row)
- Legal: operating company name/address and governing law for Terms and Privacy (drafts rewritten 2026-09-25; counsel review pending)
- Clerk production instance needs an owned domain (not *.vercel.app) — blocked on the canonical host
- Canonical host (vercel.app until securityarts.studio resolves)
