import type { CoverageRule, FormatPack } from "./types";
import { CONTROL_TOTAL_RULE_IDS } from "./parsers/huntington-control-totals";
export const CONTROL_TOTAL_REVISION = "huntington-control-total-candidate-1.0.0";
export const CONTROL_TOTAL_GUIDE = "Huntington ACH Control Total Flat File, updated 2026-09-18; single-record candidate scenario reviewed 2026-10-14";
export const CONTROL_TOTAL_EXCLUSIONS = Object.freeze([
  "CANDIDATE only: one 58-column printable-ASCII record, optionally terminated by LF, CRLF or CR. This admission policy does not claim a bank-confirmed universal transport format.",
  "No original/companion NACHA matching, company-name truncation/equality, date/origin/amount equality, file submission, collection-window enforcement or bank acceptance.",
  "No Production, Product/SC/FT/rules/fixture approval or hosted ReadMe acceptance. Multiple records are unsupported with no verdict.",
]);
const descriptions: Record<string, string> = {
  framing: "Single 58-column record; optional one terminal delimiter; consistent fixed framing.",
  ascii: "Candidate admission: printable ASCII preserves byte/column correspondence; no BOM or tabs.",
  origin: "Nonblank ten-position immediate origin, preserving an optional leading blank; no companion equality.",
  company: "Nonblank sixteen-position company name with no lowercase letters.",
  credit: "Twelve unsigned zero-filled integer-cent digits for credit amount; zero allowed.",
  debit: "Twelve unsigned zero-filled integer-cent digits for debit amount; zero allowed.",
  "transmission-date": "Real CCYYMMDD calendar date; actual transmission and companion date excluded.",
};
export function controlTotalCoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return [...CONTROL_TOTAL_RULE_IDS, ...pack.rules.map(rule => rule.id)].map(id => ({ id,
    description: descriptions[id.replace(/^ach-totals\./, "")] ?? "Nonempty source in trusted format context.", ruleClass: "flat-file-structure", severity: "ERROR",
    applicability: "Selected single-record Huntington control-total candidate.", prerequisite: id.endsWith("framing") ? "Admitted decoded source" : id.endsWith("ascii") ? "Valid record width" : "Valid single printable-ASCII record",
    reference: "https://developer.huntington.com/enterprisepayments/docs/ach-control-total-flat-file.md; docs/HUNTINGTON_CONTROL_TOTAL_CANDIDATE.md",
    evidence: "tests/huntington-control-totals.test.ts; synthetic standalone fixtures; no independent bank conformance approval" }));
}
