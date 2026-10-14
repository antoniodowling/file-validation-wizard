import type { CoverageRule, FormatPack } from "./types";
import { ACK_RULE_IDS } from "./parsers/huntington-ack";
export const ACK_RULESET_REVISION = "huntington-ack-pipe-candidate-1.0.0";
export const ACK_GUIDE_REVISION = "Huntington public illustrative File Received ACK sample, updated 2026-08-10; local uncustomized pipe scenario r1";
export const ACK_EXCLUSIONS = Object.freeze([
  "Candidate syntax scenario based on a public illustrative sample whose fields/codes may vary; not a normative customer-specific Huntington contract or production approval.",
  "RECEIVED/ACCEPTED/REJECTED and VAL ERROR/WARNING describe the bank's report. Format PASS does not mean acceptance, payment authorization, execution, settlement, or funds availability.",
  "Original-file size, checksum, declared/received counts and hash values are syntax-checked only. No original file bytes, cryptographic verification, count/hash equality, or ACK line-count reconciliation.",
  "Correlation values are opaque populated text; no external identity, file-name mapping, historical uniqueness, or bank-system verification.",
  "Only UTF-8 decoded pipe-delimited ACK version 1.0, local named fields and codes are admitted. Comma/tab/custom profiles and unknown tags/versions/statuses issue no verdict.",
]);
const DESCRIPTIONS: readonly string[] = [
  "Nonempty LF/CRLF pipe records, optional blank lines/# comments, no BOM or controls.",
  "One HDR, FIL records, one FILE STA, optional MSG/BAT plus BATCH STA/VAL, one CTL, final TRL.",
  "HDR constants and real UTC ISO timestamp.",
  "Distinct known FIL name/value pairs, InboundFileName/CorrelationId required; optional original size is nonnegative digits, other values opaque.",
  "Known file/batch disposition and populated qualifier; optional file ParserVersion pair.",
  "Optional INFO/WARNING/ERROR message records with populated text.",
  "Optional unique positive batch number, BatchRef and nonnegative original RecordCount; adjacent batch disposition.",
  "Optional WARNING/ERROR reports with LINE, positive original line, Field: label and populated explanation; reported severity does not affect syntax verdict.",
  "Four distinct CTL count/hash pairs with digit values; no original-data reconciliation.",
  "TRL END with a real UTC ISO timestamp.",
  "Known trailer timestamp does not precede header timestamp.",
];
export function ackCoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return ACK_RULE_IDS.map((id, index) => ({ id, description: DESCRIPTIONS[index]!, ruleClass: "tool-policy", severity: "ERROR", applicability: `Selected candidate profile ${pack.id}; optional records only when present.`, prerequisite: "Admitted pipe ACK 1.0 profile; timestamp order requires two valid timestamps.", reference: "docs/HUNTINGTON_ACK_CANDIDATE.md; https://developer.huntington.com/enterprisepayments/docs/file-received-ack-flat-file.md; illustrative sample plus explicitly local scenario decisions", evidence: "tests/huntington-ack.test.ts; synthetic local syntax evidence only" }));
}
