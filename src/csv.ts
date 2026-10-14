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
  "Export Schema", "Row Kind", "Mode", "Profile ID", "Ruleset Revision", "Coverage Revision", "Build Revision", "Implementation Guide", "Execution Status", "Verdict", "Location", "Coverage and Exclusions",
] as const;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeSpreadsheetFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function quoteCsv(value: string): string {
  return `"${neutralizeSpreadsheetFormula(value).replaceAll('"', '""')}"`;
}

export function validationRunToCsv(run: ValidationRun): string {
  const occurrences = run.results.map(result => ({ ...result, rowKind: "evaluation-occurrence" }));
  const skipped = (run.checks ?? []).filter(check => check.state === "not-evaluated" || check.state === "not-applicable").map(check => ({
    ruleId: check.ruleId, outcome: check.state, severity: null, field: "", locator: "", message: "See coverage prerequisites and execution status.",
    location: undefined, rowKind: "check-state",
  }));
  const entries = [...occurrences, ...skipped];
  if (!entries.length) entries.push({ ruleId: "", outcome: "not-evaluated", severity: null, field: "", locator: "", message: "No validity assessment", location: undefined, rowKind: "run-metadata" });
  const rows = entries.map((result, index) =>
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
      "2", result.rowKind, run.provenance?.mode ?? "LEGACY UNKNOWN", run.formatId,
      run.provenance?.rulesetRevision ?? "unknown", run.provenance?.coverageRevision ?? "unknown",
      run.provenance?.buildRevision ?? "unknown", run.provenance?.implementationGuideRevision ?? "unknown",
      run.executionStatus ?? "COMPLETED", run.verdict === null ? "" : run.verdict ?? run.overallStatus,
      JSON.stringify(result.location ?? { kind: "unavailable", explanation: "No authoritative source location" }),
      index === 0 ? JSON.stringify({ coverage: run.provenance?.coverage ?? [], exclusions: run.provenance?.exclusions ?? ["Legacy report; coverage unknown"], checks: run.checks ?? [] }) : `Coverage snapshot: first data row; ${run.provenance?.coverageRevision ?? "legacy unknown"}`,
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

/** JSON retains occurrence locations, check states and the immutable coverage snapshot. */
export function validationRunToJson(run: ValidationRun): string {
  return JSON.stringify({ exportSchemaVersion: "2", ...run }, null, 2) + "\n";
}
