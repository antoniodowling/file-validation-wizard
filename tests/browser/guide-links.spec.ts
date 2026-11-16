import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const families = [
  { query: "pain.001", name: /pain\.001/i, slug: "iso-pain001", versions: ["pain.001.001.03"] },
  { query: "ACH Payment Instructions", name: /ACH Payment Instructions/i, slug: "nacha", versions: ["origination-expanded-public-2026-r2"] },
  { query: "Control Totals", name: /ACH Control Totals/i, slug: "ach-control-total-flat-file", versions: ["control-total-public-2026-r1"] },
];

for (const mount of ["standalone", "ReadMe package"]) {
  test(`guide links: every profile uses its Huntington family page in the ${mount}`, async ({ page }) => {
    await page.goto("/");
    if (mount === "ReadMe package") {
      await page.setContent('<main><div data-payment-file-validator data-file-explorer="true"></div></main>');
      await page.addStyleTag({ path: resolve(process.cwd(), "readme-package/custom-css.css") });
      await page.addScriptTag({ path: resolve(process.cwd(), "readme-package/custom-javascript.js") });
    }
    for (const family of families) {
      await page.getByRole("combobox", { name: "File format" }).fill(family.query);
      await page.getByRole("option", { name: family.name }).click();
      for (const version of family.versions) {
        await page.getByLabel("Version", { exact: true }).selectOption(version);
        const helper = page.locator('[id$="format-selection-help"]');
        await expect(helper.getByRole("link", { name: "General family guide", exact: true })).toHaveAttribute(
          "href", `https://developer.huntington.com/enterprisepayments/docs/${family.slug}`,
        );
        await expect(helper).not.toContainText("version applicability unverified");
      }
    }
  });
}
