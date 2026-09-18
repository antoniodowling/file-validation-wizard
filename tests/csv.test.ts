import { describe, expect, it } from "vitest";
import { neutralizeSpreadsheetFormula, validationReportFileName, validationRunToCsv } from "../src/csv";
import type { ValidationRun } from "../src/types";

const run: ValidationRun = {
  fileName: "=sensitive.xml",
  formatId: "pain-001-test",
  formatLabel: "PAIN.001",
  version: "pain.001.001.99",
  errorCount: 1,
  warningCount: 0,
  overallStatus: "FAIL",
  results: [
    {
      ruleId: "rule.pass",
      outcome: "PASS",
      severity: null,
      field: "Header",
      locator: "/Document/GrpHdr",
      message: "Passed",
      ordinal: 0,
    },
    {
      ruleId: "rule.error",
      outcome: "ERROR",
      severity: "ERROR",
      field: "Message ID",
      locator: "/Document/GrpHdr/MsgId",
      message: 'Missing, required "value"',
      ordinal: 1,
    },
  ],
};

describe("CSV export", () => {
  it("exports every canonical rule result with stable headers and CRLF rows", () => {
    const csv = validationRunToCsv(run);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4);
    expect(csv.split("\r\n")[0]).toContain('"Field","Path","Message"');
    expect(csv.split("\r\n")[0]).not.toContain('"Locator"');
    expect(csv).toContain('"rule.pass","PASS"');
    expect(csv).toContain('"rule.error","ERROR","ERROR"');
    expect(csv).toContain('"Missing, required ""value"""');
  });

  it("neutralizes spreadsheet formulas and creates an unambiguous report name", () => {
    expect(neutralizeSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(validationRunToCsv(run)).toContain('"\'=sensitive.xml"');
    expect(validationReportFileName(run)).toBe("sensitive-pain-001-test-pain.001.001.99-validation-results.csv");
  });
});
