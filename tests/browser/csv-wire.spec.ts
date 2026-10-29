import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const mount of ["standalone", "ReadMe package"]) test(`CSV Wire local input, findings and exports in ${mount}`, async ({ page }, testInfo) => {
  const leaked: string[] = [];
  page.on("request", request => { if (/SYNTHETIC|99999999999/.test(request.url() + (request.postData() ?? ""))) leaked.push(request.url()); });
  await page.goto("/");
  if (mount === "ReadMe package") {
    await page.setContent('<main><div data-payment-file-validator data-file-explorer="true"></div></main>');
    await page.addStyleTag({ path: resolve("readme-package/custom-css.css") });
    await page.addScriptTag({ path: resolve("readme-package/custom-javascript.js") });
  }
  const selector = (id: string) => page.locator(`[id$="${id}"]`);
  await page.getByRole("combobox", { name: "File format" }).fill("CSV Wire");
  await page.getByRole("option", { name: /CSV Wire/i }).click();
  await page.getByLabel("Version", { exact: true }).selectOption("huntington-csv-wire-public-2026-r1");
  await expect(selector("format-selection-help")).toContainText("54-field domestic");
  await expect(page.getByRole("link", { name: "General family guide", exact: true })).toHaveAttribute("href", "https://developer.huntington.com/enterprisepayments/docs/wires-payments-automation");
  await selector("format-continue").click();
  await expect(selector("file-input")).toHaveAttribute("accept", ".csv,.txt");
  for (const file of ["domestic-pass.csv", "international-usd-pass.csv", "quoted-comma-pass.csv"]) {
    await selector("file-input").setInputFiles(resolve(`demo-files/csv-wire/${file}`));
    await page.getByRole("button", { name: "Validate file" }).click();
    await expect(selector("results-title")).toHaveText("PASS");
    await expect(selector("result-basis")).toContainText("Candidate checks only");
    if (file === "international-usd-pass.csv") {
      const download = page.waitForEvent("download"); await selector("export-json").click();
      const json = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
      expect(json.exportSchemaVersion).toBe("4"); expect(json.provenance.profileId).toBe("huntington-csv-wire-public-2026-r1");
      expect(json.provenance.exclusions.join(" ")).toContain("Non-USD timing");
      expect(json.checks.every((c: { state: string }) => ["passed", "not-applicable"].includes(c.state))).toBe(true);
    }
    await page.getByRole("button", { name: "Back to file" }).click();
  }
  await selector("file-input").setInputFiles(resolve("demo-files/csv-wire/amount-fail.csv"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("FAIL");
  await page.locator('.filter-toggle[data-outcome="PASS"]').click();
  await selector("finding-rows").locator("tr").filter({ hasText: "Payment Amount" }).first().getByRole("button", { name: /View/ }).click();
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).toContainText("Amount requires digits");
  await expect(page.locator("[data-file-explorer] .cm-finding-error").first()).toBeAttached();
  const csvDownload = page.waitForEvent("download"); await selector("export-csv").click();
  const csv = readFileSync((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain("wire.amount"); expect(csv).toContain("huntington-csv-wire-candidate-1.1.0");
  await testInfo.attach(`${mount}-csv-wire-finding`, { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Back to file" }).click();
  await selector("file-input").setInputFiles(resolve("demo-files/csv-wire/cad-unsupported.csv"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("UNSUPPORTED");
  await expect(selector("result-basis")).toContainText("Non-USD currency");
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).not.toContainText("Amount requires digits");
  await page.getByRole("button", { name: "Back to file" }).click();
  await selector("file-input").setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from([0xff]) });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("upload-error")).toContainText(/UTF-8/);
  expect(leaked).toEqual([]);
});
