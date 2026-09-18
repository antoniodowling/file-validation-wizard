import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { resolve } from "node:path";

const demoFile = (name: string): string => resolve(process.cwd(), "demo-files", name);

async function chooseFormat(page: Page, query: string, optionName: RegExp, version: string): Promise<void> {
  const search = page.locator("#format-search");
  await search.fill(query);
  await page.getByRole("option", { name: optionName }).click();
  await page.locator("#version-select").selectOption(version);
}

async function openXmlUpload(page: Page, code: "pain.001" | "pain.008", version: string): Promise<void> {
  await chooseFormat(page, code, new RegExp(code.replace(".", "\\."), "i"), version);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("starts with format search and keeps later-step messaging inside its step", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".validator-primary > :first-child")).toHaveClass(/steps/);
  await expect(page.locator(".intro, .eyebrow, .lede")).toHaveCount(0);
  await expect(page.locator(".step-number").first()).toHaveCSS(
    "clip-path",
    "polygon(25% 0px, 75% 0px, 100% 50%, 75% 100%, 25% 100%, 0px 50%)",
  );
  await expect(page.locator(".step-number").first()).toHaveCSS("width", "32px");
  await expect(page.locator(".step-number").first()).toHaveCSS("height", "28px");
  await expect(page.locator(".accordion-trigger .step-number")).toHaveCount(0);
  await expect(page.locator(".accordion-trigger .big-number")).toHaveCount(3);
  await expect(page.locator('[data-open-step="1"] .big-number')).toHaveText("01");
  await expect(page.locator('[data-open-step="2"] .big-number')).toHaveText("02");
  await expect(page.locator('[data-open-step="3"] .big-number')).toHaveText("03");
  await expect(page.locator('[data-open-step="1"] .big-number')).toHaveCSS("font-size", "32px");
  await expect(page.locator('[data-open-step="1"] .big-number')).toHaveCSS("letter-spacing", "0.32px");
  await expect(page.locator('.steps [data-step="3"] .step-number > span')).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, -1)",
  );
  await expect(page.locator('.steps [data-step="3"] strong')).toHaveText("View results");
  await expect(page.getByRole("button", { name: "View results" })).toBeDisabled();
  await expect(page.getByText(/^Step [123]$/)).toHaveCount(0);
  await expect(page.locator(".demo-notice, .step-summary, .readiness-disclaimer")).toHaveCount(0);
  await expect(page.getByText("Use non-sensitive test data only")).toHaveCount(0);
  await expect(page.locator("#version-select")).toBeDisabled();
  await expect(page.locator("#version-select option")).toHaveText("Select a file format");
  await expect(page.locator("#version-select")).toHaveCSS("padding-right", "40px");
  await expect(page.locator("#version-select")).toHaveCSS("background-image", /data:image\/svg\+xml/);
  await expect(page.locator("#format-selection-help")).toBeHidden();
  await expect(page.locator("#version-field")).toHaveClass(/disabled/);
  await expect(page.locator("#step-1-panel")).toBeVisible();
  await expect(page.locator("#step-2-panel")).toBeHidden();
  await expect(page.locator('[data-open-step="2"]').first()).toBeDisabled();

  await page.locator("#format-search").focus();
  await expect(page.locator("#format-search")).toHaveCSS("outline-style", "none");
  await expect(page.locator("#format-search")).toHaveCSS("box-shadow", /rgb\(3, 79, 84\).*inset/);
  await expect(page.locator('#format-listbox [role="option"]')).toHaveCount(50);
  await expect(page.locator(".format-list-header")).toHaveText("FormatCodeStandard");
  await expect(page.locator(".support-badge")).toHaveCount(0);
  await expect(page.locator('#format-listbox [role="option"]').first().locator("span")).toHaveCount(3);
});

test("supports keyboard search and dependent version selection", async ({ page }) => {
  await page.goto("/");
  const search = page.locator("#format-search");
  await search.fill("customer credit transfer");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue(/pain\.001/);
  await expect(page.locator("#version-select")).toBeEnabled();
  await expect(page.locator("#version-select option")).toHaveCount(4);
  await expect(page.getByText("Choose a version to see accepted extensions.")).toHaveCount(0);
  await expect(page.getByText("Search ISO 20022, SWIFT MT, ASC X12, and Nacha ACH formats.")).toHaveCount(0);

  await page.locator("#version-select").selectOption("pain.001.001.13");
  await expect(page.locator("#format-selection-help")).toHaveText("See File Format Guide and sample file");
  await expect(page.locator("#format-selection-help")).not.toContainText("Accepted extensions");
  await expect(page.getByRole("link", { name: "File Format Guide" })).toHaveAttribute(
    "href",
    "https://developer.huntington.com/enterprisepayments/docs/iso-pain001",
  );
  await expect(page.getByRole("link", { name: "File Format Guide" })).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "sample file" })).toHaveAttribute(
    "href",
    "https://developer.huntington.com/enterprisepayments/docs/iso-pain001#sample-file",
  );
  await expect(page.getByRole("link", { name: "sample file" })).toHaveAttribute("target", "_blank");
  await expect(page.locator("#format-detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue" })).toContainText("→");
  const alignment = await page.evaluate(() => {
    const search = document.querySelector("#format-search")!.getBoundingClientRect();
    const version = document.querySelector("#version-select")!.getBoundingClientRect();
    const button = document.querySelector("#format-continue")!.getBoundingClientRect();
    return {
      searchHeight: search.height,
      versionHeight: version.height,
      buttonHeight: button.height,
      searchTop: search.top,
      versionTop: version.top,
      buttonTop: button.top,
    };
  });
  expect(alignment.versionHeight).toBe(alignment.searchHeight);
  expect(alignment.buttonHeight).toBe(alignment.searchHeight);
  expect(Math.abs(alignment.versionTop - alignment.searchTop)).toBeLessThan(1);
  expect(Math.abs(alignment.buttonTop - alignment.searchTop)).toBeLessThan(1);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#step-1-panel")).toBeHidden();
  await expect(page.locator("#step-2-panel")).toBeVisible();
  await expect(page.locator("#file-input")).toHaveAttribute("accept", ".xml");
  await expect(page.getByText("Maximum size: 25MB")).toBeVisible();
  await expect(page.getByText("Use test data only")).toBeVisible();
  await expect(page.getByText(
    "Selected files are never uploaded to Huntington, but using sensitive data is never advised.",
  )).toBeVisible();
  await expect(page.locator(".safety-notice")).toHaveCSS("background-color", "rgb(255, 251, 235)");
  await expect(page.locator(".safety-notice")).toHaveCSS("border-left-color", "rgb(204, 163, 0)");
  await expect(page.locator(".safety-notice")).toHaveCSS("border-radius", "0px");
  await expect(page.locator(".safety-notice")).toHaveCSS("padding-top", "16px");
  await expect(page.locator(".safety-notice")).toHaveCSS("padding-bottom", "16px");
  await expect(page.locator(".notice-icon")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".notice-icon")).toHaveCSS("color", "rgb(109, 89, 10)");
  await expect(page.locator(".notice-icon svg.bi-exclamation-triangle")).toHaveCount(1);
  await expect(page.locator("#upload-title")).toHaveText("Upload your pain.001.001.13 file");
  await expect(page.locator("#accepted-extensions + .helper")).toHaveText("Maximum size: 25MB");
  await expect(page.getByRole("button", { name: /Change format/ })).toContainText("←");
  await expect(page.getByRole("button", { name: /Validate file/ })).toContainText("→");
});

test("lets users explore reference formats without advancing", async ({ page }) => {
  await page.goto("/");
  await chooseFormat(page, "MT940", /MT940.*Customer Statement/i, "sr2025");
  await expect(page.getByText("Accepted extensions: FIN, MT, TXT")).toBeVisible();
  await expect(page.getByText("Reference only — validation is unavailable in this demo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  await expect(page.locator('[data-open-step="2"]').first()).toBeDisabled();
});

test("enforces extensions dynamically and preserves a valid file after an invalid replacement", async ({ page }) => {
  await page.goto("/");
  await chooseFormat(page, "820", /ASC X12.*820.*Payment Order/i, "005010");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Accepted file types: EDI, X12, 820, TXT")).toBeVisible();

  await page.locator("#file-input").setInputFiles({
    name: "wrong.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<Document/>")
  });
  await expect(page.getByRole("alert")).toContainText("Choose EDI, X12, 820, TXT");
  await expect(page.locator("#selected-file")).toBeHidden();

  await page.locator("#file-input").setInputFiles({
    name: "payment.edi",
    mimeType: "text/plain",
    buffer: Buffer.from("demo")
  });
  await expect(page.locator("#file-name")).toHaveText("payment.edi");
  await expect(page.locator("#file-extension")).toHaveText(".EDI");

  await page.locator("#file-input").setInputFiles({
    name: "replacement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not valid")
  });
  await expect(page.locator("#file-name")).toHaveText("payment.edi");
});

test("validates a matching PAIN profile and opens Results", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.13");
  await page.locator("#file-input").setInputFiles({
    name: "credit-transfer.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(`<?xml version="1.0"?>
      <Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.13">
        <CstmrCdtTrfInitn>
          <GrpHdr><MsgId>DEMO-1</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>
          <PmtInf><PmtInfId>PAY-1</PmtInfId></PmtInf>
        </CstmrCdtTrfInitn>
      </Document>`),
  });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#step-3-panel")).toBeVisible();
  await expect(page.getByText("Validation Summary")).toBeVisible();
  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#result-meta")).toHaveCount(0);
  await expect(page.locator("#result-basis")).toHaveText(
    "This result is based on syntax and structure checks. It does not guarantee that Huntington will accept, process, or execute the file.",
  );
  await expect(page.locator(".metrics strong")).toHaveText(["Errors", "Warnings", "Pass"]);
  await expect(page.locator("#pass-count")).toHaveText("11");
  await expect(page.locator(".findings-heading")).toHaveCount(0);
  await expect(page.getByText("Validation findings", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Details", { exact: true })).toHaveCount(0);
  await expect(page.locator("#results-pagination")).toBeHidden();
  await expect(page.locator(".results-actions #export-csv")).toBeVisible();
  await expect(page.getByRole("button", { name: /Back to file/ })).toContainText("←");
  await expect(page.locator("#finding-rows .severity.pass")).toHaveCount(11);
  await expect(page.locator("#finding-rows .severity.pass").first()).toHaveText("PASS");
  await expect(page.locator("#finding-rows .severity.pass").first()).toHaveCSS("background-color", "rgb(242, 250, 232)");
  await expect(page.locator("#finding-rows .severity.pass").first()).toHaveCSS("color", "rgb(63, 104, 14)");
  await expect(page.locator("thead th").nth(2)).toHaveText("Path");
});

test("shows only the format/version error for a mismatched PAIN message", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles({
    name: "pain.007.001.09.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.007.001.09">
  <CstmrPmtRvsl><GrpHdr><MsgId>REVERSAL-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr></CstmrPmtRvsl>
</Document>`),
  });
  await page.getByRole("button", { name: "Validate file" }).click();

  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.locator("#error-count")).toHaveText("1");
  await expect(page.locator("#finding-rows tr")).toHaveCount(1);
  await expect(page.locator("#finding-rows")).toContainText(
    "Ensure the file format type/version you selected matches the file you uploaded.",
  );
});

test("opens an exact source location in the read-only file explorer", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles({
    name: "wrong-version.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\r\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.007.001.09">\r\n  <CstmrPmtRvsl><GrpHdr><MsgId>REVERSAL-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr></CstmrPmtRvsl>\r\n</Document>`),
  });
  await page.getByRole("button", { name: "Validate file" }).click();

  const explorer = page.getByRole("complementary", { name: "File explorer" });
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole("heading", { name: "wrong-version.xml" })).toBeVisible();
  const viewSource = page.getByRole("button", { name: "View in file" });
  await expect(viewSource).toBeVisible();
  await viewSource.click();
  await expect(explorer).toContainText("iso.namespace-version");
  await expect(explorer).toContainText("Exact source location");
  await expect(explorer.locator(".cm-finding-range")).toContainText(
    "urn:iso:std:iso:20022:tech:xsd:pain.007.001.09",
  );
  await expect(explorer.locator(".cm-content")).toHaveAttribute("contenteditable", "false");

  await explorer.locator("[data-source-search]").fill("Document");
  await expect(explorer.locator("[data-search-status]")).toHaveText("1 of 2 matches");
  await explorer.locator("[data-search-next]").click();
  await expect(explorer.locator("[data-search-status]")).toHaveText("2 of 2 matches");
  await explorer.locator("[data-go-line]").fill("2");
  await explorer.locator("[data-go-line-button]").click();

  await explorer.getByRole("button", { name: "Hide file" }).click();
  await expect(explorer).toBeHidden();
  await page.getByRole("button", { name: "Show file explorer" }).click();
  await expect(explorer).toBeVisible();
});

test("shows PASS WITH WARNINGS for a valid PAIN file without an XML declaration", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles(demoFile("pain.001.001.09-pass-with-warnings.xml"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("PASS WITH WARNINGS");
  await expect(page.locator("#result-basis")).toContainText("does not guarantee that Huntington will accept");
  await expect(page.locator("#warning-count")).toHaveText("1");
  await expect(page.getByText("Add an XML declaration to make the document encoding explicit.")).toBeVisible();
  const resultLayout = await page.evaluate(() => {
    const height = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().height;
    const table = document.querySelector("table")!.getBoundingClientRect();
    const columns = Array.from(document.querySelectorAll("thead th"), (cell) => cell.getBoundingClientRect().width / table.width);
    return {
      controlHeights: [height("#finding-search"), height("#path-filter"), height("#sort-order")],
      columnRatios: columns,
    };
  });
  expect(new Set(resultLayout.controlHeights).size).toBe(1);
  expect(resultLayout.columnRatios[0]).toBeCloseTo(0.10, 2);
  expect(resultLayout.columnRatios[1]).toBeCloseTo(0.18, 2);
  expect(resultLayout.columnRatios[2]).toBeCloseTo(0.40, 2);
  expect(resultLayout.columnRatios[3]).toBeCloseTo(0.32, 2);

  const errorsFilter = page.locator('[data-outcome="ERROR"]');
  const warningsFilter = page.locator('[data-outcome="WARNING"]');
  const passFilter = page.locator('[data-outcome="PASS"]');
  await expect(errorsFilter).toHaveText("Error");
  await expect(warningsFilter).toHaveText("Warning");
  await expect(passFilter).toHaveText("Pass");
  await expect(errorsFilter).toHaveCSS("background-color", "rgb(255, 241, 241)");
  await expect(errorsFilter).toHaveCSS("color", "rgb(193, 0, 0)");
  await expect(warningsFilter).toHaveCSS("background-color", "rgb(255, 251, 235)");
  await expect(warningsFilter).toHaveCSS("color", "rgb(204, 163, 0)");
  await expect(passFilter).toHaveCSS("background-color", "rgb(242, 250, 232)");
  await expect(passFilter).toHaveCSS("color", "rgb(63, 104, 14)");
  await expect(passFilter).toHaveCSS("border-radius", "8px");
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCSS("background-color", "rgb(255, 251, 235)");
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCSS("color", "rgb(204, 163, 0)");
  await errorsFilter.click();
  await warningsFilter.click();
  await expect(page.locator("#finding-rows .severity")).toHaveCount(10);
  await expect(page.locator("#finding-rows .severity:not(.pass)")).toHaveCount(0);
  await passFilter.click();
  await expect(errorsFilter).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(warningsFilter).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(passFilter).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("paginates filtered validation results in groups of 25", async ({ page }) => {
  await page.addInitScript(() => {
    class MockValidationWorker extends EventTarget {
      postMessage(): void {
        const results = Array.from({ length: 52 }, (_, index) => ({
          ruleId: `rule-${index + 1}`,
          outcome: "PASS",
          severity: null,
          field: `Field ${index + 1}`,
          locator: `/Document/Field[${index + 1}]`,
          message: `Rule ${index + 1} passed.`,
          ordinal: index,
        }));
        window.setTimeout(() => {
          this.dispatchEvent(new MessageEvent("message", {
            data: {
              type: "complete",
              run: {
                fileName: "pagination.xml",
                formatId: "pain-001-09",
                formatLabel: "ISO 20022 PAIN.001 — Customer Credit Transfer Initiation",
                version: "pain.001.001.09",
                results,
                errorCount: 0,
                warningCount: 0,
                overallStatus: "PASS",
              },
            },
          }));
        }, 0);
      }

      terminate(): void {}
    }
    Object.defineProperty(window, "Worker", { configurable: true, value: MockValidationWorker });
  });

  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles({
    name: "pagination.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<Document/>")
  });
  await page.getByRole("button", { name: "Validate file" }).click();

  await expect(page.getByText("Search", { exact: true })).toBeVisible();
  await expect(page.locator("#finding-rows tr")).toHaveCount(25);
  const tableHeight = await page.locator(".table-wrap").evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
  }));
  expect(tableHeight.scroll).toBe(tableHeight.client);
  await expect(page.locator("#pagination-status")).toHaveText("Page 1 of 3 · Showing 1–25 of 52 results");
  await expect(page.locator("#previous-page")).toBeDisabled();
  await page.locator("#next-page").click();
  await expect(page.locator("#pagination-status")).toHaveText("Page 2 of 3 · Showing 26–50 of 52 results");
  await expect(page.locator("#finding-rows tr")).toHaveCount(25);
  await page.locator("#next-page").click();
  await expect(page.locator("#pagination-status")).toHaveText("Page 3 of 3 · Showing 51–52 of 52 results");
  await expect(page.locator("#finding-rows tr")).toHaveCount(2);
  await expect(page.locator("#next-page")).toBeDisabled();

  await page.locator("#finding-search").fill("Field 26");
  await expect(page.locator("#finding-rows tr")).toHaveCount(1);
  await expect(page.locator("#finding-rows")).toContainText("Field 26");
  await expect(page.locator("#results-pagination")).toBeHidden();
});

test("shows the intended PASS and FAIL presentations for the PAIN.001.001.09 demo files", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  await expect(page.locator("#file-extension")).toHaveText(".XML");
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#error-count")).toHaveText("0");
  await expect(page.locator("#warning-count")).toHaveText("0");
  await expect(page.locator("#pass-count")).toHaveText("11");

  await page.locator('[data-open-step="2"]').first().click();
  await page.locator("#file-input").setInputFiles(demoFile("pain.001.001.09-fail.xml"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.locator("#error-count")).toHaveText("1");
  await expect(page.locator("#warning-count")).toHaveText("0");
  await expect(page.locator("#pass-count")).toHaveText("0");
  await expect(page.locator("#finding-rows .severity.error").first()).toHaveCSS("background-color", "rgb(255, 241, 241)");
  await expect(page.locator("#finding-rows .severity.error").first()).toHaveCSS("color", "rgb(193, 0, 0)");
  await expect(page.getByText(
    "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded.",
  )).toBeVisible();
  await expect(page.locator("#result-basis")).toHaveText(
    "Based on syntax and structure checks, this file contains the errors below. Please resolve them before file submission.",
  );
});

test("turns malformed XML into a FAIL result instead of a worker error", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.008", "pain.008.001.12");
  await page.locator("#file-input").setInputFiles({
    name: "bad-direct-debit.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<Document>"),
  });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#step-3-panel")).toBeVisible();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await expect(page.getByText(/not well formed/i)).toBeVisible();
});

test("changing the format clears downstream file and result state", async ({ page }) => {
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.09");
  await page.locator("#file-input").setInputFiles({
    name: "selected.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<Document/>"),
  });
  await page.getByRole("button", { name: /Change format/ }).click();
  await chooseFormat(page, "pain.008", /pain\.008.*Customer Direct Debit/i, "pain.008.001.08");
  await expect(page.locator("#selected-file")).toBeHidden();
  await expect(page.locator("#upload-title")).toHaveText("Upload your pain.008.001.08 file");
  await expect(page.locator("#validate-file")).toBeDisabled();
});

test("does not transmit selected-file values", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(`${request.url()} ${request.postData() ?? ""}`));
  await page.goto("/");
  await openXmlUpload(page, "pain.001", "pain.001.001.03");
  await page.locator("#file-input").setInputFiles({
    name: "PRIVATE-FILENAME.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("PRIVATE-PAYMENT-VALUE"),
  });
  expect(requests.join("\n")).not.toContain("PRIVATE-FILENAME");
  expect(requests.join("\n")).not.toContain("PRIVATE-PAYMENT-VALUE");
});

test("keeps the horizontal steps usable without narrow-page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".step-number").first()).toHaveCSS("width", "28px");
  await expect(page.locator(".step-number").first()).toHaveCSS("height", "24px");
  await expect(page.locator(".step strong").first()).toHaveCSS("white-space", "nowrap");
  await expect(page.locator(".step strong").first()).toHaveCSS("font-family", /Huntington Serif/);
  await expect(page.locator(".step-number").first()).toHaveCSS("font-family", /Huntington Serif/);
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    stepDisplay: getComputedStyle(document.querySelector(".steps")!).display,
    stepDirection: getComputedStyle(document.querySelector(".steps")!).flexDirection,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
  expect(sizes.stepDisplay).toBe("flex");
  expect(sizes.stepDirection).toBe("row");
});

test("uses the embedded portal presentation and has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header, footer")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".accordion-trigger strong").first()).toHaveCSS("font-family", /Huntington Serif/);
  await expect(page.locator("body")).toHaveCSS("font-family", /ABC Monument Grotesk/);
  await expect(page.locator(".card").first()).toHaveCSS("border-radius", "8px");
  await expect(page.locator(".steps")).toHaveCSS("justify-content", "center");
  // The validator is an embedded module; its ReadMe host page owns the single page-level h1.
  const scan = await new AxeBuilder({ page }).disableRules(["page-has-heading-one"]).analyze();
  expect(scan.violations).toEqual([]);
});
