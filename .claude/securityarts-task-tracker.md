# SecurityArts — marketing / SEO task tracker

**Last updated**: 2026-08-07 · Companion to [project-context.md](project-context.md).
Legend: ✅ done (local, undeployed) · 🔲 todo · 👤 needs you (assets/decisions) · ⏳ after deploy.

Two tracks: **A** = security studio (SLG) · **B** = art platform (PLG).

---

## Done this session (✅ — local, push to deploy)

| Item | Track | File |
|------|-------|------|
| Dual-product context | both | `.claude/project-context.md` |
| Homepage links → clean routes | both | `index.html` |
| Killed stale Q3 scarcity line | A | `index.html` |
| Clean-route rewrites (`/discover`,`/seal/:id`,`/verify`,`/login`,`/join`,`/create`,`/me`,`/pricing`,`/studio`,`/foryou`) | both | `vercel.json` |
| Seal page OG + Twitter + `CreativeWork` + dynamic clean canonical | B | `.../discover/seal.html` |
| `/how-it-works` page | B | `how-it-works.html` |
| `/faq` page + `FAQPage` schema | B | `faq.html` |
| `/services/penetration-testing` flagship + `Service`+`FAQPage` schema | A | `services-penetration-testing.html` |
| Homepage → pentest internal link (Offensive Security card) | A | `index.html` |
| Sitemap refreshed + new URLs | both | `sitemap.xml` |
| Launch posts (Reddit/Cara/X/PH) | B | `marketing/launch/posts.md` |

---

## Next code (🔲 — I can do)

- ✅ All 5 remaining studio discipline pages (`/services/application-security`, `/cloud-infrastructure`, `/detection-response`, `/security-architecture`, `/advisory-training`) — each with `Service`+`FAQPage` schema, homepage practice-card linked. Verified 200 + JSON-LD valid + render.
- ✅ `Organization` JSON-LD on homepage.
- 🔲 Dedicated art-platform landing (headline #2 "show the receipt") at `/verified` — currently only the homepage Discover band.
- 🔲 Wire remaining app-internal links (login/create/dashboard pages still use deep encoded paths between each other) to clean routes.
- 🔲 Comparison pages: vs AI detectors, vs C2PA, vs Not By AI.
- 🔲 Pillar article: "How to prove your art is human-made."

## Needs you (👤 — assets / decisions)

- 👤 Real proof points — client logos / sanitized results (A), works-sealed + artist counts (B). **No fabrication.**
- 👤 `og-image.png` at site root (referenced by all OG tags; confirm it exists / design 1200×630).
- 👤 Seed the wall with real striking sealed work before PH.
- 👤 PH gallery images 1270×760 + <2-min demo GIF of sealing a piece.
- 👤 200+ supporter list warmed 2–3 weeks pre-launch; launch Tue–Thu 12:01am PT.
- 👤 Decision: does the art platform get its own subdomain/domain vs staying under `/`.
- 👤 Confirm intended canonical domain (`securityarts.studio` in OG tags vs live `security-arts.vercel.app`) — pick one, 301 the other.

## After deploy (⏳ — verify on preview)

- ⏳ Confirm rewrites resolve: `/how-it-works`, `/faq`, `/discover`, `/verify`, `/seal/<id>`, `/services/penetration-testing`.
- ⏳ Submit `sitemap.xml` in Google Search Console; request indexing on the new pages.
- ⏳ Rich-results test on `/faq` + `/services/penetration-testing` (FAQ/Service schema).
- ⏳ Validate seal-page OG with a share-debugger (clean `/seal/<id>` canonical).

---

## SEO priorities (from context §13)

- **P0**: clean platform URLs (✅ routes shipped; ⏳ verify on deploy) · sitemap (✅) · how-it-works+FAQ Q&A for GEO (✅).
- **P1**: per-page title/meta (partial) · schema — `Service`/`Organization` (A), `CreativeWork`/`FAQPage` (B) (partial ✅) · OG/Twitter on seal pages (✅).
- **P2**: internal links wall↔profile↔seal · subdomain decision · per-medium/scenario pages.
