// Structural checks over every public page at the repo root. These catch damage a
// page generator can do without breaking how the page looks, e.g. a "$15" in a
// String.replace replacement being read as "$1" and pasting a whole tag into a
// meta description.
//   node --test scripts/pages.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const metaContent = (html, attr, name) =>
  [...html.matchAll(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`, "g"))].map((m) => m[1]);

test("there are pages to check", () => {
  assert.ok(PAGES.length >= 20, `found only ${PAGES.length} pages`);
});

for (const file of PAGES) {
  test(`${file}: no tag is pasted inside an attribute value`, () => {
    const bad = read(file).match(/="[^"]*<(meta|link|title|script|style)\b[^"]*"/);
    assert.equal(bad, null, bad && `broken attribute: ${bad[0].slice(0, 120)}`);
  });

  test(`${file}: one clean meta description`, () => {
    const found = metaContent(read(file), "name", "description");
    assert.equal(found.length, 1, `expected one description, found ${found.length}`);
    assert.ok(found[0].length >= 30, `description too short: "${found[0]}"`);
    assert.doesNotMatch(found[0], /[<>]/, "description contains markup");
  });

  test(`${file}: og:description matches the clean form`, () => {
    for (const og of metaContent(read(file), "property", "og:description")) {
      assert.doesNotMatch(og, /[<>]/, "og:description contains markup");
    }
  });
}
