// Builds design-system/tokens.css from design-system/tokens.json.
//   npm run tokens          write tokens.css
//   npm run tokens:check    exit 1 if tokens.css is out of date
// tokens.json uses the same shape as the "SecurityArts Letterpress" design system
// (every family a list of {name, value, usage}; colours may be per theme or "{alias}").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, "tokens.json");
const TARGET = path.join(HERE, "tokens.css");

const NAME = /^[a-z0-9][a-z0-9-]*$/i;
const COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?)\([0-9.,%\s/]+\))$/i;
const PLAIN = /^[A-Za-z0-9 #%(),./+-]+$/;        // lengths, shadows: no ; { } < > quotes
const FAMILY = /^[A-Za-z0-9 ,"'_-]+$/;            // font stacks
const ALIAS = /^\{([^{}]+)\}$/;
const NON_COLOR_SKIP = new Set(["name", "version", "color", "type", "meta"]);

function checkName(name, seen) {
  if (!NAME.test(name)) throw new Error(`invalid token name "${name}"`);
  if (seen.has(name)) throw new Error(`duplicate token "${name}"`);
  seen.add(name);
}

function colorValue(raw, colorNames, name) {
  const alias = ALIAS.exec(raw);
  if (alias) {
    if (!colorNames.has(alias[1])) throw new Error(`unknown token "${alias[1]}" in ${name}`);
    if (alias[1] === name) throw new Error(`token "${name}" aliases itself`);
    return `var(--${alias[1]})`;
  }
  if (!COLOR.test(raw)) throw new Error(`invalid value for ${name}: ${raw}`);
  return raw.toLowerCase();
}

function plainValue(raw, name, pattern = PLAIN) {
  const value = String(raw);
  if (!pattern.test(value)) throw new Error(`invalid value for ${name}: ${value}`);
  return value;
}

export function buildCss(tokens) {
  const seen = new Set();
  const themes = tokens.color.themes.map((t) => t.id);
  const [first, ...others] = themes;
  const colorNames = new Set(tokens.color.tokens.map((t) => t.name));

  // Colours: first theme on :root; later themes redeclare only what differs.
  const perTheme = Object.fromEntries(themes.map((id) => [id, []]));
  for (const t of tokens.color.tokens) {
    checkName(t.name, seen);
    const byTheme = typeof t.value === "string" ? { [first]: t.value } : t.value;
    const base = colorValue(byTheme[first] ?? Object.values(byTheme)[0], colorNames, t.name);
    perTheme[first].push(`  --${t.name}: ${base};`);
    for (const id of others) {
      if (byTheme[id] === undefined) continue;
      const v = colorValue(byTheme[id], colorNames, t.name);
      if (v !== base) perTheme[id].push(`  --${t.name}: ${v};`);
    }
  }

  // Everything else is theme-less and lives on :root.
  const rest = [];
  for (const [key, stack] of Object.entries(tokens.type?.families ?? {})) {
    rest.push(`  --font-${key}: ${plainValue(stack, `font ${key}`, FAMILY)};`);
  }
  for (const [family, group] of Object.entries(tokens)) {
    if (NON_COLOR_SKIP.has(family) || !Array.isArray(group?.tokens)) continue;
    for (const t of group.tokens) {
      checkName(t.name, seen);
      rest.push(`  --${t.name}: ${plainValue(t.value, t.name)};`);
    }
  }

  const out = [
    `/* ${tokens.name} — generated from tokens.json. Edit tokens.json, then run \`npm run tokens\`. */`,
    `/* Themes: ${themes.join(", ")} (default ${first}). Set data-theme="${others[0] ?? first}" on any element to switch. */`,
    "",
    `:root, [data-theme="${first}"] {`,
    ...perTheme[first],
    "  color-scheme: light;",
    "}",
  ];
  for (const id of others) out.push("", `[data-theme="${id}"] {`, ...perTheme[id], "  color-scheme: dark;", "}");
  out.push("", ":root {", ...rest, "}", "");
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = buildCss(JSON.parse(fs.readFileSync(SOURCE, "utf8")));
  if (process.argv.includes("--check")) {
    const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (current !== css) {
      console.error("design-system/tokens.css is out of date. Run: npm run tokens");
      process.exit(1);
    }
    console.log("design-system/tokens.css is up to date.");
  } else {
    fs.writeFileSync(TARGET, css);
    console.log(`Wrote design-system/tokens.css (${css.split("\n").filter((l) => l.startsWith("  --")).length} tokens).`);
  }
}
