import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("generated ReadMe package remains self-contained and scopes the explorer to the dedicated root", async () => {
  const [entry, script, stylesheet, page, installation] = await Promise.all([
    read("src/readme-entry.ts"),
    read("readme-package/custom-javascript.js"),
    read("readme-package/custom-css.css"),
    read("readme-package/custom-page.html"),
    read("readme-package/INSTALLATION.md"),
  ]);

  assert.equal(entry.match(/enableExplorer/g)?.length, 1);
  assert.match(entry, /enableExplorer:\s*legacy/u);
  assert.match(script, /File explorer/u);
  assert.match(script, /Read-only payment file source/u);
  assert.doesNotMatch(script, /\bimport\s*\(/u);
  assert.match(stylesheet, /:is\(#hnb-payment-file-validator, \[data-payment-file-validator\]\) \.file-explorer/u);
  assert.doesNotMatch(page, /<script\b/iu);
  assert.match(installation, /dedicated page only/iu);
});
