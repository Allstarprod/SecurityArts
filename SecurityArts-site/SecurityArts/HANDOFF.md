# SecurityArts — Frontend Package & Backend Handoff

**Phase 1 (frontend) is complete.** This document is the handoff for Phase 2 (backend).
Everything you need to wire a real backend to this frontend is below: the file map,
the exact client-side data shapes, and the proposed API endpoints that map 1:1 to the
places the frontend currently reads/writes `localStorage`.

---

## 1. What SecurityArts is

A brand and platform that **authenticates human-made digital art** to fight AI art.

- **Core promise:** every piece carries a **seal** — a cryptographic signature proving a
  human made it and letting anyone trace its origin.
- **Services:** (1) invisible/unremovable cryptographic signing of artwork,
  (2) "Verified Human-Made" badges + licensing.
- **Offer:** authentication at **$5–15/mo**, plus a marketplace for verified artists to
  sell directly to consumers/brands.
- **The website** is a Pinterest-style **visual discovery + bookmarking engine** for
  verified work, plus a marketplace.

---

## 2. File map

| File | Purpose | Notes |
|------|---------|-------|
| `index.html` | Marketing homepage | Self-contained (inline CSS + JS). Hero, practice, the seal, identity ("One logo. Any surface."), Discover band, standards, contact, **newsletter**, footer. |
| `discover.html` | **Discovery + bookmarking app** | Masonry "wall", search, category filters, **multiple named boards**, **artist upload + real cryptographic verification** modal. |
| `market.html` | **Marketplace** | Product grid, sort/filter, quick-view with **3 license tiers**, persistent **cart**, **checkout** + order confirmation. Merges in works published from Discover. |
| `HANDOFF.md` | This document | — |
| `CLAUDEwebdesign copy.md` | Original design brief | The rules the site was built to. |
| `.claude/launch.json` | Local dev-server config | `py -m http.server 8137`. |

**Why three self-contained files:** each page inlines its CSS/JS so it renders in any
context (static host, `file://`, preview panel) with **zero build step**. The tradeoff is
duplication (design tokens, the seal SVG, and the generative-art code are repeated per
file). See §7 for the recommended componentization when you move to a framework.

### Run locally
```
cd SecurityArts
py -m http.server 8137      # then open http://localhost:8137/index.html
```
(Or just double-click `index.html`.) Only external dependency: Google Fonts.

---

## 3. Feature inventory (what already works, client-side)

**Homepage** — responsive nav + mobile menu, scroll reveals, the seal as an animated
element, the brand "any surface" showcase, and a **newsletter signup** (validates, stores,
success/error states).

**Discover**
- 28 seeded works in a responsive masonry wall (generative art placeholders).
- Live **search** (title/artist/medium) + **category** chips.
- **Boards:** create/delete named boards, pick an active board, save pins into it, open a
  board to filter the wall. Persisted per-device.
- **Get verified** modal: drag-drop/browse an image → **real** SHA-256 hash + **real**
  ECDSA P-256 signature computed in-browser via the **Web Crypto API** → certificate →
  **Publish to the wall** (the work becomes verified, searchable, and appears in the
  marketplace).

**Marketplace**
- Product grid (curated catalog **+ Discover uploads merged in**), search, category, sort.
- **Quick view** with license tiers: **Personal / Commercial / Exclusive**.
- Persistent **cart** drawer → **checkout** (summary, email validation) → sealed **order
  confirmation** with an order ID. Cart clears on success.

---

## 4. Client-side data model (current `localStorage` schema)

This is the source of truth today. Mirror these shapes on the server.

```jsonc
// sa_uploads — works an artist published through Discover (verified)
[{
  "id": "u_ln3k9",              // unique
  "own": true,
  "title": "Low Tide, No.4",
  "artist": "Ines Vela",
  "cat": "painting",            // illustration|painting|3d|photography|lettering|concept|mixed
  "medium": "Oil on linen",
  "img": "data:image/jpeg;base64,…",   // downscaled preview (≤900px, q0.82)
  "cert": {                     // see §5
    "hash":   "…64 hex chars (SHA-256 of original file bytes)…",
    "sig":    "…128 hex chars (ECDSA P-256 signature)…",
    "signer": "sa:key:…24 hex…",
    "algo":   "ECDSA P-256 · SHA-256",
    "ts":     "2026-07-01T18:20:00.000Z"
  }
}]

// sa_boards — user's bookmark collections
[{ "id": "b_seed", "name": "Inspiration", "pins": ["p0","u_ln3k9"] }]

// sa_active — id of the board new saves target
"b_seed"

// sa_cart — marketplace cart
[{ "id": "p3", "license": "commercial" }]   // license: personal|commercial|exclusive

// sa_news — newsletter subscribers captured on this device
["artist@studio.com"]
```

**Catalog work shape** (currently generated client-side; replace with `GET /api/works`):
```jsonc
{
  "id": "p3", "cat": "3d", "medium": "3D render",
  "title": "The Long Field", "artist": "Kofi Mensah",
  "art": "<svg>…</svg>",       // generative placeholder; real works use "img"
  "price": { "personal": 180, "commercial": 540, "exclusive": 1620 }
}
```

---

## 5. The seal / verification (already real, not mocked)

On upload, the browser computes a genuine cryptographic seal — no server needed for the
demo:

1. `SHA-256` digest of the **original** file bytes (`crypto.subtle.digest`).
2. Generate an **ECDSA P-256** keypair (`crypto.subtle.generateKey`).
3. **Sign** the hash (`crypto.subtle.sign`).
4. Signer fingerprint = first 24 hex of `SHA-256(public key)`.

**For production the backend should own this** so the seal is trustworthy and checkable:
- Sign server-side with a **SecurityArts key** (or per-artist keys in an HSM/KMS), not an
  ephemeral browser key.
- Persist `{ hash, sig, signerKeyId, algo, ts, workId, artistId }` in a **public registry**.
- Expose `GET /api/verify/:hash` so anyone online can check provenance.
- The "invisible/unremovable" embedding (steganographic/C2PA-style metadata baked into the
  file) is the piece to build here — the frontend already models the certificate around it.

Find the code in `discover.html` → `sealFile()`. It has a graceful non-secure-context
fallback digest; production replaces the whole function with an API call.

---

## 6. Backend integration seams (drop-in points)

Every stateful action already funnels through a small function or a `localStorage` key, so
wiring the API is contained — not a rewrite.

| Feature | Client seam | Proposed endpoint(s) |
|---|---|---|
| Catalog | client-generated `products` / `seeded` | `GET /api/works?cat=&q=&sort=&page=` |
| Work detail | `findProduct(id)` | `GET /api/works/:id` |
| Upload + verify | `discover.html` → `sealFile()`, `SA.addUpload()` | `POST /api/works` (multipart) → server signs, returns cert |
| Public provenance | (new) | `GET /api/verify/:hash` |
| Boards | `SA.addBoard / removeBoard / setActive` | `GET/POST/DELETE /api/boards`, `PUT /api/boards/:id` |
| Save/unsave | `SA.toggle(workId, boardId)` | `POST/DELETE /api/boards/:id/pins` |
| Cart | `sa_cart`, `addToCart()` | `GET/POST/DELETE /api/cart` (or keep client-side; price server-verified) |
| Checkout | `market.html` → `placeOrder()` | `POST /api/checkout` (payment intent) → `POST /api/orders` |
| Orders | order confirmation view | `GET /api/orders/:id` |
| Newsletter | `index.html` → `#newsForm` handler → `sa_news` | `POST /api/newsletter { email }` |

**Also needed for the app phase (not yet in the frontend):**
- **Auth / accounts** — artists (upload, sell, get paid) and buyers (purchase, license).
- **Payments/payouts** — Stripe Connect or similar; the subscription tier ($5–15/mo) + marketplace take rate.
- **Subscriptions** — the authentication plan billing.
- **File storage** — originals + previews (S3/R2); the frontend currently stores a downscaled dataURL.

Response envelope suggestion (keep it consistent): `{ data, error, meta }`.

---

## 7. Design system (for when you componentize)

- **Type:** Fraunces (display serif), Geist (body), Geist Mono (labels) — Google Fonts.
- **Palette (CSS vars):** `--ink #0c0c0b`, `--bone #f4f1e9` (brand "Pale White"),
  `--brass #c2a14e` (single accent), `--cream #e8e4d8` (brand light surface),
  plus identity swatches (green/red/blue/gold/taupe). Full token block at the top of each
  file's `<style>`.
- **The seal:** an inline SVG `<symbol id="saSeal">` (scalloped rosette + ring + star).
  Identical in all three files — **extract to one shared component** first when migrating.
- **Generative art:** the placeholder tiles come from `mulberry32` seeded generators
  (`aField/aArcs/aBau/aPoster/aWaves/aHalf`), duplicated in `discover.html` + `market.html`.
  These are **placeholders** — real works replace them with uploaded images.

**Recommended migration:** React/Next (or your choice) with a shared `tokens.css`, a `<Seal/>`
component, a `works` API client, and the three surfaces as routes (`/`, `/discover`,
`/market`). The current files are the visual + interaction spec.

---

## 8. Placeholders to replace before launch

- Contact email `hello@securityarts.studio` and availability copy ("Q3 2026 — limited").
- Generative art tiles → real uploaded works.
- Artist names/titles in the seeded catalog are fictional demo data.
- Checkout is a **demo** (no real charge); order IDs are generated client-side.
- Fonts load from Google Fonts CDN — self-host for offline/perf if desired.

---

## 9. Roadmap

- [x] **Phase 1 — Frontend:** homepage, discovery+boards, verification UX, marketplace, newsletter.
- [ ] **Frameworks pass:** OWASP · MITRE ATT&CK · NIST CSF · ISO 27001 · SOC 2 · CIS —
      decide: customer-facing trust/compliance content **or** a hardening pass on the backend.
- [ ] **Phase 2 — Backend:** (this handoff) auth, works+registry, boards, cart/checkout,
      payments/subscriptions, newsletter, server-side signing.
- [ ] **Phase 3 — User scaling.**

---

*Built to `CLAUDEwebdesign copy.md`. Three static files, no build step, verified working
at 375 / 768 / 1024 / 1440px with the real Web Crypto verification flow functional.*
