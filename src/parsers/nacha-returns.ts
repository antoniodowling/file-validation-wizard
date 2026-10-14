import { UnsupportedInputError } from "../resource-policy";
import { ACH_ENTRY_TYPES } from "./nacha-entry-types";

import { frameFixedRecords, totals, slice, digits, number, HASH_MOD, date, routingPrefix, routing, type RecordRow } from "./fixed-record";
import type { FindingLocation, FormatPack, RuleOutcome, RuleResult } from "../types";
import type { ParserOutput } from "./iso";

// Ordinary network Returns/COR candidate. See docs/ACH_RETURNS_CANDIDATE.md.
const IDS = ["framing", "ascii", "record-order", "blocking", "file-header", "creation-date", "creation-time", "service-class", "sec-code", "batch-required", "effective-date", "settlement-date", "originator-status", "odfi", "batch-number", "entry-required", "transaction-code", "entry-amount", "routing", "trace", "trace-order", "trace-unique", "sec-transaction", "addenda-type", "addenda-indicator", "addenda-count", "addenda-link", "reason-code", "reason-applicability", "original-trace", "original-rdfi", "death-date", "return-information", "corrected-data", "batch-mirror", "batch-count", "batch-hash", "batch-debit", "batch-credit", "control-amount-syntax", "reserved", "file-batches", "file-blocks", "file-count", "file-hash", "file-debit", "file-credit"] as const;
export const NACHA_RETURNS_RULE_IDS: readonly string[] = Object.freeze(IDS.map(id => `nacha-returns.${id}`));
type Id = typeof IDS[number];
const RETURN_CODES = new Set(["R01","R02","R03","R04","R05","R06","R07","R08","R09","R10","R11","R12","R13","R14","R15","R16","R17","R18","R19","R20","R21","R22","R23","R24","R25","R26","R27","R28","R29","R30","R31","R32","R33","R34","R35","R36","R37","R38","R39","R40","R41","R42","R43","R44","R45","R46","R47","R50","R51","R52","R53","R61","R62","R67","R68","R69","R70","R71","R72","R73","R74","R75","R76","R77","R80","R81","R82","R83","R84","R85"]);
const SPECIAL = new Set(["R61","R62","R67","R68","R69","R70","R71","R72","R73","R74","R75","R76","R77"]);
const CHANGE_CODES = new Set(["C01","C02","C03","C05","C06","C07","C08","C09","C13","C14","C61","C62","C63","C64","C65","C66","C67","C68","C69"]);
const CREDIT = new Set(["21", "31", "51"]);
const DEBIT = new Set(["26", "36", "56"]);
const nonblank = (value: string): boolean => !!value.trim() && !/^0+$/.test(value.trim());
function correction(code: string, value: string): boolean {
  const account = (v: string): boolean => !!v.trim() && !v.startsWith(" ");
  const transaction = (v: string): boolean => !!ACH_ENTRY_TYPES[v];
  switch (code) {
    case "C01": return account(value.slice(0,17)) && /^ +$/.test(value.slice(17));
    case "C02": return routing(value.slice(0,9)) && /^ +$/.test(value.slice(9));
    case "C03": return routing(value.slice(0,9)) && value.slice(9,12) === "   " && account(value.slice(12,29));
    case "C05": return transaction(value.slice(0,2)) && /^ +$/.test(value.slice(2));
    case "C06": return account(value.slice(0,17)) && value.slice(17,20) === "   " && transaction(value.slice(20,22)) && /^ +$/.test(value.slice(22));
    case "C07": return routing(value.slice(0,9)) && account(value.slice(9,26)) && transaction(value.slice(26,28)) && value.slice(28) === " ";
    case "C09": return account(value.slice(0,22)) && /^ +$/.test(value.slice(22));
    default: return false;
  }
}
interface Check { outcome: RuleOutcome; count: number; field: string; message: string; row: RecordRow | undefined; from: number; to: number }
function location(check: Check): FindingLocation {
  if (!check.row) return { kind: "file-wide", explanation: "This check applies to the entire ACH file." };
  return { kind: "located", primary: { kind: check.from === 1 && check.to === 94 || check.field === "Batch control identifiers" || check.field === "File header constants" ? "context" : "exact", label: `Record ${check.row.number}, columns ${check.from}-${check.to}`,
    span: { start: check.row.start + check.from - 1, end: Math.min(check.row.start + check.to, check.row.start + check.row.text.length) } }, related: [] };
}

export function parseNachaReturns(source: string, pack: FormatPack): ParserOutput {
  const checks = new Map<Id, Check>();
  const incompleteChecks = new Set<Id>();
  const conditionalAbsent = new Set<Id>(["death-date", "return-information", "corrected-data", "reason-applicability"]);
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
    notApplicable: parseable ? [...conditionalAbsent].filter(id => !checks.has(id)).map(id => `nacha-returns.${id}`) : [],
    context: parseable ? ({ source, parserKind: "NACHA_RETURN_FIXED" as FormatPack["parserKind"] }) : null,
    results: [...checks].filter(([id,c]) => c.outcome !== "PASS" || !incompleteChecks.has(id)).map(([id, c], ordinal) => Object.freeze({ ruleId: `nacha-returns.${id}`, outcome: c.outcome,
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
  const file = totals();
  let fileHashKnown = true;
  let fileAmountsKnown = true;
  const traces = new Set<string>();
  let previousBatch = 0n;
  void pack;
  for (const batch of batches) {
    const bh = batch.header;
    const bc = batch.control;
    const sec = slice(bh, 51, 53);
    const service = slice(bh, 2, 4);
    const noc = sec === "COR";
    if (!["CCD", "PPD", "CTX", "WEB", "TEL", "COR"].includes(sec)) throw new UnsupportedInputError("SEC outside ordinary network Returns/COR candidate; no format verdict.");
    check("service-class", ["200", "220", "225"].includes(service), "Service class", "Use 200, 220 or 225; 280 accounting advice is outside this profile.", bh, 2, 4);
    check("sec-code", true, "SEC", "Admitted ordinary return SEC or administrative COR.", bh, 51, 53);
    for (const [from,to] of [[5,20],[41,50],[54,63]] as const) check("batch-required", nonblank(slice(bh,from,to)), "Batch required fields", "Company name, identification and description must be populated and not all zeros.", bh,from,to);
    check("effective-date", !!date(slice(bh,70,75)), "Effective entry date", "Use a real YYMMDD date; no timing or deadline qualification.", bh,70,75);
    const settlement = slice(bh,76,78); const julian = number(settlement);
    check("settlement-date", settlement === "   " || (julian !== null && julian >= 1n && julian <= 366n), "Settlement date", "Blank or Julian 001–366; no operator date verification.",bh,76,78);
    check("originator-status", ["1","2"].includes(slice(bh,79,79)), "Originator status", "Candidate admits institution/operator status 1 or 2; actor identity is not verified.",bh,79,79);
    const odfi = slice(bh, 80, 87);
    check("odfi", routingPrefix(odfi), "Originating DFI identification", "Originating DFI identification must contain eight routing digits with a valid nonzero routing prefix.", bh, 80, 87);
    const batchNumber = number(slice(bh, 88, 94));
    check("batch-number", batchNumber !== null && batchNumber > previousBatch, "Batch number", "Batch numbers must be numeric, positive, and ascending within the file.", bh, 88, 94);
    if (batchNumber !== null) previousBatch = batchNumber;
    const bt = totals();
    let batchAmountsKnown = true; // Explicit Treasury families + Nacha control definitions; Moov implementation corroborates.
    for (const [from,to] of [[21,32],[33,44]] as const) check("control-amount-syntax", number(slice(bc,from,to)) !== null, "Batch amount syntax", "Control amount must contain twelve integer-cent digits.",bc,from,to);
    let batchHashKnown = true;
    let previousTrace = 0n;
    let current: RecordRow | undefined;
    let addenda = 0;
    const finishEntry = (): void => {
      if (!current) return;
      check("addenda-indicator", slice(current,79,79) === "1", "Addenda indicator", "Returns and COR require indicator 1.",current,79,79);
      check("addenda-count", addenda === 1, "Addenda count", "Exactly one adjacent exception addenda is mandatory.",current,79,79);
      if (sec === "CTX") check("addenda-count", number(slice(current,55,58)) !== null, "CTX declared addenda count", "CTX declared count must be numeric; original-count preservation versus actual-count coherence is not evaluated.",current,55,58);
    };
    for (const row of batch.entries) {
      bt.count += 1n;
      if (row.text[0] === "7") {
        addenda += 1;
        const code = slice(row,4,6);
        if ((noc && CHANGE_CODES.has(code) && !["C01","C02","C03","C05","C06","C07","C09","C13"].includes(code)) || (!noc && SPECIAL.has(code))) throw new UnsupportedInputError(`Exception ${code} has an unqualified specialized layout or correction contract; no format verdict.`);
        check("addenda-type", slice(row,2,3) === (noc ? "98" : "99"), "Addenda type", "Ordinary COR requires 98; ordinary returns require 99.",row,2,3);
        check("reason-code", (noc ? CHANGE_CODES : RETURN_CODES).has(code), "Exception code", "Use an explicitly assigned reason/change code; continuous ranges are not accepted.",row,4,6);
        check("addenda-link", !!current && digits(slice(row,80,94)) && slice(row,80,94) === slice(current,80,94), "Addenda trace", "Full addenda trace equals its preceding entry detail trace.",row,80,94);
        check("original-trace", /^\d{15}$/.test(slice(row,7,21)) && nonblank(slice(row,7,21)), "Original trace", "Original trace is a populated fifteen-digit reference; original-file matching is excluded.",row,7,21);
        check("original-rdfi", routingPrefix(slice(row,28,35)), "Original RDFI", "Original RDFI reference is a valid eight-digit routing prefix; matching excluded.",row,28,35);
        if (noc) {
          reserved(row,22,27); reserved(row,65,79);
          if (code === "C13") check("corrected-data", nonblank(slice(row,36,64)), "C13 information", "C13 addenda format error requires populated correction information; remittance semantics are unverified.",row,36,64);
          if (["C01","C02","C03","C05","C06","C07","C09"].includes(code)) check("corrected-data", correction(code,slice(row,36,64)), "Corrected data", "Correction must follow its code-specific routing/account/transaction/identifier layout and reserved spaces.",row,36,64);
        } else if (RETURN_CODES.has(code)) {
          const dd = slice(row,22,27);
          check("death-date", dd === "      " || (["R14","R15"].includes(code) && !!date(dd)), "Date of death", "Optional real YYMMDD death date is allowed only for R14/R15.",row,22,27);
          if (code === "R17") check("return-information", nonblank(slice(row,36,79)), "Return information", "R17 requires explanatory information; legitimacy and questionable-use facts are unverified.",row,36,79);
          const entryCode = current ? slice(current,2,3) : "";
          if (!CREDIT.has(entryCode) && !DEBIT.has(entryCode)) { conditionalAbsent.delete("reason-applicability"); incompleteChecks.add("reason-applicability"); }
          if (CREDIT.has(entryCode) || DEBIT.has(entryCode)) {
            const debit = DEBIT.has(entryCode);
            const corporate = ["CCD","CTX"].includes(sec);
            const consumer = ["PPD","WEB","TEL"].includes(sec);
            let applicable = true;
            if (["R01","R05","R07","R08","R09","R10","R11","R29"].includes(code)) applicable = debit;
            if (["R05","R29","R31"].includes(code)) applicable &&= corporate;
            if (["R07","R10","R11"].includes(code)) applicable &&= consumer;
            if (code === "R23") applicable = CREDIT.has(entryCode);
            if (["R21","R33","R37","R38","R39","R40","R41","R42","R43","R44","R45","R46","R47","R50","R51","R52","R53","R80","R81","R82","R83","R84","R85"].includes(code)) applicable = false;
            check("reason-applicability", applicable, "Reason applicability", "Reason must apply to the admitted SEC and return transaction family; account/authorization facts are not verified.",row,4,6);
          }
        }
        if (!(noc ? CHANGE_CODES : RETURN_CODES).has(code)) {
          for (const id of (noc ? ["corrected-data"] : ["death-date","return-information","reason-applicability"]) as Id[]) { conditionalAbsent.delete(id); incompleteChecks.add(id); }
        }
        continue;
      }
      finishEntry(); current = row; addenda = 0;
      const code = slice(row,2,3); const credit = CREDIT.has(code); const debit = DEBIT.has(code);
      check("transaction-code", credit || debit, "Transaction code", "Network return/NOC families are 21/26/31/36/51/56; forward codes are invalid.",row,2,3);
      if ((credit || debit) && ["200","220","225"].includes(service)) check("sec-transaction", (service !== "220" || credit) && (service !== "225" || debit), "Service direction", "Credit families 21/31/51 and debit families 26/36/56 must match batch service class.",row,2,3);
      required(row, 13, 29, "entry-required", "Receiving account");
      required(row, sec === "CTX" ? 59 : 55, sec === "CTX" ? 74 : 76, "entry-required", "Receiving name");
      if (sec === "CTX") reserved(row, 75, 76);
      const amount = number(slice(row,30,39));
      check("entry-amount", amount !== null && (!noc || amount === 0n), "Entry amount", "Returns allow numeric zero or positive cents; COR must be exactly zero.",row,30,39);
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
      if ((batchAmountsKnown || (id !== "batch-debit" && id !== "batch-credit")) && (batchHashKnown || id !== "batch-hash")) check(id, number(slice(bc, from, to)) === expected, "Batch control total", "Batch control numeric count, routing hash, or integer-cent total must equal its entry detail records.", bc, from, to);
    if (!batchAmountsKnown) { incompleteChecks.add("batch-debit"); incompleteChecks.add("batch-credit"); }
    if (!batchHashKnown) incompleteChecks.add("batch-hash");
    fileHashKnown = fileHashKnown && batchHashKnown;
    fileAmountsKnown = fileAmountsKnown && number(slice(bc,21,32)) !== null && number(slice(bc,33,44)) !== null;
    file.count += bt.count; file.hash = (file.hash + bt.hash) % HASH_MOD; file.debit += number(slice(bc,21,32)) ?? 0n; file.credit += number(slice(bc,33,44)) ?? 0n;
  }
  const fc = control!;
  reserved(fc, 56, 94);
  for (const [from,to] of [[32,43],[44,55]] as const) check("control-amount-syntax", number(slice(fc,from,to)) !== null, "File amount syntax", "Control amount must contain twelve integer-cent digits.",fc,from,to);
  for (const [id, from, to, expected] of [["file-batches", 2, 7, BigInt(batches.length)], ["file-blocks", 8, 13, BigInt(Math.floor(rows.length / 10))], ["file-count", 14, 21, file.count], ["file-hash", 22, 31, file.hash], ["file-debit", 32, 43, file.debit], ["file-credit", 44, 55, file.credit]] as const)
    if ((fileAmountsKnown || (id !== "file-debit" && id !== "file-credit")) && (fileHashKnown || id !== "file-hash")) check(id, number(slice(fc, from, to)) === expected && (id !== "file-blocks" || rows.length % 10 === 0), "File control total", "File control count/block/hash must equal actual records; integer-cent amounts must equal declared batch control totals, which separately reconcile to supported numeric entries.", fc, from, to);
  return finish(true);
}
