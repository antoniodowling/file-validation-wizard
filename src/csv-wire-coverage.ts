import type { CoverageRule, FormatPack } from "./types";
import { CSV_WIRE_RULE_IDS } from "./parsers/csv-wire";
export const CSV_WIRE_REVISION = "huntington-csv-wire-candidate-1.1.0";
export const CSV_WIRE_GUIDE = "Huntington CSV Wire public guide; accessed 2026-10-14; no published semantic version or exact update timestamp verified; functional extraction SHA-256 6fe82ba05375d5deb999713ed82b33b89347c6cbebbb3f8eae274d342c2a17cb; docs/sources/csv-wire-guide-extract.json";
export const CSV_WIRE_EXCLUSIONS = Object.freeze([
  "CANDIDATE only: no bank conformance, Product/SC/FT or rules/fixture approvals, Production activation or actual hosted ReadMe acceptance.",
  "Guide-backed positional USWIRE (54 fields) and INT (58 fields). INT is limited to USD, beneficiary country US/CA and account type OTHER. Non-USD timing, IBAN/applicability, other beneficiary countries and intermediary SWIFT (guide says 13 characters) are UNSUPPORTED with no verdict.",
  "Candidate transport: printable ASCII decoded as strict UTF-8, no BOM/tabs, quoted comma-separated fields including empty fields, doubled-quote escapes, LF/CRLF and optional final separator. Mixed LF/CRLF admitted. Embedded field line breaks, headers and custom mappings are unqualified. The guide samples use unquoted empty fields, contradicting its all-fields-quoted rule; candidate follows the explicit rule.",
  "Date checks capture the current UTC date once per run and record it in the date result. At most 30 calendar days ahead for domestic/INT USD. No past-date restriction is supplied by the guide. Bank time zone, holidays, cutoffs, CAD +1/other +2 business days are not qualified.",
  "Decimals require a point and digits with at most 2 domestic/3 international fractional digits and fewer than 18 significant digits. Leading zeros excluded, trailing fractional zeros included. Zero is admitted; guide gives no positive minimum. FX rate uses fewer than 10 significant digits and a 10-character N10 cap including its decimal point as a conservative candidate interpretation; no separate fractional scale is invented.",
  "Routing prefix/checksum and 11-character beneficiary BIC/country syntax are local checks, not live directory, bank/account existence, ownership, sanctions, entitlement, bank-populated address or acceptance checks. ISO country membership uses a frozen IANA 249-code snapshot.",
  "Optional intermediary code/type fields are paired as a disclosed candidate decision; no undocumented dependency is imposed on bank-populated names/addresses. FX Desk contract/rate authorization, exchange-rate calculations, settlement, duplicates and payment execution are excluded. No file data leaves the local worker or is persisted.",
  "Resource limits: existing 25 MB bytes, 8,000,000 decoded units and worker deadline; 100,000 retained row/cell nodes, 64 fields per row and 1,000,000 source units per field. Checks aggregate repeated violations and retain the first failing location without echoing field values.",
]);
const descriptions: Record<string, string> = {
  characters: "Printable-ASCII candidate transport; strict UTF-8 decoding precedes parsing.",
  framing: "Quoted fields, doubled quotes, commas, one row per payment and LF/CRLF boundaries; no header or blank rows.",
  layout: "Exactly 54 USWIRE or 58 INT fields; no truncation or automatic dialect switching.",
  required: "Nonblank mandatory fields from the corresponding guide table.",
  length: "C-field maximum lengths from the selected positional layout, applied to decoded field content.",
  reserved: "N/A fields are empty, including domestic charges and the originator block.",
  date: "Real YYYYMMDD date and USD 30-calendar-day upper bound against one recorded UTC reference day; no past-date floor.",
  amount: "Exact decimal lexical/scale/significant-digit checks; optional international credit amount and mandatory debit amount.",
  "debit-account": "Eleven digits for the mandatory debit account; no ownership claim.",
  "account-type": "OTHER for qualified domestic and international US/CA scenarios.",
  address: "Domestic address line 1/2 requires beneficiary city and country; international mandatory address fields use required checks.",
  country: "Populated country fields belong to the frozen uppercase ISO alpha-2 list.",
  bank: "Required primary type/code, ABA prefix/checksum, beneficiary 11-character BIC/country and paired optional ABA intermediaries.",
  charges: "International charges BEN or OUR; domestic charges are reserved/empty.",
  fx: "Optional rate decimal syntax, fewer than 10 significant digits and 10 characters including the point (conservative N10 interpretation); contract ID has C16 length check, no external authorization.",
};
export function csvWireCoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return [...CSV_WIRE_RULE_IDS, ...pack.rules.map(rule => rule.id)].map(id => ({ id,
    description: descriptions[id.replace(/^wire\./, "")] ?? "Nonempty source in trusted CSV Wire context.",
    ruleClass: "flat-file-structure", severity: "ERROR", applicability: "Selected CSV Wire USD candidate and qualified positional rows.",
    prerequisite: id === "wire.characters" ? "Decoded source" : id === "wire.framing" ? "Admitted characters" : id === "wire.layout" ? "Framed rows and recognized payment types" : "Framed row with exact positional layout and qualified scenario; optional checks only when applicable",
    reference: "https://developer.huntington.com/enterprisepayments/docs/wires-payments-automation; docs/CSV_WIRE_SOURCE_SCOPE.md",
    evidence: "tests/csv-wire.test.ts; tests/browser/csv-wire.spec.ts; demo-files/csv-wire/manifest.json; synthetic local evidence, no bank approval",
  }));
}
