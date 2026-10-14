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
type Id = typeof IDS[number];
interface RecordRow { text: string; start: number; number: number }
interface Check { outcome: RuleOutcome; count: number; field: string; message: string; row: RecordRow | undefined; from: number; to: number }
interface Totals { count: bigint; hash: bigint; debit: bigint; credit: bigint }
const totals = (): Totals => ({ count: 0n, hash: 0n, debit: 0n, credit: 0n });
const slice = (row: RecordRow, from: number, to: number): string => row.text.slice(from - 1, to);
const digits = (value: string): boolean => /^\d+$/.test(value);
const number = (value: string): bigint | null => digits(value) ? BigInt(value) : null;
const HASH_MOD = 10_000_000_000n;
function date(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  const parsed = new Date(Date.UTC(2000 + yy, mm - 1, dd));
  return parsed.getUTCFullYear() === 2000 + yy && parsed.getUTCMonth() === mm - 1 && parsed.getUTCDate() === dd ? parsed : null;
}
function routingPrefix(value: string): boolean {
  const prefix = Number(value.slice(0, 2));
  return /^\d{8}$/.test(value) && value !== "00000000" &&
    ((prefix >= 0 && prefix <= 12) || (prefix >= 21 && prefix <= 32) || (prefix >= 61 && prefix <= 72) || prefix === 80);
}
function routing(value: string): boolean {
  if (!/^\d{9}$/.test(value) || !routingPrefix(value.slice(0, 8))) return false;
  return [...value].reduce((sum, digit, index) => sum + Number(digit) * ([3, 7, 1][index % 3] ?? 0), 0) % 10 === 0;
}
function location(check: Check): FindingLocation {
  if (!check.row) return { kind: "file-wide", explanation: "This check applies to the entire ACH file." };
  return { kind: "located", primary: { kind: check.from === 1 && check.to === 94 || check.field === "Batch control identifiers" || check.field === "File header constants" ? "context" : "exact", label: `Record ${check.row.number}, columns ${check.from}-${check.to}`,
    span: { start: check.row.start + check.from - 1, end: Math.min(check.row.start + check.to, check.row.start + check.row.text.length) } }, related: [] };
}

export function parseNacha(source: string, pack: FormatPack): ParserOutput {
  const checks = new Map<Id, Check>();
  // Aggregate by rule, retain the first offending field, and count every violation.
  // Memory and output remain bounded even for a 25 MB file with repeated errors.
  const check = (id: Id, ok: boolean, field: string, message: string, row?: RecordRow, from = 1, to = 94, warning = false): void => {
    const previous = checks.get(id);
    if (ok) {
      if (!previous) checks.set(id, { outcome: "PASS", count: 0, field, message: "The checked fields meet this profile's requirement.", row, from, to });
      return;
    }
    if (previous && previous.outcome !== "PASS") {
      if (previous.outcome === "WARNING" && !warning) checks.set(id, { outcome: "ERROR", count: previous.count + 1, field, message, row, from, to });
      else previous.count += 1;
      return;
    }
    checks.set(id, { outcome: warning ? "WARNING" : "ERROR", count: 1, field, message, row, from, to });
  };
  const finish = (parseable: boolean): ParserOutput => ({
    context: parseable ? ({ source, parserKind: "NACHA_FIXED" }) : null,
    results: [...checks].map(([id, c], ordinal) => Object.freeze({ ruleId: `nacha.${id}`, outcome: c.outcome,
      severity: c.outcome === "PASS" ? null : c.outcome, field: c.field,
      locator: c.row ? `Record ${c.row.number} / Columns ${c.from}-${c.to}` : "file",
      message: c.message + (c.count > 1 ? ` (${c.count} violations; first location shown.)` : ""),
      ordinal, location: location(c) }) as RuleResult),
  });
  const rows: RecordRow[] = [];
  const firstDelimiter = /\r\n|\r|\n/.exec(source);
  let framing = source.length > 0;
  let badWidth: RecordRow | undefined;
  if (firstDelimiter) {
    const delimiter = firstDelimiter[0];
    const separators = /\r\n|\r|\n/g;
    let start = 0;
    let match: RegExpExecArray | null;
    // Validate each boundary before retaining a row. Delimiter-heavy malformed
    // input must not allocate arrays proportional to every newline in the file.
    while ((match = separators.exec(source)) !== null) {
      const row = { text: source.slice(start, match.index), start, number: rows.length + 1 };
      if (match[0] !== delimiter || row.text.length !== 94) {
        framing = false;
        badWidth = row;
        break;
      }
      rows.push(row);
      start = match.index + match[0].length;
    }
    if (framing && start < source.length) {
      const row = { text: source.slice(start), start, number: rows.length + 1 };
      if (row.text.length !== 94) { framing = false; badWidth = row; }
      else rows.push(row);
    }
  } else {
    framing = framing && source.length % 94 === 0;
    if (framing) {
      for (let start = 0; start < source.length; start += 94) rows.push({ text: source.slice(start, start + 94), start, number: rows.length + 1 });
    }
  }
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
  const file = totals();
  let fileAmountsKnown = true;
  const traces = new Set<string>();
  let previousBatch = 0n;
  const supported = pack.identifiers?.kind === "NACHA_FIXED" ? pack.identifiers.secCodes : [];
  for (const batch of batches) {
    const bh = batch.header;
    const bc = batch.control;
    const sec = slice(bh, 51, 53);
    const service = slice(bh, 2, 4);
    check("service-class", ["200", "220", "225"].includes(service), "Service class", "Ordinary origination uses service class 200, 220, or 225.", bh, 2, 4);
    check("sec-code", ["CCD", "PPD", "CTX", "WEB", "TEL"].includes(sec) && supported.includes(sec), "Standard entry class", "This profile supports only CCD, PPD, CTX, WEB, and TEL batches.", bh, 51, 53);
    required(bh, 5, 20, "batch-required", "Company name");
    required(bh, 41, 50, "batch-required", "Company identification");
    required(bh, 54, 63, "batch-required", "Company entry description");
    check("batch-required", slice(bh, 54, 63).trim() !== "REVERSAL", "Company entry description", "Reversal batches are outside this ordinary origination profile.", bh, 54, 63);
    const effective = date(slice(bh, 70, 75));
    check("effective-date", !!effective, "Effective entry date", "Effective entry date must be a real calendar date in YYMMDD format.", bh, 70, 75);
    if (effective) check("effective-weekend", ![0, 6].includes(effective.getUTCDay()), "Effective entry date", "The effective entry date falls on a weekend. Confirm ACH processing dates and handling with the ODFI; this check does not determine a cutoff or holiday calendar.", bh, 70, 75, true);
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
    let previousTrace = 0n;
    let current: RecordRow | undefined;
    let addenda = 0;
    const finishEntry = (): void => {
      if (!current) return;
      const indicator = slice(current, 79, 79);
      check("addenda-indicator", indicator === (addenda ? "1" : "0"), "Addenda indicator", "Addenda indicator must be 0 without addenda or 1 when addenda are present.", current, 79, 79);
      check("addenda-count", addenda <= (sec === "CTX" ? 9999 : sec === "TEL" ? 0 : 1), "Addenda count", "TEL prohibits addenda; CCD, PPD, and WEB permit at most one, and CTX at most 9,999.", current, 79, 79);
      if (sec === "CTX") check("addenda-count", number(slice(current, 55, 58)) === BigInt(addenda), "CTX addenda count", "CTX entry addenda count must match its following addenda records.", current, 55, 58);
    };
    for (const row of batch.entries) {
      bt.count += 1n;
      if (row.text[0] === "7") {
        addenda += 1;
        check("addenda-type", slice(row, 2, 3) === "05", "Addenda type", "Only payment-related addenda type 05 is supported; return and notification addenda are outside this profile.", row, 2, 3);
        check("addenda-sequence", number(slice(row, 84, 87)) === BigInt(addenda), "Addenda sequence", "Addenda sequence must begin at 0001 and increase consecutively for each entry.", row, 84, 87);
        check("addenda-link", !!current && digits(slice(row, 88, 94)) && slice(row, 88, 94) === slice(current, 88, 94), "Addenda entry sequence", "Addenda entry sequence must match the final seven digits of its preceding entry trace.", row, 88, 94);
        continue;
      }
      finishEntry(); current = row; addenda = 0;
      const code = slice(row, 2, 3);
      const credit = ["22", "32", "52"].includes(code);
      const debit = ["27", "37"].includes(code);
      check("transaction-code", credit || debit, "Transaction code", "Only ordinary checking/savings credits and debits (22, 27, 32, 37) and loan credits (52) are supported; prenotes and nonmonetary entries are excluded.", row, 2, 3);
      check("sec-transaction", (service !== "220" || credit) && (service !== "225" || debit) && (sec !== "TEL" || debit), "SEC and service class transaction", "Entry direction must match service class; TEL permits debits only.", row, 2, 3);
      required(row, 13, 29, "entry-required", "Receiving account");
      required(row, sec === "CTX" ? 59 : 55, sec === "CTX" ? 74 : 76, "entry-required", "Receiving name");
      if (sec === "CTX") reserved(row, 75, 76);
      if (sec === "WEB" && credit) required(row, 40, 54, "web-credit-originator", "WEB credit originator name");
      const amount = number(slice(row, 30, 39));
      check("entry-amount", amount !== null && amount > 0n, "Entry amount", "Ordinary monetary entries require a positive ten-digit amount in integer cents.", row, 30, 39);
      if (amount === null || (!credit && !debit)) batchAmountsKnown = false;
      if (amount !== null) { if (credit) bt.credit += amount; if (debit) bt.debit += amount; }
      const rdfi = slice(row, 4, 12);
      check("routing", routing(rdfi), "Receiving routing number", "Receiving routing number must have a valid nonzero routing prefix and ABA check digit.", row, 4, 12);
      const prefix = number(slice(row, 4, 11));
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
      if (batchAmountsKnown || (id !== "batch-debit" && id !== "batch-credit")) check(id, number(slice(bc, from, to)) === expected, "Batch control total", "Batch control numeric count, routing hash, or integer-cent total must equal its entry detail records.", bc, from, to);
    fileAmountsKnown = fileAmountsKnown && batchAmountsKnown;
    file.count += bt.count; file.hash = (file.hash + bt.hash) % HASH_MOD; file.debit += bt.debit; file.credit += bt.credit;
  }
  const fc = control!;
  reserved(fc, 56, 94);
  for (const [id, from, to, expected] of [["file-batches", 2, 7, BigInt(batches.length)], ["file-blocks", 8, 13, BigInt(Math.floor(rows.length / 10))], ["file-count", 14, 21, file.count], ["file-hash", 22, 31, file.hash], ["file-debit", 32, 43, file.debit], ["file-credit", 44, 55, file.credit]] as const)
    if (fileAmountsKnown || (id !== "file-debit" && id !== "file-credit")) check(id, number(slice(fc, from, to)) === expected && (id !== "file-blocks" || rows.length % 10 === 0), "File control total", "File control numeric count, block count, routing hash, or integer-cent total must equal the complete file records.", fc, from, to);
  return finish(true);
}
