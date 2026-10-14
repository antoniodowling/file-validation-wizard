import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { resolve } from "node:path";

async function scan(page: Page, info: TestInfo): Promise<void> {
  // The embedding page owns the h1. All remaining rules, including contrast,
  // must report zero violations; retain the full report for inspection.
  const report = await new AxeBuilder({ page }).disableRules(["page-has-heading-one"]).analyze();
  await info.attach("accessibility.json", {
    body: JSON.stringify(report, null, 2), contentType: "application/json",
  });
  expect(report.violations).toEqual([]);
}

async function uploadStep(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#format-search").fill("pain.001");
  await page.getByRole("option", { name: /pain\.001/i }).click();
  await page.locator("#version-select").selectOption("pain.001.001.09");
  await page.getByRole("button", { name: "Continue" }).click();
}

test("accessibility: upload and invalid-extension error", async ({ page }, info) => {
  await uploadStep(page);
  await scan(page, info);
  await page.locator("#file-input").setInputFiles({ name: "wrong.pdf", mimeType: "application/pdf", buffer: Buffer.from("synthetic") });
  await expect(page.getByRole("alert")).toBeVisible();
  await scan(page, info);
});

for (const [fixture, outcome] of [
  ["pass", "PASS"],
  ["pass-with-warnings", "PASS WITH WARNINGS"],
  ["fail", "FAIL"],
  ["syntax-error", "FAIL"],
] as const) {
  test(`accessibility: results ${fixture}`, async ({ page }, info) => {
    await uploadStep(page);
    await page.locator("#file-input").setInputFiles(resolve(process.cwd(), "demo-files", `pain.001.001.09-${fixture}.xml`));
    await page.getByRole("button", { name: "Validate file" }).click();
    await expect(page.locator("#results-title")).toHaveText(outcome);
    await expect(page.locator(".cm-content")).toBeVisible();
    await scan(page, info);
  });
}

test("accessibility: worker startup failure", async ({ page }, info) => {
  await uploadStep(page);
  await page.locator("#file-input").setInputFiles(resolve(process.cwd(), "demo-files/pain.001.001.09-pass.xml"));
  await page.evaluate(() => { window.Worker = class { constructor() { throw new Error("Synthetic blocked worker"); } } as unknown as typeof Worker; });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator("#step-3-panel")).toBeHidden();
  await scan(page, info);
});
