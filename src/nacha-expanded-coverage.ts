import type { CoverageRule, FormatPack } from "./types";
import { nachaCoverageFor } from "./nacha-coverage";
export const NACHA_EXPANDED_REVISION = "nacha-expanded-public-1.0.0";
export const NACHA_EXPANDED_GUIDE = "Public sources reviewed 2026-10-14; origination-expanded-public-2026-r1; full current Operating Rules/UN-EDIFACT qualification deferred";
export const NACHA_EXPANDED_EXCLUSIONS = Object.freeze([
  "CANDIDATE public-source implementation only; no full 2026 Rules compliance, production approval, hosted ReadMe acceptance or bank acceptance.",
  "No account validity, routing-directory membership, authorization, real purpose/eligibility, funds availability, settlement, live windows or submission.",
  "No original-entry matching, historical duplicates, reversal purpose or deadlines, cross-file comparison, MAC authentication or complete X12/healthcare/tax business-guide conformance.",
  "UN/EDIFACT and opt-in XML CTX payloads, plus WEB/TEL loan combinations, are source/qualification gated: unsupported runs carry no verdict.",
  "Healthcare classification and required 835 TRN, PAYROLL/PURCHASE real-purpose obligations remain unverified without purpose evidence; they are not fake passed checks.",
  "Other origination SECs, returns/NOCs, external facts and future amendments are outside this origination profile.",
]);
const changed: Readonly<Record<string, readonly [string, string, string]>> = {
  "batch-required": ["Company name, identification and entry description are populated; reversals are permitted in this revision.", "Every batch.", "Trusted record envelopes"],
  "transaction-code": ["Checking/savings monetary 22/27/32/37, prenote 23/28/33/38, remittance 24/29/34/39; loan 52/53/54/55.", "Every entry; WEB/TEL loan combinations produce an unsupported run pending qualification.", "Trusted record envelopes"],
  "entry-amount": ["Monetary entries require positive ten-digit integer cents; prenotes/remittance entries require zero cents.", "Entries with known transaction types; unknown codes suppress type-specific amount evaluation.", "Trusted record envelopes; known transaction type"],
  "sec-transaction": ["Direction matches service class; TEL credit is checking/savings monetary reversal only; remittance codes are CCD/CTX only.", "Known SEC, service class and transaction type.", "Trusted record envelopes; known SEC/service class/code"],
  "batch-hash": ["Sum of numeric receiving DFI prefixes modulo ten billion; malformed prefixes suppress reconciliation.", "Batches with numeric prefixes for every entry.", "Trusted record envelopes; numeric routing prefixes"],
  "file-hash": ["Sum of receiving DFI prefixes modulo ten billion across batches; malformed prefixes suppress reconciliation.", "Files with numeric prefixes for every entry.", "Trusted record envelopes; numeric routing prefixes"],
};
const added: Readonly<Record<string, readonly [string, string, string]>> = {
  "field-padding": ["Nonblank alphanumeric header/entry fields are left justified with trailing spaces; optional blank fields are accepted.", "Applicable alphanumeric fields; immediate routing/origin and payload fields use their own layouts.", "Trusted record envelopes"],
  "reversal-marker": ["A description declaring reversal contains uppercase REVERSAL within its ten columns.", "Descriptions containing REVERSAL without regard to case; other descriptions are not applicable.", "Trusted record envelopes"],
  "reversal-transaction": ["Reversals are monetary; loan debit 55 requires uppercase REVERSAL; original matching and deadlines remain unverified.", "Declared reversals or code 55 with known entry types.", "Trusted record envelopes; known transaction type"],
  "remittance-required": ["Zero-dollar remittance and live CTX entries require addenda; prenotes do not require associated live-entry addenda.", "Known remittance entry types and live CTX; other entries not applicable.", "Trusted record envelopes; known transaction type"],
  "ctx-remittance": ["CTX X12 payload is reassembled without stripping chunk-boundary spaces; transaction sets contain BPR/BPS with envelope count/reference checks.", "Present CTX type-05 addenda; UN/EDIFACT and opt-in XML produce unsupported runs pending qualification.", "Trusted record envelopes; payment addenda type known"],
};
export function expandedNachaCoverageFor(pack: FormatPack): readonly CoverageRule[] {
  const reference = "docs/ACH_ORIGINATION_EXPANDED.md; https://achdevguide.nacha.org/ach-file-details; https://achdevguide.nacha.org/ach-file-overview; https://developer.gs.com/docs/services/transaction-banking/ach-file/; Nacha ISO mapping guide 2023-08-09; source-reviewed candidate";
  const evidence = "tests/nacha-expanded.test.ts; tests/nacha-expanded-fixtures.test.ts; demo-files/nacha-expanded/manifest.json; independent source/fixture review recorded in docs/ACH_ORIGINATION_EXPANDED.md; no business approvals or hosted acceptance";
  return [...nachaCoverageFor(pack).map(rule => {
    const key = rule.id.replace(/^nacha\./, ""); const replacement = changed[key];
    return { ...rule, ...(replacement ? { description: replacement[0], applicability: replacement[1], prerequisite: replacement[2] } : {}), reference, evidence };
  }), ...Object.entries(added).map(([key, metadata]) => ({ id: `nacha.${key}`, description: metadata[0], ruleClass: "nacha-structure" as const, severity: "ERROR" as const, applicability: metadata[1], prerequisite: metadata[2], reference, evidence }))];
}
