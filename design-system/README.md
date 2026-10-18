# SecurityArts Letterpress — tokens

The colours, fonts, spacing, radii, shadows and borders of the letterpress design, in one place. It replaces the old dark look in `SecurityArts Design System/`.

| File | What |
| --- | --- |
| `tokens.json` | The source. Edit this. Same shape and values as the "SecurityArts Letterpress" design system artifact. |
| `tokens.css` | Generated CSS custom properties. Never edit by hand. |
| `build-tokens.mjs` | Turns `tokens.json` into `tokens.css`. |

## Use

```html
<link rel="stylesheet" href="/design-system/tokens.css">
```

`design-studies/site.css` already imports it, so the rebuilt wall, join and seal-a-piece pages read from it. Only `tokens.css` is served; the server's static allowlist keeps the rest of this folder private.

Two themes: `paper` (the art platform, the default) and `studio` (warm charcoal). Put `data-theme="studio"` on any element to switch that part of the page. Style with the semantic tokens (`--surface`, `--text`, `--text-soft`, `--line`, `--action`, `--focus`) so both themes work; the brand colours (`--red`, `--paper`, `--ink`, `--sky`, `--studio` …) never change.

## Change a value

1. Edit `tokens.json`.
2. `npm run tokens` to regenerate `tokens.css`.
3. `npm run test:tokens` (also fails if `tokens.css` is stale), or `npm run tokens:check` on its own.

Keep the design system artifact in step with `tokens.json` when a value changes.
