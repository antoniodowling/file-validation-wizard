import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const baseline = readFileSync(resolve("tests/fixtures/pain001-03-schema-valid.xml"), "utf8");
const messageIdAdvice = "Exactly one MsgId element with 1 to 35 characters and a nonblank value is required.";

async function validatePain00103(page: Page, name: string, source: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("combobox", { name: "File format" }).fill("pain.001");
  await page.getByRole("option", { name: /Customer Credit Transfer Initiation/ }).click();
  await page.getByLabel("Version", { exact: true }).selectOption("pain.001.001.03");
  await page.locator("#format-continue").click();
  await page.locator("#file-input").setInputFiles({ name, mimeType: "application/xml", buffer: Buffer.from(source) });
  await page.getByRole("button", { name: "Validate file" }).click();
}

test("PAIN.001.001.03 rejects a 36-character MsgId and navigates to its exact source", async ({ page }) => {
  const element = `<MsgId>${"A".repeat(36)}</MsgId>`;
  const source = baseline.replace("<MsgId>AUDIT-001</MsgId>", element);
  await validatePain00103(page, "synthetic-overlength-message-id.xml", source);

  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.locator("#error-count")).toHaveText("1");
  await expect(page.locator("#warning-count")).toHaveText("0");
  const finding = page.locator("#finding-rows tr").filter({ hasText: messageIdAdvice });
  await expect(finding.locator(".severity.error")).toHaveText("ERROR");
  await expect(finding.locator(".finding-line")).toHaveText("5");
  await finding.getByRole("button", { name: "View in file" }).click();

  const explorer = page.getByRole("complementary", { name: "File explorer" });
  await expect(explorer).toBeVisible();
  await expect(explorer.locator("[data-detail-rule]")).toHaveText("iso.message-id");
  await expect(explorer.locator("[data-detail-locator]")).toHaveText("/Document/CstmrCdtTrfInitn/GrpHdr/MsgId");
  await expect(explorer.locator("[data-detail-confidence]")).toContainText("exact: Element MsgId");
  await expect(explorer.locator("[data-detail-message]")).toHaveText(messageIdAdvice);
  await expect(explorer.locator(".cm-finding-error")).toHaveText(element);
});

test("PAIN.001.001.03 accepts a declaration-free file without a warning", async ({ page }) => {
  await validatePain00103(page, "synthetic-no-declaration.xml", baseline.replace(/^<\?xml[^?]*\?>\s*/, ""));

  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#error-count")).toHaveText("0");
  await expect(page.locator("#warning-count")).toHaveText("0");
});

test("PAIN.001.001.03 navigates to missing creation-date group context", async ({ page }) => {
  const source = baseline.replace(/\s*<CreDtTm>[^<]*<\/CreDtTm>/, "");
  await validatePain00103(page, "synthetic-missing-creation-date.xml", source);
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.locator("#error-count")).toHaveText("1");
  const finding = page.locator("#finding-rows tr").filter({ hasText: "nonempty scalar CreDtTm" });
  await expect(finding).toBeVisible();
  await finding.getByRole("button", { name: "View in file" }).click();
  const explorer = page.getByRole("complementary", { name: "File explorer" });
  await expect(explorer.locator("[data-detail-rule]")).toHaveText("iso.creation-date-time");
  await expect(explorer.locator("[data-detail-confidence]")).toContainText("context");
});
