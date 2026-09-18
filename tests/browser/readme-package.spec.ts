import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const packageFile = (name: string): string => resolve(process.cwd(), "readme-package", name);
const demoFile = (name: string): string => resolve(process.cwd(), "demo-files", name);

test("self-contained ReadMe package mounts on demand and validates locally", async ({ page }) => {
  await page.setContent("<main><p>Existing ReadMe page content</p></main>");
  await page.addStyleTag({ path: packageFile("custom-css.css") });
  await page.addScriptTag({ path: packageFile("custom-javascript.js") });

  await expect(page.locator("#format-search")).toHaveCount(0);
  await page.evaluate(() => {
    const root = document.createElement("div");
    root.id = "hnb-payment-file-validator";
    document.querySelector("main")?.append(root);
  });

  await expect(page.locator("#format-search")).toBeVisible();
  await page.locator("#format-search").focus();
  await expect(page.locator('#format-listbox [role="option"]')).toHaveCount(50);
  await page.locator("#format-search").fill("pain.001");
  await page.getByRole("option", { name: /pain\.001/i }).click();
  await page.locator("#version-select").selectOption("pain.001.001.09");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#file-input").setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  await page.getByRole("button", { name: "Validate file" }).click();

  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#finding-rows tr")).toHaveCount(11);
  await expect(page.getByText("Existing ReadMe page content")).toBeVisible();
});
