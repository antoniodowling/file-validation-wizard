import type { CoverageRule, FormatPack } from "./types";
import { NACHA_RULE_IDS } from "./parsers/nacha";

export const NACHA_RULESET_REVISION = "nacha-public-1.2.0";
export const NACHA_GUIDE_REVISION = "Public sources reviewed 2026-10-14; reversal scope corrected 2026-10-29; origination-public-2026 subset; full current Operating Rules comparison deferred";
export const NACHA_EXCLUSIONS = Object.freeze([
  "CANDIDATE public-source subset only. No production approval, full 2026 Operating Rules compliance, bank acceptance, funds availability, or execution guarantee.",
  "No customer authorization, consent, account existence or eligibility, fraud approval, or real transaction-purpose verification; purpose-dependent PAYROLL/PURCHASE requirements are not established.",
  "Routing syntax, prefix and checksum do not verify bank routing-directory membership or external account/payment details.",
  "No holiday calendar, transmission cutoff, bank processing window, live-date qualification, or actual settlement verification.",
  "No historical or cross-file duplicate detection; trace uniqueness applies only within the admitted file.",
  "No MAC authentication or validation of embedded EDI, UN/EDIFACT, tax, healthcare, or other remittance content semantics.",
  "Only ordinary monetary CCD, PPD, CTX, WEB and TEL originations using transaction codes 22/27/32/37/52; other SEC/account codes, prenotes, zero-dollar remittance entries, returns/NOCs and reversals are outside the profile. Case-insensitive REVERSAL markers anywhere in the description produce UNSUPPORTED with no verdict (malformed-case admission is conservative tool policy).",
  "Field checks cover numeric syntax, constants, reserved spaces and required values, not complete alphabetic-field semantic validation or bank-specific identifier/padding policies.",
]);
const PUBLIC_REFERENCE = "docs/NACHA_SOURCE_REVIEW.md; https://achdevguide.nacha.org/ach-file-overview; https://achdevguide.nacha.org/ach-file-details; https://www.firstcitizens.com/content/dam/firstcitizens/pdfs/commercial/commercial-advantage/nacha-file-specs.pdf (revision 02/2024, CTX layouts); public-source subset, not a complete approved 2026 ruleset";
const ENVELOPES = "nacha.framing and nacha.ascii passed; nacha.record-order passed (framing, ASCII or order errors stop downstream field evaluation)";
// Description, applicability, prerequisite. These are promises of implemented
// checks, not a second rule evaluator or a licensed-rulebook conformance claim.
const METADATA: Readonly<Record<string, readonly [string, string, string]>> = {
  framing: ["Exactly 94 characters per record; complete concatenation or consistent LF/CRLF/CR delimiters, optional terminal delimiter, no blank records.", "Every admitted source.", "UTF-8 decoded source admitted"],
  ascii: ["Every record contains only printable ASCII characters; tabs, control characters and non-ASCII text fail.", "Every framed record.", "nacha.framing passed"],
  "record-order": ["One file header, complete nonempty batches, adjacent entry addenda, one file control, then only all-9 padding.", "Entire framed ASCII file.", "nacha.framing and nacha.ascii passed"],
  blocking: ["Total records, including all-9 padding, must form complete blocks of ten.", "Entire framed ASCII file, including files with an order failure.", "nacha.framing and nacha.ascii passed"],
  "file-header": ["Priority 01, size 094, block factor 10, format code 1, uppercase alphanumeric modifier, leading-blank destination routing and populated immediate origin.", "File header; origin is an assigned identifier, not forced to a routing number.", ENVELOPES],
  "creation-date": ["Creation date is a real YYMMDD calendar date interpreted in 2000–2099.", "File header creation date.", ENVELOPES],
  "creation-time": ["Optional creation time is blank or valid HHMM (00:00–23:59).", "File header creation time, including a blank optional time which passes.", ENVELOPES],
  "service-class": ["Batch service class is 200, 220 or 225.", "Each batch header.", ENVELOPES],
  "sec-code": ["SEC is CCD, PPD, CTX, WEB or TEL and belongs to the selected profile's supported SEC list.", "Each batch header.", ENVELOPES],
  "batch-required": ["Company name, identification and entry description are populated; REVERSAL is outside ordinary origination.", "Each batch header.", ENVELOPES],
  "effective-date": ["Effective entry date is a real YYMMDD calendar date interpreted in 2000–2099.", "Each batch header.", ENVELOPES],
  "effective-weekend": ["A valid effective entry date falling on Saturday or Sunday generates a WARNING; no holiday/cutoff determination.", "Each batch with a valid effective entry date; invalid dates suppress weekend evaluation as not evaluated.", `${ENVELOPES}; valid date for the evaluated batch`],
  "settlement-date": ["Settlement date must be blank or Julian 001–366. Invalid syntax/range is ERROR; a valid populated operator field generates WARNING.", "Each batch header; blank is permitted, populated values require operator-field caution.", ENVELOPES],
  "originator-status": ["Ordinary origination status code is 1.", "Each batch header.", ENVELOPES],
  odfi: ["Originating DFI is eight routing digits with a valid nonzero ABA prefix; no directory lookup.", "Each batch header.", ENVELOPES],
  "batch-number": ["Batch numbers are numeric, positive and ascending within the file; gaps are permitted.", "Each batch header, compared with preceding batch numbers.", ENVELOPES],
  "entry-required": ["Receiving account and name are populated, using the CTX-specific name positions when applicable.", "Each entry detail record.", ENVELOPES],
  "transaction-code": ["Only ordinary checking/savings credits/debits 22/27/32/37 and loan credit 52 are supported.", "Each entry detail; prenotes/nonmonetary codes are outside the profile.", ENVELOPES],
  "entry-amount": ["Entry amount is a positive ten-digit integer-cent value.", "Each ordinary monetary entry detail.", ENVELOPES],
  routing: ["Receiving routing number has nine digits, a valid nonzero ABA prefix and matching checksum; no directory membership proof.", "Each entry detail.", ENVELOPES],
  trace: ["Trace is fifteen digits with the batch ODFI prefix and a positive seven-digit sequence.", "Each entry detail.", ENVELOPES],
  "trace-order": ["Numeric trace sequence ascends within each batch; gaps are permitted.", "Each entry detail, compared with preceding entry sequences in its batch.", ENVELOPES],
  "trace-unique": ["Entry trace numbers are unique within the admitted file.", "All entry details in this file; no historical/cross-file comparison.", ENVELOPES],
  "sec-transaction": ["Entry direction matches credit-only/debit-only service class; TEL permits debits only.", "Each entry detail in its batch's SEC/service-class context.", ENVELOPES],
  "web-credit-originator": ["WEB credits have populated originator identification in the entry's identification field.", "WEB credit entries only; other SECs and WEB debits are not applicable.", ENVELOPES],
  "addenda-type": ["Payment addenda use type 05; return/notification addenda are outside the profile.", "Present addenda records; absent addenda are not applicable.", ENVELOPES],
  "addenda-indicator": ["Entry indicator is 0 without addenda or 1 with adjacent addenda.", "Every entry, including entries without addenda.", ENVELOPES],
  "addenda-count": ["TEL has no addenda, CCD/PPD/WEB at most one, CTX at most 9,999; CTX declared count equals actual following addenda.", "Every entry in its SEC context, including zero-addenda entries.", ENVELOPES],
  "addenda-sequence": ["Addenda sequence begins at 0001 and increases consecutively per entry.", "Present addenda records; absent addenda are not applicable.", ENVELOPES],
  "addenda-link": ["Addenda entry sequence is numeric and matches the preceding entry trace's final seven digits.", "Present addenda records; absent addenda are not applicable.", ENVELOPES],
  "batch-mirror": ["Batch control mirrors header service class, company identification, ODFI and batch number.", "Each batch control/header pair.", ENVELOPES],
  "batch-count": ["Batch numeric entry/addenda count equals actual entry plus addenda records.", "Each batch control.", ENVELOPES],
  "batch-hash": ["Batch numeric hash equals summed eight-digit receiving DFI prefixes modulo ten billion.", "Each batch control; numeric prefixes contribute even when their routing checksum is invalid.", ENVELOPES],
  "batch-debit": ["Batch numeric debit total equals interpreted entry amounts in exact integer cents.", "Each batch with interpretable numeric amounts and supported entry directions; otherwise not evaluated.", `${ENVELOPES}; all batch amounts numeric and transaction directions supported`],
  "batch-credit": ["Batch numeric credit total equals interpreted entry amounts in exact integer cents; debit/credit equality is not required.", "Each batch with interpretable numeric amounts and supported entry directions; otherwise not evaluated.", `${ENVELOPES}; all batch amounts numeric and transaction directions supported`],
  reserved: ["Batch/file control reserved fields and CTX entry reserved columns contain spaces.", "All batch/file controls and CTX entry details.", ENVELOPES],
  "file-batches": ["File numeric batch count equals actual complete batches.", "File control.", ENVELOPES],
  "file-blocks": ["File numeric block count equals total records divided by ten, with complete ten-record blocking required.", "File control, including padding records.", ENVELOPES],
  "file-count": ["File numeric entry/addenda count equals actual entry plus addenda records across batches.", "File control.", ENVELOPES],
  "file-hash": ["File numeric hash equals summed batch receiving DFI hashes modulo ten billion.", "File control; no external routing verification.", ENVELOPES],
  "file-debit": ["File numeric debit total equals interpreted entry amounts in exact integer cents across batches.", "File with interpretable amounts and supported directions in every batch; otherwise not evaluated.", `${ENVELOPES}; all file amounts numeric and transaction directions supported`],
  "file-credit": ["File numeric credit total equals interpreted entry amounts in exact integer cents; debit/credit equality is not required.", "File with interpretable amounts and supported directions in every batch; otherwise not evaluated.", `${ENVELOPES}; all file amounts numeric and transaction directions supported`],
  "non-empty-source": ["The admitted source contains non-whitespace text.", "Selected NACHA profile after trusted parser context is available.", ENVELOPES],
};

export function nachaCoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return [...new Set([...NACHA_RULE_IDS, ...pack.rules.map(rule => rule.id)])].map(id => {
    const metadata = METADATA[id.replace(/^nacha\./, "")];
    const configured = pack.rules.find(rule => rule.id === id);
    if (!metadata && !configured) throw new Error(`Missing NACHA coverage metadata: ${id}`);
    return {
      id, description: metadata?.[0] ?? configured!.description,
      ruleClass: id === "nacha.non-empty-source" ? "tool-policy" : "nacha-structure",
      severity: id === "nacha.effective-weekend" ? "WARNING" : "ERROR",
      applicability: `Selected profile ${pack.id} (${pack.version ?? "unavailable"}). ${metadata?.[1] ?? "Configured profile rule."}`,
      prerequisite: metadata?.[2] ?? ENVELOPES,
      reference: PUBLIC_REFERENCE,
      evidence: "tests/nacha-parser.test.ts; tests/nacha-fixtures.test.ts; tests/nacha-coverage.test.ts; demo-files/nacha/manifest.json; synthetic local evidence, not independent business approval or hosted/bank acceptance",
    };
  });
}
