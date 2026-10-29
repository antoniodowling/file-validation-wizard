import { UnsupportedInputError } from "../resource-policy";
import { ACH_ENTRY_TYPES } from "./nacha-entry-types";
import { ctxX12Syntax } from "./ach-remittance";
import { frameFixedRecords, totals, slice, digits, number, HASH_MOD, date, routingPrefix, routing, type RecordRow } from "./fixed-record";
import type { FindingLocation, FormatPack, RuleOutcome, RuleResult } from "../types";
import type { ParserOutput } from "./iso";

// Public origination subset, not bank acceptance or the complete Operating Rules.
// Layout: https://achdevguide.nacha.org/ach-file-details
// Ordering/codes: https://achdevguide.nacha.org/ach-file-overview
// CTX: First Citizens NACHA File Specifications, revision 02/2024, pp. 8–9.
// Loan credit 52: https://developer.gs.com/docs/services/transaction-banking/ach-file/
// ABA prefix ranges: US Treasury AttributeDataDictionary, ABA routing fields:
// https://www.fiscal.treasury.gov/data/FSv49/IAIv10/Library/AttributeDataDictionary.html
const IDS = [
  "framing", "ascii", "record-order", "blocking", "file-header", "creation-date", "creation-time",
  "service-class", "sec-code", "batch-required", "effective-date", "effective-weekend", "settlement-date",
  "originator-status", "odfi", "batch-number", "entry-required", "transaction-code", "entry-amount",
  "routing", "trace", "trace-order", "trace-unique", "sec-transaction", "web-credit-originator",
  "addenda-type", "addenda-indicator", "addenda-count", "addenda-sequence", "addenda-link",
  "batch-mirror", "batch-count", "batch-hash", "batch-debit", "batch-credit", "reserved",
  "file-batches", "file-blocks", "file-count", "file-hash", "file-debit", "file-credit",
] as const;
export const NACHA_RULE_IDS: readonly string[] = Object.freeze(IDS.map((id) => `nacha.${id}`));
const EXPANDED_IDS = ["field-padding", "reversal-marker", "reversal-transaction", "remittance-required", "ctx-remittance"] as const;
export const NACHA_EXPANDED_RULE_IDS: readonly string[] = Object.freeze([...NACHA_RULE_IDS, ...EXPANDED_IDS.map(id => `nacha.${id}`)]);
const ORIGINATION_R2_IDS = ["description-case", "description-sec", "healthcare-addenda", "healthcare-trn"] as const;
export const NACHA_ORIGINATION_R2_RULE_IDS: readonly string[] = Object.freeze([...NACHA_EXPANDED_RULE_IDS, ...ORIGINATION_R2_IDS.map(id => `nacha.${id}`)]);
type Id = typeof IDS[number] | typeof EXPANDED_IDS[number] | typeof ORIGINATION_R2_IDS[number];
interface Check { outcome: RuleOutcome; count: number; field: string; message: string; row: RecordRow | undefined; from: number; to: number; location: FindingLocation | undefined }
function location(check: Check): FindingLocation {
  if (check.location) return check.location;
  if (!check.row) return { kind: "file-wide", explanation: "This check applies to the entire ACH file." };
  return { kind: "located", primary: { kind: check.from === 1 && check.to === 94 || check.field === "Batch control identifiers" || check.field === "File header constants" ? "context" : "exact", label: `Record ${check.row.number}, columns ${check.from}-${check.to}`,
    span: { start: check.row.start + check.from - 1, end: Math.min(check.row.start + check.to, check.row.start + check.row.text.length) } }, related: [] };
}

export function parseNacha(source: string, pack: FormatPack): ParserOutput {
  const profile = pack.identifiers?.kind === "NACHA_FIXED" ? String(pack.identifiers.profile) : "";
  const originationR2 = profile === "origination-expanded-public-2026-r2";
  const expanded = originationR2 || profile === "origination-expanded-public-2026-r1";
  const checks = new Map<Id, Check>();
  const incompleteChecks = new Map<Id, string>();
  const conditionalAbsent = new Set<Id>(["addenda-type", "addenda-sequence", "addenda-link", "web-credit-originator", ...(expanded ? ["reversal-marker", "reversal-transaction", "remittance-required", "ctx-remittance"] as const : [])]);
  if (originationR2) for (const id of ORIGINATION_R2_IDS) conditionalAbsent.add(id);
  const incomplete = (id: Id, reason = "At least one applicable or potentially applicable entry has an uninterpretable prerequisite."): void => {
    conditionalAbsent.delete(id);
    if (!incompleteChecks.has(id)) incompleteChecks.set(id, reason);
  };
  // Aggregate by rule, retain the first offending field, and count every violation.
  // Memory and output remain bounded even for a 25 MB file with repeated errors.
  const check = (id: Id, ok: boolean, field: string, message: string, row?: RecordRow, from = 1, to = 94, warning = false, findingLocation?: FindingLocation): void => {
    const previous = checks.get(id);
    if (ok) {
      if (!previous) checks.set(id, { outcome: "PASS", count: 0, field, message: "The checked fields meet this profile's requirement.", row, from, to, location: findingLocation });
      return;
    }
    if (previous && previous.outcome !== "PASS") {
      if (previous.outcome === "WARNING" && !warning) checks.set(id, { outcome: "ERROR", count: previous.count + 1, field, message, row, from, to, location: findingLocation });
      else previous.count += 1;
      return;
    }
    checks.set(id, { outcome: warning ? "WARNING" : "ERROR", count: 1, field, message, row, from, to, location: findingLocation });
  };
  const finish = (parseable: boolean): ParserOutput => ({
    incompleteChecks: [...incompleteChecks].map(([id, reason]) => ({ ruleId: `nacha.${id}`, reason })),
    notApplicable: parseable ? [...conditionalAbsent].filter(id => !checks.has(id) && !incompleteChecks.has(id) && (id !== "web-credit-originator" || expanded || checks.get("transaction-code")?.outcome !== "ERROR")).map(id => `nacha.${id}`) : [],
    context: parseable ? ({ source, parserKind: "NACHA_FIXED" }) : null,
    results: [...checks].map(([id, c], ordinal) => Object.freeze({ ruleId: `nacha.${id}`, outcome: c.outcome,
      severity: c.outcome === "PASS" ? null : c.outcome, field: c.field,
      locator: c.row ? `Record ${c.row.number} / Columns ${c.from}-${c.to}` : "file",
      message: c.message + (c.count > 1 ? ` (${c.count} violations; first location shown.)` : ""),
      ordinal, location: location(c) }) as RuleResult),
  });
  const { rows, framing, badWidth } = frameFixedRecords(source, 94);
  check("framing", framing && !badWidth && rows.length > 0, "Record framing", "Use exactly 94 characters per record with consistent LF, CRLF, or CR separators, or concatenate complete records. Blank records and mixed framing are invalid.", badWidth);
  if (checks.get("framing")?.outcome === "ERROR") return finish(false);
  for (const row of rows) check("ascii", /^[\x20-\x7e]{94}$/.test(row.text), "Record characters", "Every record must contain printable ASCII characters; tabs and non-ASCII characters are invalid.", row);
  if (checks.get("ascii")?.outcome === "ERROR") return finish(false);

  // Establish envelopes before using their fields for any arithmetic.
  const batches: Array<{ header: RecordRow; entries: RecordRow[]; control: RecordRow }> = [];
  let pending: { header: RecordRow; entries: RecordRow[] } | null = null;
  let control: RecordRow | undefined;
  let entrySeen = false;
  check("record-order", rows[0]?.text[0] === "1", "Record sequence", "A single file header must be first, followed by one or more nonempty batches, one file control, then only all-9 padding.", rows[0]);
  for (const row of rows.slice(1)) {
    const type = row.text[0];
    let ok = true;
    if (control) ok = row.text === "9".repeat(94);
    else if (type === "5") {
      ok = !pending;
      if (ok) { pending = { header: row, entries: [] }; entrySeen = false; }
    } else if (type === "6") {
      ok = !!pending;
      if (pending) { pending.entries.push(row); entrySeen = true; }
    } else if (type === "7") {
      ok = !!pending && entrySeen;
      if (pending) pending.entries.push(row);
    } else if (type === "8") {
      ok = !!pending && entrySeen;
      if (pending) { batches.push({ ...pending, control: row }); pending = null; }
      entrySeen = false;
    } else if (type === "9" && row.text !== "9".repeat(94)) {
      ok = !pending && batches.length > 0;
      control = row;
    } else ok = false;
    check("record-order", ok, "Record sequence", "Records must follow file header, batch header, entries with adjacent addenda, batch control, file control, and all-9 padding.", row, 1, 1);
  }
  check("record-order", !pending && !!control && batches.length > 0, "Record sequence", "The file requires one or more complete nonempty batches and a closing file control.", rows.at(-1), 1, 1);
  check("blocking", rows.length % 10 === 0, "Blocking factor", "Pad the file with all-9 records to a multiple of ten records.");
  if (checks.get("record-order")?.outcome === "ERROR") return finish(false);
  const header = rows[0]!;
  const required = (row: RecordRow, from: number, to: number, id: Id, field: string): void =>
    check(id, !!slice(row, from, to).trim(), field, "This required field must be populated.", row, from, to);
  const reserved = (row: RecordRow, from: number, to: number): void => check("reserved", /^ +$/.test(slice(row, from, to)), "Reserved field", "Reserved fields must contain spaces.", row, from, to);
  // Immediate origin is an ODFI-assigned identifier and may be a company ID.
  // No bank-specific ID or routing substitution policy is imposed here.
  check("file-header", slice(header, 2, 3) === "01" && slice(header, 35, 40) === "094101" && /^[A-Z0-9]$/.test(slice(header, 34, 34)), "File header constants", "Priority 01, record size 094, blocking factor 10, format code 1, and an uppercase alphanumeric file modifier are required.", header, 2, 40);
  check("file-header", slice(header, 4, 4) === " " && routing(slice(header, 5, 13)), "Immediate destination", "Immediate destination must contain a leading blank and a valid nine-digit ABA routing number.", header, 4, 13);
  required(header, 14, 23, "file-header", "Immediate origin");
  check("creation-date", !!date(slice(header, 24, 29)), "File creation date", "File creation date must be a real calendar date in YYMMDD format.", header, 24, 29);
  const time = slice(header, 30, 33);
  check("creation-time", time === "    " || (/^\d{4}$/.test(time) && Number(time.slice(0, 2)) < 24 && Number(time.slice(2)) < 60), "File creation time", "Optional file creation time must be blank or a valid HHMM time.", header, 30, 33);
  const padding = (row: RecordRow, fields: readonly (readonly [number, number])[]): void => {
    if (!expanded) return;
    for (const [from, to] of fields) { const value = slice(row, from, to); check("field-padding", !value.trim() || !value.startsWith(" "), "Alphanumeric field padding", "Nonblank alphanumeric fields must be left justified with trailing space padding.", row, from, to); }
  };
  padding(header, [[41, 63], [64, 86], [87, 94]]);
  const file = totals();
  let fileHashKnown = true;
  let fileAmountsKnown = true;
  const traces = new Set<string>();
  let previousBatch = 0n;
  const supported = pack.identifiers?.kind === "NACHA_FIXED" ? pack.identifiers.secCodes : [];
  for (const batch of batches) {
    const bh = batch.header;
    const bc = batch.control;
    const sec = slice(bh, 51, 53);
    const service = slice(bh, 2, 4);
    if (!["CCD", "PPD", "CTX", "WEB", "TEL"].includes(sec) || !supported.includes(sec)) {
      incomplete("web-credit-originator");
      if (expanded) { incomplete("remittance-required"); incomplete("ctx-remittance"); }
    }
    check("service-class", ["200", "220", "225"].includes(service), "Service class", "Ordinary origination uses service class 200, 220, or 225.", bh, 2, 4);
    check("sec-code", ["CCD", "PPD", "CTX", "WEB", "TEL"].includes(sec) && supported.includes(sec), "Standard entry class", "This profile supports only CCD, PPD, CTX, WEB, and TEL batches.", bh, 51, 53);
    required(bh, 5, 20, "batch-required", "Company name");
    required(bh, 41, 50, "batch-required", "Company identification");
    required(bh, 54, 63, "batch-required", "Company entry description");
    const description = slice(bh, 54, 63);
    const upperDescription = description.toUpperCase();
    // Case-insensitive admission is conservative tool policy, not case normalization.
    if (!expanded && upperDescription.includes("REVERSAL")) throw new UnsupportedInputError("Declared reversal markers, including malformed-case variants, are outside the ordinary origination profile. Select an expanded profile; no format verdict is issued.");
    const payroll = originationR2 && upperDescription.includes("PAYROLL");
    const purchase = originationR2 && upperDescription.includes("PURCHASE");
    const healthcare = originationR2 && upperDescription === "HCCLAIMPMT";
    if (originationR2) {
      const markers = ["ACCTVERIFY", "PAYROLL", "PURCHASE", "RETRY PYMT", "REVERSAL", "RETURN FEE", "RECLAIM", "NONSETTLED", "AUTOENROLL", "REDEPCHECK", "NO CHECK", "HCCLAIMPMT"];
      for (const marker of markers) if (upperDescription.includes(marker)) check("description-case", description === upperDescription && (marker === "PAYROLL" ? description.startsWith(marker) : description.includes(marker)), "Company entry description case", "Declared standardized description fields must use uppercase letters, including suffixes. PAYROLL occupies the leftmost seven columns and permits three discretionary suffix characters.", bh, 54, 63);
      if (healthcare) check("description-sec", sec === "CCD", "Healthcare descriptor SEC", "HCCLAIMPMT declares a healthcare CCD entry.", bh, 51, 63);
    }
    const reversal = expanded && description.includes("REVERSAL");
    if (expanded && description.toUpperCase().includes("REVERSAL")) check("reversal-marker", reversal, "Reversal description", "A declared reversal must include uppercase REVERSAL within the Company Entry Description.", bh, 54, 63);
    padding(bh, [[5, 20], [21, 40], [41, 50], [54, 63], [64, 69]]);
    const effective = date(slice(bh, 70, 75));
    check("effective-date", !!effective, "Effective entry date", "Effective entry date must be a real calendar date in YYMMDD format.", bh, 70, 75);
    if (effective) check("effective-weekend", ![0, 6].includes(effective.getUTCDay()), "Effective entry date", "The effective entry date falls on a weekend. Confirm ACH processing dates and handling with the ODFI; this check does not determine a cutoff or holiday calendar.", bh, 70, 75, true);
    if (!effective) incomplete("effective-weekend", "At least one batch has an invalid effective date, so its weekend check was not evaluated.");
    const settlement = slice(bh, 76, 78);
    const julian = number(settlement);
    const settlementValid = settlement === "   " || (julian !== null && julian >= 1n && julian <= 366n);
    check("settlement-date", settlementValid, "Settlement date", "Settlement date must be blank or a numeric Julian day from 001 through 366.", bh, 76, 78);
    if (settlementValid && settlement !== "   ") check("settlement-date", false, "Settlement date", "Settlement date is inserted by the ACH operator. Confirm why it is already populated in an origination file.", bh, 76, 78, true);
    check("originator-status", slice(bh, 79, 79) === "1", "Originator status", "Ordinary origination requires originator status code 1.", bh, 79, 79);
    const odfi = slice(bh, 80, 87);
    check("odfi", routingPrefix(odfi), "Originating DFI identification", "Originating DFI identification must contain eight routing digits with a valid nonzero routing prefix.", bh, 80, 87);
    const batchNumber = number(slice(bh, 88, 94));
    check("batch-number", batchNumber !== null && batchNumber > previousBatch, "Batch number", "Batch numbers must be numeric, positive, and ascending within the file.", bh, 88, 94);
    if (batchNumber !== null) previousBatch = batchNumber;
    const bt = totals();
    let batchAmountsKnown = true;
    let batchHashKnown = true;
    let previousTrace = 0n;
    let current: RecordRow | undefined;
    let addenda = 0;
    let payload: string[] = [];
    let payloadRows: RecordRow[] = [];
    const payloadLocation = (): FindingLocation => {
      const targets = payloadRows.map(row => ({ kind: "context" as const, label: `Payment-related addenda payload: record ${row.number}, columns 4-83`, span: { start: row.start + 3, end: row.start + 83 } }));
      return { kind: "located", primary: targets[0]!, related: targets.slice(1), relatedTruncated: addenda > targets.length };
    };
    let payloadKnown = true;
    const finishEntry = (): void => {
      if (!current) return;
      const indicator = slice(current, 79, 79);
      if (expanded) {
        const entryType = ACH_ENTRY_TYPES[slice(current, 2, 3)];
        if (!entryType) {
          incomplete("remittance-required");
          if (sec === "CTX") incomplete("ctx-remittance");
        } else if (entryType.kind === "remittance" || (sec === "CTX" && entryType.kind !== "prenote")) {
          check("remittance-required", addenda > 0, "Required remittance addenda", "Zero-dollar remittance entries and live CTX entries require payment addenda; prenotes do not require associated live-entry addenda.", current, 79, 79);
        }
        if (healthcare && sec === "CCD") {
          if (!entryType) { incomplete("healthcare-addenda"); incomplete("healthcare-trn"); }
          else if (entryType.kind !== "prenote") {
            check("healthcare-addenda", indicator === "1" && addenda > 0, "Healthcare addenda", "Declared healthcare CCD entries require addenda and indicator 1, except prenotes.", current, 79, 79);
            if (addenda > 0 && payloadKnown) {
              // Retain all 80 payload columns; only final fixed-field padding is removed.
              // This checks a whole TRN segment, not the complete ASC X12 5010 835 guide.
              const trn = payload.join("").trimEnd();
              const elements = trn.slice(0, -1).split("*");
              check("healthcare-trn", /^TRN\*1\*[^*~\\]+\*[^*~\\]+(?:\*[^*~\\]*)?[~\\]$/.test(trn) && !!elements[2]?.trim() && !!elements[3]?.trim(), "Healthcare TRN segment", "Healthcare CCD payment addenda must contain a complete 835 reassociation TRN segment with trace type 1, trace number and originating company identifier. Full 835 business-guide conformance remains unverified.", payloadRows[0], 4, 83, false, payloadLocation());
            } else { incomplete("healthcare-trn"); }
          }
        }
        if (sec === "CTX" && addenda > 0) {
          if (payloadKnown) check("ctx-remittance", ctxX12Syntax(payload.join(""), pack), "CTX remittance syntax", "CTX X12 requires a complete transaction set with BPR or BPS and matching envelope references/counts. Complete X12 business-guide conformance is outside scope.", payloadRows[0], 4, 83, false, payloadLocation());
          else incomplete("ctx-remittance");
        }
      }
      check("addenda-indicator", indicator === (addenda ? "1" : "0"), "Addenda indicator", "Addenda indicator must be 0 without addenda or 1 when addenda are present.", current, 79, 79);
      check("addenda-count", addenda <= (sec === "CTX" ? 9999 : sec === "TEL" ? 0 : 1), "Addenda count", "TEL prohibits addenda; CCD, PPD, and WEB permit at most one, and CTX at most 9,999.", current, 79, 79);
      if (sec === "CTX") check("addenda-count", number(slice(current, 55, 58)) === BigInt(addenda), "CTX addenda count", "CTX entry addenda count must match its following addenda records.", current, 55, 58);
    };
    for (const row of batch.entries) {
      bt.count += 1n;
      if (row.text[0] === "7") {
        addenda += 1;
        if (expanded && (sec === "CTX" || (healthcare && sec === "CCD"))) { payload.push(slice(row, 4, 83)); if (payloadRows.length < 33) payloadRows.push(row); payloadKnown = payloadKnown && slice(row, 2, 3) === "05"; }
        check("addenda-type", slice(row, 2, 3) === "05", "Addenda type", "Only payment-related addenda type 05 is supported; return and notification addenda are outside this profile.", row, 2, 3);
        check("addenda-sequence", number(slice(row, 84, 87)) === BigInt(addenda), "Addenda sequence", "Addenda sequence must begin at 0001 and increase consecutively for each entry.", row, 84, 87);
        check("addenda-link", !!current && digits(slice(row, 88, 94)) && slice(row, 88, 94) === slice(current, 88, 94), "Addenda entry sequence", "Addenda entry sequence must match the final seven digits of its preceding entry trace.", row, 88, 94);
        continue;
      }
      finishEntry(); current = row; addenda = 0; payload = []; payloadRows = []; payloadKnown = true;
      const code = slice(row, 2, 3);
      const entryType = expanded ? ACH_ENTRY_TYPES[code] : undefined;
      if (expanded && entryType?.loan && ["WEB", "TEL"].includes(sec)) throw new UnsupportedInputError("Loan account combinations with WEB/TEL are not source-qualified in this candidate. No format verdict is issued.");
      const credit = expanded ? entryType?.direction === "credit" : ["22", "32", "52"].includes(code);
      const debit = expanded ? entryType?.direction === "debit" : ["27", "37"].includes(code);
      check("transaction-code", credit || debit, "Transaction code", expanded ? "Use a supported checking/savings/loan monetary, prenote or remittance transaction code. Return/NOC codes are outside origination." : "Only ordinary checking/savings credits and debits (22, 27, 32, 37) and loan credits (52) are supported; prenotes and nonmonetary entries are excluded.", row, 2, 3);
      const secKnown = ["CCD", "PPD", "CTX", "WEB", "TEL"].includes(sec) && supported.includes(sec);
      if (!expanded || (entryType && secKnown && ["200", "220", "225"].includes(service))) {
        check("sec-transaction", (service !== "220" || credit) && (service !== "225" || debit) &&
          (sec !== "TEL" || debit || (reversal && entryType?.kind === "monetary" && !entryType.loan)) &&
          (!expanded || entryType?.kind !== "remittance" || ["CCD", "CTX"].includes(sec)) &&
          (!expanded || !entryType?.loan || ["CCD", "CTX", "PPD"].includes(sec)),
          "SEC and service class transaction", expanded ? "Direction must match service class. Zero-dollar remittance is CCD/CTX only; loan types are qualified here only for CCD/CTX/PPD. TEL credits are checking/savings monetary reversals only." : "Entry direction must match service class; TEL permits debits only.", row, 2, 3);
      }
      else incomplete("sec-transaction", "At least one entry lacks a known SEC, service class or transaction type for this check.");
      if (originationR2 && (payroll || purchase)) {
        if (entryType && secKnown) check("description-sec", payroll ? sec === "PPD" && entryType.direction === "credit" : ["WEB", "TEL"].includes(sec) && entryType.direction === "debit", "Declared descriptor SEC and direction", "Declared PAYROLL is a PPD credit; declared PURCHASE is a WEB or permitted TEL debit. Purpose and TEL standing authorization cannot be established from this file.", row, 2, 3);
        else incomplete("description-sec");
      }
      if (expanded && (reversal || code === "55")) {
        if (entryType) check("reversal-transaction", reversal && entryType.kind === "monetary", "Reversal entry type", "Reversal entries must be monetary and loan debit 55 requires the REVERSAL description. Original matching, purpose and deadlines are unverified.", row, 2, 3);
        else incomplete("reversal-transaction");
      }
      if (sec === "WEB" && (expanded ? !entryType : !credit && !debit)) incomplete("web-credit-originator");
      required(row, 13, 29, "entry-required", "Receiving account");
      required(row, sec === "CTX" ? 59 : 55, sec === "CTX" ? 74 : 76, "entry-required", "Receiving name");
      if (sec === "CTX") reserved(row, 75, 76);
      if (sec === "WEB" && credit) required(row, 40, 54, "web-credit-originator", "WEB credit originator name");
      padding(row, [[13, 29], [40, 54], [sec === "CTX" ? 59 : 55, sec === "CTX" ? 74 : 76], [77, 78]]);
      const amount = number(slice(row, 30, 39));
      if (!expanded || entryType) check("entry-amount", amount !== null && (expanded && entryType?.kind !== "monetary" ? amount === 0n : amount > 0n), "Entry amount", expanded ? "Monetary entries require positive integer cents; prenotes and remittance-only codes require exactly zero cents in the ten-digit amount field." : "Ordinary monetary entries require a positive ten-digit amount in integer cents.", row, 30, 39);
      if (expanded && !entryType) incomplete("entry-amount", "At least one entry has an unknown transaction type, so its type-specific amount requirement was not evaluated.");
      if (amount === null || (!credit && !debit)) batchAmountsKnown = false;
      if (amount !== null) { if (credit) bt.credit += amount; if (debit) bt.debit += amount; }
      const rdfi = slice(row, 4, 12);
      check("routing", routing(rdfi), "Receiving routing number", "Receiving routing number must have a valid nonzero routing prefix and ABA check digit.", row, 4, 12);
      const prefix = number(slice(row, 4, 11));
      if (prefix === null) batchHashKnown = false;
      if (prefix !== null) bt.hash = (bt.hash + prefix) % HASH_MOD;
      const trace = slice(row, 80, 94);
      const sequence = number(trace.slice(8));
      check("trace", /^\d{15}$/.test(trace) && trace.slice(0, 8) === odfi && sequence !== null && sequence > 0n, "Trace number", "Trace number requires the batch ODFI prefix and a positive seven-digit sequence.", row, 80, 94);
      check("trace-order", sequence !== null && sequence > previousTrace, "Trace sequence", "Entry trace sequences must ascend within each batch; gaps are permitted.", row, 88, 94);
      if (sequence !== null) previousTrace = sequence;
      check("trace-unique", !traces.has(trace), "Trace uniqueness", "Entry trace numbers must be unique throughout the file.", row, 80, 94);
      traces.add(trace);
    }
    finishEntry();
    check("batch-mirror", slice(bc, 2, 4) === service && slice(bc, 45, 54) === slice(bh, 41, 50) && slice(bc, 80, 94) === slice(bh, 80, 94), "Batch control identifiers", "Batch control must mirror service class, company identification, originating DFI, and batch number from its header.", bc, 2, 94);
    reserved(bc, 74, 79);
    for (const [id, from, to, expected] of [["batch-count", 5, 10, bt.count], ["batch-hash", 11, 20, bt.hash], ["batch-debit", 21, 32, bt.debit], ["batch-credit", 33, 44, bt.credit]] as const)
      if ((batchAmountsKnown || (id !== "batch-debit" && id !== "batch-credit")) && (!expanded || batchHashKnown || id !== "batch-hash")) check(id, number(slice(bc, from, to)) === expected, "Batch control total", "Batch control numeric count, routing hash, or integer-cent total must equal its entry detail records.", bc, from, to);
    if (!batchAmountsKnown) for (const id of ["batch-debit", "batch-credit"] as const) incomplete(id, "At least one batch has an uninterpretable amount or transaction direction; its amount reconciliation was not evaluated.");
    if (expanded && !batchHashKnown) incomplete("batch-hash", "At least one batch has an uninterpretable routing prefix; its hash reconciliation was not evaluated.");
    fileHashKnown = fileHashKnown && batchHashKnown;
    fileAmountsKnown = fileAmountsKnown && batchAmountsKnown;
    file.count += bt.count; file.hash = (file.hash + bt.hash) % HASH_MOD; file.debit += bt.debit; file.credit += bt.credit;
  }
  const fc = control!;
  reserved(fc, 56, 94);
  for (const [id, from, to, expected] of [["file-batches", 2, 7, BigInt(batches.length)], ["file-blocks", 8, 13, BigInt(Math.floor(rows.length / 10))], ["file-count", 14, 21, file.count], ["file-hash", 22, 31, file.hash], ["file-debit", 32, 43, file.debit], ["file-credit", 44, 55, file.credit]] as const)
    if ((fileAmountsKnown || (id !== "file-debit" && id !== "file-credit")) && (!expanded || fileHashKnown || id !== "file-hash")) check(id, number(slice(fc, from, to)) === expected && (id !== "file-blocks" || rows.length % 10 === 0), "File control total", "File control numeric count, block count, routing hash, or integer-cent total must equal the complete file records.", fc, from, to);
  if (!fileAmountsKnown) for (const id of ["file-debit", "file-credit"] as const) incomplete(id, "File reconciliation requires interpretable amounts and directions in every entry.");
  if (expanded && !fileHashKnown) incomplete("file-hash", "File hash reconciliation requires interpretable routing prefixes in every entry.");
  return finish(true);
}
