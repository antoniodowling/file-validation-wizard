import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const mount of ["standalone", "ReadMe package"]) test(`BAI2 upload, source navigation and exports in ${mount}`, async ({ page }) => {
  const leaked: string[] = [];
  page.on("request", request => {
    if ((request.postData() ?? "").includes("SYNTHETIC-SENDER") || request.url().includes("SYNTHETIC-SENDER")) leaked.push(request.url());
  });
  await page.goto("/");
  if (mount === "ReadMe package") {
    await page.setContent('<main><div data-payment-file-validator data-file-explorer="true"></div></main>');
    await page.addStyleTag({ path: resolve(process.cwd(), "readme-package/custom-css.css") });
    await page.addScriptTag({ path: resolve(process.cwd(), "readme-package/custom-javascript.js") });
  }
  const selector = (id: string) => page.locator(`[id$="${id}"]`);
  await page.getByRole("combobox", { name: "File format" }).fill("BAI2");
  await page.getByRole("option", { name: /BAI2/i }).click();
  await page.getByLabel("Version", { exact: true }).selectOption("huntington-bai2-public-2026-r1");
  await expect(selector("format-selection-help")).toContainText("Funds availability layouts");
  await expect(page.getByRole("link", { name: "General family guide", exact: true })).toHaveAttribute("href", "https://developer.huntington.com/enterprisepayments/docs/bai2");
  await selector("format-continue").click();
  await selector("file-input").setInputFiles(resolve(process.cwd(), "demo-files/bai2/balances-pass.bai2"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("PASS");
  await expect(selector("result-basis")).toContainText("Candidate checks only");
  const download = page.waitForEvent("download"); await selector("export-json").click();
  const json = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(json.exportSchemaVersion).toBe("4"); expect(json.provenance.profileId).toBe("huntington-bai2-public-2026-r1");
  expect(json.provenance.exclusions.join(" ")).toContain("Nonempty funds layouts");
  await page.getByRole("button", { name: "Back to file" }).click();
  await selector("file-input").setInputFiles(resolve(process.cwd(), "demo-files/bai2/account-total-fail.bai2"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("FAIL");
  await page.locator('.filter-toggle[data-outcome="PASS"]').click();
  await selector("finding-rows").locator("tr").filter({ hasText: "Account control total" }).first().getByRole("button", { name: /View/ }).click();
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).toContainText("Account control total");
  const csvDownload = page.waitForEvent("download"); await selector("export-csv").click();
  const csv = readFileSync((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain("bai2.account-total"); expect(csv).toContain("huntington-bai2-candidate-1.1.0");
  await page.getByRole("button", { name: "Back to file" }).click();
  const original = readFileSync(resolve(process.cwd(), "demo-files/bai2/balances-pass.bai2"), "utf8");
  await selector("file-input").setInputFiles({ name: "synthetic-plus.bai2", mimeType: "text/plain", buffer: Buffer.from(original.replace("010,100", "010,+100").replaceAll(",370,", ",+370,")) });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("PASS");
  await page.getByRole("button", { name: "Back to file" }).click();
  await selector("file-input").setInputFiles({ name: "synthetic-negative-detail.bai2", mimeType: "text/plain", buffer: Buffer.from(original.replace("16,206,50", "16,206,-50").replaceAll(",370,", ",270,")) });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("FAIL");
  await selector("finding-rows").locator("tr").filter({ hasText: "never a minus sign" }).first().getByRole("button", { name: /View/ }).click();
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).toContainText("never a minus sign");
  await page.getByRole("button", { name: "Back to file" }).click();
  await selector("file-input").setInputFiles(resolve(process.cwd(), "demo-files/bai2/funds-unsupported.bai2"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(selector("results-title")).toHaveText("UNSUPPORTED");
  await expect(selector("result-basis")).toContainText("funds availability fields");
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).not.toContainText("Account control total");
  expect(leaked).toEqual([]);
});
