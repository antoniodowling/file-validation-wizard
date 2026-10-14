import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const families = [
  { query: "pain.001", name: /pain\.001/i, slug: "iso-pain001", versions: ["pain.001.001.03", "pain.001.001.09", "pain.001.001.13"] },
  { query: "pain.008", name: /pain\.008/i, slug: "iso-pain008", versions: ["pain.008.001.02", "pain.008.001.08", "pain.008.001.12"] },
  { query: "820", name: /820/i, slug: "edi-820", versions: ["004010", "005010", "008030"] },
  { query: "ACH Payment Instructions", name: /ACH Payment Instructions/i, slug: "nacha", versions: ["origination-public-2026", "origination-expanded-public-2026-r1", "origination-expanded-public-2026-r2"] },
  { query: "ACH Returns", name: /ACH Returns/i, slug: "nacha-returns", versions: ["returns-network-public-2026-r1"] },
  { query: "Control Totals", name: /ACH Control Totals/i, slug: "ach-control-total-flat-file", versions: ["control-total-public-2026-r1"] },
  { query: "ACK", name: /ACK/i, slug: "file-received-ack-flat-file", versions: ["pipe-1.0-candidate-r1"] },
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
