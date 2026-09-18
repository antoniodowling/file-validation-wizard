import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("generated ReadMe package provides independent wizard and explorer pages from one shared bundle", async () => {
  const [entry, script, stylesheet, wizardPage, explorerPage, installation] = await Promise.all([
    read("src/readme-entry.ts"),
    read("readme-package/custom-javascript.js"),
    read("readme-package/custom-css.css"),
    read("readme-package/custom-page.html"),
    read("readme-package/custom-page-file-explorer.html"),
    read("readme-package/INSTALLATION.md"),
  ]);

  assert.equal(entry.match(/enableExplorer/g)?.length, 1);
  assert.match(entry, /enableExplorer:\s*root\.dataset\.fileExplorer\s*===\s*"true"/u);
  assert.match(script, /File explorer/u);
  assert.match(script, /Read-only payment file source/u);
  assert.doesNotMatch(script, /<!DOCTYPE|<!ENTITY/iu);
  assert.match(script, /\\x3c!DOCTYPE/u);
  assert.match(script, /\\x3c!ENTITY/u);
  assert.doesNotMatch(script, /\bimport\s*\(/u);
  assert.match(stylesheet, /:is\(#hnb-payment-file-validator, \[data-payment-file-validator\]\) \.file-explorer/u);
  assert.match(wizardPage, /id="hnb-payment-file-validator"/u);
  assert.doesNotMatch(wizardPage, /data-file-explorer/u);
  assert.match(explorerPage, /id="hnb-payment-file-validator-file-explorer"/u);
  assert.match(explorerPage, /data-file-explorer="true"/u);
  assert.doesNotMatch(wizardPage, /<script\b/iu);
  assert.doesNotMatch(explorerPage, /<script\b/iu);
  assert.match(installation, /custom-page-file-explorer\.html/u);
  assert.match(installation, /shared JavaScript and CSS/iu);
});
