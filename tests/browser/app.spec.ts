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
  await expect(page.locator('#format-listbox [role="option"]')).toHaveCount(4);
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
  await expect(page.locator("#format-selection-help")).toHaveText("See General family guide (version applicability unverified) and sample file");
  await expect(page.locator("#format-selection-help")).not.toContainText("Accepted extensions");
  await expect(page.getByRole("link", { name: "General family guide (version applicability unverified)" })).toHaveAttribute(
    "href",
    "https://developer.huntington.com/enterprisepayments/docs/iso-pain001",
  );
  await expect(page.getByRole("link", { name: "General family guide (version applicability unverified)" })).toHaveAttribute("target", "_blank");
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
    };
  });
  expect(alignment.versionHeight).toBe(alignment.searchHeight);
  expect(alignment.buttonHeight).toBe(alignment.searchHeight);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#step-1-panel")).toBeHidden();
  await expect(page.locator("#step-2-panel")).toBeVisible();
  await expect(page.locator("#file-input")).toHaveAttribute("accept", ".xml");
  await expect(page.getByText("Maximum size: 25MB")).toBeVisible();
  await expect(page.getByText("Use test data only")).toBeVisible();
  await expect(page.getByText(
    "Selected files are never uploaded to ABC Bank, but using sensitive data is never advised.",
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

test("format controls fit and stack in the narrow explorer pane", async ({ page }) => {
  await page.goto("/");
  await chooseFormat(page, "pain.001", /pain\.001/i, "pain.001.001.13");
  const geometry = await page.evaluate(() => ["#format-search", "#version-select", "#format-continue"].map(selector => {
    const element = document.querySelector(selector)!; const box = element.getBoundingClientRect();
    return { width: box.width, left: box.left, right: box.right, top: box.top };
  }));
  expect(geometry.every(box => box.width > 180)).toBe(true);
  expect(geometry[1]!.top).toBeGreaterThan(geometry[0]!.top);
  expect(Math.max(...geometry.map(box => box.right)) - Math.min(...geometry.map(box => box.right))).toBeLessThan(2);
});

test("opens the NACHA public profile and removes unsupported catalog formats", async ({ page }) => {
  await page.goto("/");
  await page.locator("#format-search").fill("MT940");
  await expect(page.locator('#format-listbox [role="option"]')).toHaveCount(0);
  await chooseFormat(page, "NACHA", /NACHA.*ACH Payment Instructions/i, "origination-public-2026");
  await expect(page.getByText("Supports CCD, PPD, CTX, WEB, and TEL batches, including mixed files.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#upload-title")).toHaveText("Upload your NACHA / ACH file");
  await expect(page.locator("#file-input")).toHaveAttribute("accept", ".ach,.txt");
});

test("validates mixed NACHA files, warnings and errors with exact source navigation and CSV", async ({ page }) => {
  await page.goto("/");
  await chooseFormat(page, "NACHA", /NACHA.*ACH Payment Instructions/i, "origination-public-2026");
  await page.getByRole("button", { name: "Continue" }).click();
  const upload = async (file: string) => {
    await page.locator("#file-input").setInputFiles(demoFile(`nacha/${file}`));
    await page.getByRole("button", { name: "Validate file" }).click();
  };
  await upload("mixed-five-sec-pass.ach");
  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#result-basis")).toContainText("Passing does not establish full Nacha Rules compliance or bank acceptance.");
  const download = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  expect((await download).suggestedFilename()).toContain("nacha-origination-public-2026");
  await page.locator('[data-open-step="2"].button').click();
  await upload("effective-weekend-warning.ach");
  await expect(page.locator("#results-title")).toHaveText("PASS WITH WARNINGS");
  await page.locator('[data-open-step="2"].button').click();
  await upload("routing-check-digit-fail.ach");
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  const errorRow = page.locator("#finding-rows tr").filter({ hasText: "Receiving routing number" });
  await expect(errorRow.locator(".finding-line")).toHaveText("3");
  await errorRow.getByRole("button", { name: /View/ }).click();
  await expect(page.locator("[data-file-explorer] .cm-content")).toHaveAttribute("contenteditable", "false");
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).toContainText("check digit");
});

test("offers only formats and versions with enabled validators", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Browse all format references" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show executable DEMO validators" })).toHaveCount(0);

  const search = page.locator("#format-search");
  await search.focus();
  const options = page.locator('#format-listbox [role="option"]');
  await expect(options.locator("span:nth-child(2)")).toHaveText(["pain.001", "pain.008", "820", "NACHA"]);
  for (const query of ["MT940", "camt", "821"]) {
    await search.fill(query);
    await expect(options).toHaveCount(0);
    await expect(page.getByText("No formats match your search.")).toBeVisible();
  }

  for (const [query, versions] of [
    ["pain.001", ["pain.001.001.03", "pain.001.001.09", "pain.001.001.13"]],
    ["pain.008", ["pain.008.001.02", "pain.008.001.08", "pain.008.001.12"]],
    ["820", ["004010", "005010", "008030"]],
    ["NACHA", ["origination-public-2026", "origination-expanded-public-2026-r1"]],
  ] as const) {
    await search.fill(query);
    await options.click();
    await expect(page.locator("#version-select option")).toHaveText(["Select a version", ...versions.map(version => version === "origination-public-2026" ? "Public specification profile (2026 review)" : version === "origination-expanded-public-2026-r1" ? "Expanded entry types — public-source candidate (2026 r1)" : version)]);
    for (const version of versions) {
      await page.locator("#version-select").selectOption(version);
      await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    }
  }
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
    "No errors or warnings were found. Passing these checks does not guarantee payment acceptance or processing.",
  );
  await expect(page.locator(".metrics strong")).toHaveText(["Errors", "Warnings", "Pass"]);
  await expect(page.locator("#pass-count")).toHaveText("11");
  await expect(page.locator("#check-summary")).toHaveCount(0);
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

test("opens labeled namespace context in the read-only file explorer", async ({ page }) => {
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
  const viewSource = page.getByRole("button", { name: "View context" });
  await expect(viewSource).toBeVisible();
  await viewSource.click();
  await expect(explorer).toContainText("iso.namespace-version");
  await expect(explorer.locator(".cm-finding-neutral").first()).toContainText(
    "urn:iso:std:iso:20022:tech:xsd:pain.007.001.09",
  );
  await expect(explorer.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
  await expect(explorer.locator("[data-detail-field]")).toBeVisible();
  await expect(explorer.locator("[data-detail-locator]")).toBeVisible();
  await expect(explorer.locator("[data-detail-message]")).toBeVisible();
  await expect(explorer.locator("[data-source-search], [data-go-line], [data-related-status], [data-focus-source]")).toHaveCount(0);

  await explorer.getByRole("button", { name: "Hide explorer" }).click();
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
  await expect(page.locator("#result-basis")).toHaveText("Warnings were found. Review them below. Passing these checks does not guarantee payment acceptance or processing.");
  await expect(page.locator("#warning-count")).toHaveText("1");
  await expect(page.locator("#check-summary")).toHaveCount(0);
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
  expect(resultLayout.columnRatios).toHaveLength(5);
  expect(resultLayout.columnRatios[0]).toBeGreaterThanOrEqual(0.10);
  const severityWidth = await page.locator("thead th").first().evaluate(e => e.getBoundingClientRect().width);
  expect(severityWidth).toBeGreaterThanOrEqual(95);

  const errorsFilter = page.locator('[data-outcome="ERROR"]');
  const warningsFilter = page.locator('[data-outcome="WARNING"]');
  const passFilter = page.locator('[data-outcome="PASS"]');
  await expect(errorsFilter).toHaveText("Error");
  await expect(warningsFilter).toHaveText("Warning");
  await expect(passFilter).toHaveText("Pass");
  await expect(errorsFilter).toHaveCSS("background-color", "rgb(255, 241, 241)");
  await expect(errorsFilter).toHaveCSS("color", "rgb(193, 0, 0)");
  await expect(warningsFilter).toHaveCSS("background-color", "rgb(255, 251, 235)");
  await expect(warningsFilter).toHaveCSS("color", "rgb(128, 96, 0)");
  await expect(passFilter).toHaveCSS("background-color", "rgb(242, 250, 232)");
  await expect(passFilter).toHaveCSS("color", "rgb(63, 104, 14)");
  await expect(passFilter).toHaveCSS("border-radius", "8px");
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCSS("background-color", "rgb(255, 251, 235)");
  await expect(page.locator("#finding-rows .severity.warning")).toHaveCSS("color", "rgb(128, 96, 0)");
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
  await expect(page.locator("#check-summary")).toHaveCount(0);
  await expect(page.locator("#finding-rows .severity.error").first()).toHaveCSS("background-color", "rgb(255, 241, 241)");
  await expect(page.locator("#finding-rows .severity.error").first()).toHaveCSS("color", "rgb(193, 0, 0)");
  await expect(page.getByText(
    "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded.",
  )).toBeVisible();
  await expect(page.locator("#result-basis")).toHaveText(
    "Errors were found. Correct them and validate the file again. Passing these checks does not guarantee payment acceptance or processing.",
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
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  expect(requests.join("\n")).not.toContain("PRIVATE-FILENAME");
  expect(requests.join("\n")).not.toContain("PRIVATE-PAYMENT-VALUE");
});

test("keeps the horizontal steps usable without narrow-page overflow", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator(".step-number").first()).toHaveCSS("width", "28px");
  await expect(page.locator(".step-number").first()).toHaveCSS("height", "24px");
  expect(await page.locator(".step strong").evaluateAll(elements => elements.every(e => e.scrollWidth <= e.clientWidth))).toBe(true);
  await expect(page.locator(".step strong").first()).toHaveCSS("font-family", /Huntington Serif/);
  await expect(page.locator(".step-number").first()).toHaveCSS("font-family", /Huntington Serif/);
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    stepDisplay: getComputedStyle(document.querySelector(".steps")!).display,
    stepDirection: getComputedStyle(document.querySelector(".steps")!).flexDirection,
  }));
  expect(sizes.stepDisplay).toBe("flex");
  expect(sizes.stepDirection).toBe("row");
  expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
});

test("uses the embedded portal presentation and has no detectable accessibility violations", async ({ page }) => {
  await page.goto("/");
  // A section header inside the explorer is valid; the host owns page landmarks.
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".accordion-trigger strong").first()).toHaveCSS("font-family", /Huntington Serif/);
  await expect(page.locator("body")).toHaveCSS("font-family", /ABC Monument Grotesk/);
  await expect(page.locator(".card").first()).toHaveCSS("border-radius", "8px");
  expect(await page.locator(".steps").evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll("strong")].every(label => {
      const box = label.getBoundingClientRect();
      return box.left >= bounds.left && box.right <= bounds.right;
    });
  })).toBe(true);
  // The validator is an embedded module; its ReadMe host page owns the single page-level h1.
  const scan = await new AxeBuilder({ page }).disableRules(["page-has-heading-one"]).analyze();
  expect(scan.violations).toEqual([]);
});


test("expanded NACHA candidate runs locally, exports its coverage, navigates a failure and clears stale verdicts", async ({ page }) => {
  const sourcePosts: string[] = [];
  page.on("request", request => { if (request.postData()?.includes("SYNTHETIC")) sourcePosts.push(request.url()); });
  await page.goto("/");
  await chooseFormat(page, "NACHA", /NACHA.*ACH Payment Instructions/i, "origination-expanded-public-2026-r1");
  await expect(page.locator("#format-selection-help")).toContainText("monetary, prenote, zero-dollar remittance and reversal");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Load PASS sample" }).click();
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#result-basis")).toContainText("Expanded public-source candidate");
  const csvDownload = page.waitForEvent("download"); await page.locator("#export-csv").click();
  const csv = await csvDownload; expect(csv.suggestedFilename()).toContain("origination-expanded-public-2026-r1");
  const jsonDownload = page.waitForEvent("download"); await page.locator("#export-json").click();
  const json = await jsonDownload; expect(json.suggestedFilename()).toContain("origination-expanded-public-2026-r1");
  await page.getByRole("button", { name: "Back to file" }).click();
  await page.locator("#file-input").setInputFiles(demoFile("nacha-expanded/prenote-amount-fail.ach"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  const errorRow = page.locator("#finding-rows tr").filter({ hasText: "Entry amount" });
  await expect(errorRow.locator(".finding-line")).toHaveText("3");
  await errorRow.getByRole("button", { name: /View/ }).click();
  await expect(page.locator("[data-file-explorer] [data-detail-message]")).toContainText("exactly zero");
  await page.getByRole("button", { name: "Back to file" }).click();
  await page.locator("#file-input").setInputFiles(demoFile("nacha-expanded/ctx-edifact-unsupported.ach"));
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("UNSUPPORTED");
  await expect(page.locator("#finding-rows .severity")).toHaveCount(0);
  await expect(page.locator("#finding-rows")).not.toContainText("Entry amount");
  expect(sourcePosts).toEqual([]);
  const scan = await new AxeBuilder({ page }).analyze(); expect(scan.violations.filter(v => ["critical", "serious"].includes(v.impact ?? ""))).toEqual([]);
});
