import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validEdi820 } from "../helpers";

for (const mount of ["standalone", "ReadMe package"]) {
  for (const terminator of ["~", "\n", "\r"]) {
    test(`005010 terminator ${JSON.stringify(terminator)} in ${mount}`, async ({ page }) => {
      await page.goto("/");
      if (mount === "ReadMe package") {
        await page.setContent('<main><div data-payment-file-validator data-file-explorer="true"></div></main>');
        await page.addStyleTag({ path: resolve("readme-package/custom-css.css") });
        await page.addScriptTag({ path: resolve("readme-package/custom-javascript.js") });
      }
      const selector = (id: string) => page.locator(`[id$="${id}"]`);
      await page.getByRole("combobox", { name: "File format" }).fill("820");
      await page.getByRole("option", { name: /ASC X12.*820.*Payment Order/i }).click();
      await page.getByLabel("Version", { exact: true }).selectOption("005010");
      await selector("format-continue").click();
      const source = validEdi820.replaceAll("~", terminator);
      await selector("file-input").setInputFiles({ name: "synthetic.edi", mimeType: "text/plain", buffer: Buffer.from(source) });
      await page.getByRole("button", { name: "Validate file" }).click();
      await expect(selector("results-title")).toHaveText("PASS");
      await page.getByRole("button", { name: "Back to file" }).click();
      await selector("file-input").setInputFiles({ name: "missing-final.edi", mimeType: "text/plain", buffer: Buffer.from(source.slice(0, -1)) });
      await page.getByRole("button", { name: "Validate file" }).click();
      await expect(selector("results-title")).toHaveText("FAIL");
    });
  }
}

test("008030 containment displays and exports no verdict with its qualification reason", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "File format" }).fill("820");
  await page.getByRole("option", { name: /ASC X12.*820.*Payment Order/i }).click();
  await page.getByLabel("Version", { exact: true }).selectOption("008030");
  await page.locator("#format-continue").click();
  await page.locator("#file-input").setInputFiles({ name: "unqualified.edi", mimeType: "text/plain", buffer: Buffer.from(validEdi820.replaceAll("005010", "008030")) });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("UNSUPPORTED");
  await expect(page.locator("#result-basis")).toContainText("unqualified");
  const download = page.waitForEvent("download");
  await page.locator("#export-json").click();
  const report = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(report.verdict).toBeNull();
  expect(report.executionReason).toContain("008030");
  expect(report.provenance.rulesetRevision).toBe("2.1.0");
});
