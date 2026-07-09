# Page build (`scripts/build-pages.mjs`)

Precompiles the Design System app pages so they load **without** the unpkg CDN or
in-browser Babel — the thing that caused silent black screens when a CDN request
failed. Also the reason the app pages now work offline and load instantly.

## Model

Each app page under `SecurityArts Design System/website/ui_kits/**` is:

```
<page>.html      the shell + <div id="root"> + local <script> tags
<page>.jsx       the app SOURCE  ← edit this
<page>.app.js    compiled output (React.createElement) ← generated, do not edit
```

At runtime the page loads locally vendored React + the DS bundle + `<page>.app.js`.
No `unpkg.com`, no `@babel/standalone`.

## Commands

```bash
npm install          # once — installs esbuild
npm run build        # compile every <page>.jsx → <page>.app.js
npm run build:check  # CI: fail if any .app.js is stale or a text/babel block remains
```

The build also verifies the vendored React files exist at
`SecurityArts Design System/website/assets/vendor/`:

- `react.production.min.js`
- `react-dom.production.min.js`

These are committed. To refresh them for a React upgrade:

```bash
curl -fsSL https://unpkg.com/react@18.3.1/umd/react.production.min.js \
  -o "SecurityArts Design System/website/assets/vendor/react.production.min.js"
curl -fsSL https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js \
  -o "SecurityArts Design System/website/assets/vendor/react-dom.production.min.js"
```

## Workflow

Edit a `.jsx`, run `npm run build`, commit both the `.jsx` and the regenerated
`.app.js`. CI (`build:check`) blocks a push where the two have drifted.

## Safety net

Every app page also loads `assets/failsafe.js`: if `#root` never mounts (any load
failure), it clears any stuck transition overlay and shows a visible "reload"
panel instead of a black screen. `assets/transition.js` additionally force-clears
its overlay after a grace period so a blocked navigation can't leave it stuck.
