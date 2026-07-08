# UI kit — Studio (marketing home)

A faithful recreation of the **SecurityArts studio homepage** — the security practice's marketing site — composed entirely from the design-system components.

- **Entry:** `index.html` (loads React, the compiled `_ds_bundle.js`, then `StudioApp.jsx`).
- **Source of truth:** `SecurityArts/index.html` in the provided codebase.

## Screens / sections
- **Sticky header** — brand lockup, mono nav with brass indices, `Request engagement` CTA. Gains a hairline border + stronger blur once scrolled (`stuck` state). Below 880px it collapses to a working full-screen **mobile menu**.
- **Hero** — light-weight Fraunces headline ("Security is a craft. We sign *our work*."), a large slowly-spinning seal bleeding off the right edge, lede + dual CTAs, and a hairline metadata footer.
- **Marquee** — endless serif ticker of the six disciplines.
- **Manifesto** ("00 Position") — the seal thesis, with a brass-underlined *seal*.
- **Practice** ("01") — a six-cell hairline grid of `PracticeCard`s (first is wide, last is the brass featured variant).
- **The Seal** ("02") — big spinning seal beside the verifiable/honest/durable points.
- **Identity** ("03") — the **light-flip** section (cream bg, jet ink): the one-ink-on-any-surface swatch grid + two lockups.
- **Standards** ("04") — the frameworks grid (OWASP, MITRE ATT&CK, NIST CSF, ISO 27001, SOC 2, CIS).
- **Contact** ("05") — oversized display type + mailto.
- **Newsletter** — validating email form (`Input` + `Button`) with success/error note.
- **Footer** — brand, cross-links to Discover/Market, roman-numeral colophon.

## Components used
`Seal`, `Marquee`, `Button`, `Eyebrow`, `SectionLabel`, `PracticeCard`, `Input`.

## Interactions
Scroll-driven header state · animated hamburger → full-screen menu · hover lifts and seal rotations · client-side newsletter validation. Layout CSS lives in `index.html`; all content and behavior in `StudioApp.jsx`.
