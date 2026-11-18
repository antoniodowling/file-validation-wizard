import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const scenarios = [
  { query: "pain.001", version: "pain.001.001.09", file: "pain.001.001.09-fail-with-warnings.xml" },
  { query: "NACHA", version: "origination-expanded-public-2026-r2", file: "nacha-r2-fail-with-warnings.ach" },
];
for (const scenario of scenarios) test(`${scenario.query} keeps mixed warning/error findings under overall FAIL`, async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "File format" }).fill(scenario.query);
  await page.getByRole("option", { name: scenario.query === "NACHA" ? /ACH Payment Instructions/ : /Customer Credit Transfer Initiation/ }).click();
  await page.getByLabel("Version", { exact: true }).selectOption(scenario.version);
  await page.locator("#format-continue").click();
  await page.locator("#file-input").setInputFiles(resolve(`demo-files/mixed-findings/${scenario.file}`));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.locator("#error-count")).toHaveText("1");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (kind: string) => parts.find(part => part.type === kind)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const warningCount = scenario.query === "NACHA" && today > "2026-10-17" ? 2 : 1;
  await expect(page.locator("#warning-count")).toHaveText(String(warningCount));
  await page.locator('.filter-toggle[data-outcome="PASS"]').click();
  await expect(page.locator("#finding-rows tr")).toHaveCount(1 + warningCount);
  await expect(page.locator("#finding-rows .severity.error")).toHaveCount(1);
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCount(warningCount);
  await page.locator('.filter-toggle[data-outcome="ERROR"]').click();
  await expect(page.locator("#finding-rows tr")).toHaveCount(warningCount);
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCount(warningCount);
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await page.locator('.filter-toggle[data-outcome="ERROR"]').click();
  await page.locator('.filter-toggle[data-outcome="WARNING"]').click();
  await expect(page.locator("#finding-rows tr")).toHaveCount(1);
  await expect(page.locator("#finding-rows .severity.error")).toHaveCount(1);
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  const download = page.waitForEvent("download"); await page.locator("#export-json").click();
  const report = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
  expect(report.overallStatus).toBe("FAIL"); expect(report.errorCount).toBe(1); expect(report.warningCount).toBe(warningCount);
  expect(report.results.some((r: { outcome: string }) => r.outcome === "ERROR")).toBe(true);
  expect(report.results.some((r: { outcome: string }) => r.outcome === "WARNING")).toBe(true);
});
