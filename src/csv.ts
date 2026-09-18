import { overallStatusLabel } from "./outcome";
import type { ValidationRun } from "./types";

const HEADERS = [
  "File Name",
  "Format",
  "Version",
  "Overall Result",
  "Rule ID",
  "Rule Result",
  "Severity",
  "Field",
  "Path",
  "Message",
] as const;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function quoteCsv(value: string): string {
  return `"${neutralizeSpreadsheetFormula(value).replaceAll('"', '""')}"`;
}

export function validationRunToCsv(run: ValidationRun): string {
  const rows = run.results.map((result) =>
    [
      run.fileName,
      run.formatLabel,
      run.version,
      overallStatusLabel(run.overallStatus),
      result.ruleId,
      result.outcome,
      result.severity ?? "",
      result.field,
      result.locator,
      result.message,
    ]
      .map(quoteCsv)
      .join(","),
  );
  return `\uFEFF${HEADERS.map(quoteCsv).join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

export function validationReportFileName(run: ValidationRun): string {
  const base = run.fileName.replace(/\.[^.]+$/, "") || "validation";
  const safeBase = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "validation";
  const safeFormat = run.formatId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const safeVersion = run.version.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${safeBase}-${safeFormat}-${safeVersion}-validation-results.csv`;
}
