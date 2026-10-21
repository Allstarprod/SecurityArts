// Tests for the tokens.css generator.   npm run test:tokens
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCss } from "./build-tokens.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = JSON.parse(fs.readFileSync(path.join(HERE, "tokens.json"), "utf8"));

const block = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `missing block ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("every colour token is declared in the first theme, aliases as var()", () => {
  const css = buildCss(TOKENS);
  const paper = block(css, ':root, [data-theme="paper"]');
  for (const t of TOKENS.color.tokens) assert.match(paper, new RegExp(`--${t.name}: `), t.name);
  assert.match(paper, /--red: #d42228;/);
  assert.match(paper, /--surface: var\(--paper\);/);
  assert.match(paper, /color-scheme: light;/);
});

test("the studio theme redeclares only tokens that change", () => {
  const studio = block(buildCss(TOKENS), '[data-theme="studio"]');
  assert.match(studio, /--surface: var\(--studio\);/);
  assert.match(studio, /--text: var\(--paper\);/);
  assert.match(studio, /--text-soft: #cbc9c6;/);
  assert.match(studio, /color-scheme: dark;/);
  assert.doesNotMatch(studio, /--red:/);
});

test("fonts, spacing, radius, shadow and stroke land on :root", () => {
  const css = buildCss(TOKENS);
  for (const decl of ['--font-display: "Instrument Sans", system-ui, sans-serif;', "--space-stack: 1.3rem;", "--radius-pill: 100px;",
    "--shadow-lift: 0 18px 30px -12px rgba(23, 26, 31, 0.35);", "--stroke-control: 2px;", "--size-head: 68px;"]) {
    assert.ok(css.includes(decl), decl);
  }
});

test("bad input fails loudly instead of emitting broken CSS", () => {
  const withAlias = (value) => ({ ...TOKENS, color: { ...TOKENS.color, tokens: [...TOKENS.color.tokens, { name: "oops", value }] } });
  assert.throws(() => buildCss(withAlias("{missing}")), /unknown token "missing"/);
  assert.throws(() => buildCss(withAlias("red; } body { display:none")), /invalid value/);
  const dupe = { ...TOKENS, radius: { tokens: [...TOKENS.radius.tokens, { name: "red", value: "4px" }] } };
  assert.throws(() => buildCss(dupe), /duplicate token "red"/);
});

test("the committed tokens.css matches tokens.json", () => {
  const onDisk = fs.readFileSync(path.join(HERE, "tokens.css"), "utf8");
  assert.equal(onDisk, buildCss(TOKENS), "tokens.css is stale: run npm run tokens");
});
