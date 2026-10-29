import type { CoverageRule, FormatPack } from "./types";
import { BAI2_RULE_IDS } from "./parsers/bai2";

export const BAI2_REVISION = "huntington-bai2-candidate-1.1.0";
export const BAI2_GUIDE = "Huntington BAI2 guide updated 2026-09-17T20:36:35Z; supplied SHA-256 83a5ccfe3eb6d0919e2cd401670df26d4a30728c0987f84c2aa4cefb8fe48b0e; candidate reviewed 2026-10-14";
export const BAI2_EXCLUSIONS = Object.freeze([
  "CANDIDATE only, not complete BAI/X9 or bank conformance. No Product/SC/FT, rules/fixtures approval, Production activation or hosted ReadMe acceptance.",
  "Candidate transport: printable ASCII (decoded as strict UTF-8), no BOM/tabs, one physical record per LF/CRLF/CR-separated line, optional one final separator. Mixed separators admitted. Blocked, translated, encrypted and concatenated transports are not qualified.",
  "Structured 88 continuation at comma field boundaries and opaque 16 text continuation are supported after any record, including 88. Scalar splits are unsupported. Physical counts include continuations of headers and trailers; no universal maximum 80-column length is imposed.",
  "Only omitted funds fields, omitted physical length/block size, USD/omitted currency and omitted/2 as-of modifier are qualified. Nonempty funds layouts, declared blocking, other currencies/modifiers/versions and unlisted three-digit type codes receive UNSUPPORTED with no verdict.",
  "Guide defaults are not fixed customer identities. Dates use a disclosed 2000–2099 interpretation and integers retain a local 40-digit limit. Base BAI Version 2 signs apply: status/control optional plus or minus; summary/detail optional plus only, including signed zero. No verified Huntington sign override or bank acceptance. No decimal scaling, real account/routing ownership, balance economics, net-debit/credit reconciliation, historical duplication or external verification.",
  "Controls sum reported numeric summary and detail amounts once; omitted optional amounts contribute no numeric operand. Counts include the opening and closing physical records. Dependent total/count checks are not evaluated when their numeric/layout prerequisites are malformed.",
  "CSV conversion, funds availability correctness, custom OpenText layouts, delivery scheduling/entitlements and current-day modifier semantics are excluded; omitted modifiers do not establish reporting mode.",
]);
const descriptions: Record<string, string> = {
  characters: "Candidate printable-ASCII admission, preserving original source; no BOM/tabs.",
  framing: "Nonempty line-based records, two-digit code plus comma, final slash; no blank physical records.",
  continuation: "88 attaches to a preceding record; structured field-boundary assembly and opaque 16 text continuation.",
  hierarchy: "One 01…99 file, nonempty 02…98 groups, nonempty 03…49 accounts; details belong to accounts.",
  layout: "Logical field count by record type; optional trailing fields on 02/03/16.",
  "file-header": "Nonblank identities/file ID, real YYMMDD date, HHMM including 2400, BAI version 2; example IDs are not mandated.",
  "group-header": "Nonblank originator, status 1, real as-of date and optional valid time.",
  "account-id": "Numeric account ID without leading zeros, surrounding spaces tolerated as in source sample.",
  currency: "USD or omitted currency; other well-formed currency codes are unsupported.",
  "summary-code": "Summary/status code from union of guide common-code and transaction-code lists, correct level.",
  "detail-code": "Detail code from guide transaction-code list, correct level; absent details are not applicable.",
  "summary-fields": "Optional summary item count, zero when present; only omitted funds fields qualified.",
  amount: "Base BAI Version 2 class-aware integer syntax: status/control permit plus, minus or unsigned; summary/detail permit plus or unsigned. Optional absent data amounts, required trailer amounts; local 40-digit limit, exact arithmetic, no scaling assumptions.",
  "trailer-fields": "Mandatory unsigned integer trailer counts.",
  "account-total": "49 total equals reported 03 summary and 16 detail amounts, including 88 storage once.",
  "account-count": "49 count equals physical records 03 through 49, including attached continuations.",
  "group-total": "98 total equals sum of account trailer totals in that group.",
  "group-accounts": "98 account count equals number of owned 03 records.",
  "group-count": "98 count equals physical records 02 through 98 including attached continuations.",
  "file-total": "99 total equals sum of group trailer totals.",
  "file-groups": "99 group count equals number of owned 02 records.",
  "file-count": "99 count equals all physical records, including 01/99 and every continuation.",
};
export function bai2CoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return [...BAI2_RULE_IDS, ...pack.rules.map(rule => rule.id)].map(id => ({ id,
    description: descriptions[id.replace(/^bai2\./, "")] ?? "Nonempty source in trusted BAI2 context.",
    ruleClass: "flat-file-structure", severity: "ERROR", applicability: "Selected Huntington BAI2 candidate; per-record/account/group occurrences where present.",
    prerequisite: id === "bai2.characters" ? "Decoded source" : id === "bai2.framing" ? "Admitted characters" : id === "bai2.continuation" ? "Framed physical records"
      : id === "bai2.hierarchy" ? "Assembled logical records" : id.endsWith("-total") ? "Valid hierarchy, owned logical layouts and valid numeric operands"
      : id.endsWith("-count") || id.endsWith("-accounts") || id.endsWith("-groups") ? "Valid hierarchy, trailer layout and unsigned count" : "Valid hierarchy; subject logical layout",
    reference: "https://developer.huntington.com/enterprisepayments/docs/bai2; BAI Version 2 Technical Reference Manual October 2005 p.25 and Appendix A; docs/BAI2_SOURCE_SCOPE.md (source versus candidate assumptions)",
    evidence: "tests/bai2.test.ts; tests/bai2-signs.test.ts; tests/browser/bai2.spec.ts; demo-files/bai2/manifest.json; source sample arithmetic and independent synthetic sign/totals oracle, no independent bank approval",
  }));
}
