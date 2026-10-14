import type { FormatPack, RuleResult, SourceSpan } from "../types";
import type { ParserOutput } from "./iso";
import { MAX_DECODED_UNITS, MAX_MODEL_NODES, MAX_SCALAR_UNITS, ResourceLimitError, UnsupportedInputError } from "../resource-policy";
import { routing } from "./fixed-record";
import { WIRE_LAYOUTS } from "./csv-wire-layouts";
import { WIRE_COUNTRIES } from "./csv-wire-countries";

export const CSV_WIRE_PROFILE = "huntington-csv-wire-public-2026-r1";
export const CSV_WIRE_RULE_IDS = Object.freeze(["characters", "framing", "layout", "required", "length", "reserved", "date", "amount", "debit-account", "account-type", "address", "country", "bank", "charges", "fx"].map(id => `wire.${id}`));
interface Cell { readonly value: string; readonly span: SourceSpan }
interface Row { readonly cells: readonly Cell[]; readonly span: SourceSpan; readonly number: number }
const unsupported = (message: string): never => { throw new UnsupportedInputError(`${message} CSV Wire candidate: no format verdict for this scenario.`); };

// Decimal strings stay exact. Leading zeros do not count as significant;
// trailing fractional zeros do. No positivity requirement is invented.
function decimal(value: string, scale: number | null, significantLimit: number, integerLimit: number): boolean {
  if (!/^\d+\.\d+$/.test(value)) return false;
  const [whole = "", fraction = ""] = value.split(".");
  return whole.length <= integerLimit && (scale === null || fraction.length <= scale)
    && value.replace(".", "").replace(/^0+/, "").length < significantLimit;
}
function calendar(value: string): number | null {
  if (!/^\d{8}$/.test(value) || value.slice(0, 4) === "0000") return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso ? time : null;
}

export function parseCsvWire(source: string, pack: FormatPack): ParserOutput {
  if (pack.id !== CSV_WIRE_PROFILE || pack.identifiers?.kind !== "CSV_WIRE" || pack.identifiers.profile !== CSV_WIRE_PROFILE) unsupported("Unknown CSV Wire profile.");
  if (source.length > MAX_DECODED_UNITS) throw new ResourceLimitError();
  const results: RuleResult[] = [];
  const checks = new Map<string, { ok: boolean; count: number; field: string; message: string; span?: SourceSpan; exact: boolean; row?: number }>();
  const check = (id: string, ok: boolean, field: string, message: string, row?: Row, cell?: Cell): void => {
    const old = checks.get(id);
    if (!old || (old.ok && !ok)) checks.set(id, { ok, count: ok ? 0 : 1, field, message, ...(cell ? { span: cell.span } : row ? { span: row.span } : {}), exact: !!cell, ...(row ? { row: row.number } : {}) });
    else if (!ok) old.count++;
  };
  const output = (context = false): ParserOutput => {
    for (const [id, c] of checks) results.push({ ruleId: `wire.${id}`, ordinal: results.length, outcome: c.ok ? "PASS" : "ERROR", severity: c.ok ? null : "ERROR", field: c.field,
      locator: c.row ? `Row ${c.row}: ${c.field}` : "file", message: c.message + (c.count > 1 ? ` (${c.count} violations; first location shown.)` : ""),
      location: c.span ? { kind: "located", primary: { kind: c.exact ? "exact" : "context", label: c.field, span: c.span }, related: [] } : { kind: "file-wide", explanation: "This check concerns CSV Wire file admission." } });
    return { context: context ? { source, parserKind: "CSV_WIRE" } : null, results,
      notApplicable: context ? CSV_WIRE_RULE_IDS.filter(id => !checks.has(id.slice(5))) : [] };
  };
  check("characters", !/[^\x20-\x7e\r\n]/.test(source), "CSV Wire characters", "Candidate transport requires printable ASCII decoded as strict UTF-8; no BOM, tabs or control characters.");
  if (!checks.get("characters")!.ok) return output();
  const rows: Row[] = [];
  let offset = 0; let nodes = 0;
  // Streaming scanner bounds allocations before retaining cells/rows. Every field,
  // including an empty field, is quoted. Doubled quotes escape a literal quote.
  while (offset < source.length) {
    const start = offset; const cells: Cell[] = []; let complete = false;
    while (!complete) {
      const cellStart = offset;
      if (source[offset] !== '"') {
        check("framing", false, "CSV Wire framing", "Quote every field, including empty fields; use comma separators, LF/CRLF rows, no header, blank rows or trailing comma.", { cells, span: { start, end: Math.min(offset + 1, source.length) }, number: rows.length + 1 });
        return output();
      }
      offset++; let value = ""; let fragment = offset; let closed = false;
      while (offset < source.length) {
        if (offset - cellStart > MAX_SCALAR_UNITS) throw new ResourceLimitError();
        const char = source[offset];
        if (char === "\r" || char === "\n") unsupported("Embedded line breaks in fields are not qualified by the guide.");
        if (char === '"') {
          value += source.slice(fragment, offset);
          if (source[offset + 1] === '"') { value += '"'; offset += 2; fragment = offset; continue; }
          offset++; closed = true; break;
        }
        offset++;
      }
      if (!closed) { check("framing", false, "CSV Wire framing", "A quoted field is not closed.", { cells, span: { start: cellStart, end: offset }, number: rows.length + 1 }); return output(); }
      if (++nodes > MAX_MODEL_NODES || cells.length >= 64) throw new ResourceLimitError();
      cells.push({ value, span: { start: cellStart, end: offset } });
      if (source[offset] === ",") { offset++; continue; }
      if (offset === source.length || source[offset] === "\n" || source.slice(offset, offset + 2) === "\r\n") complete = true;
      else { check("framing", false, "CSV Wire framing", "Only a comma, LF/CRLF row separator or end of file may follow the closing quote.", { cells, span: { start: offset, end: Math.min(offset + 1, source.length) }, number: rows.length + 1 }); return output(); }
    }
    if (++nodes > MAX_MODEL_NODES) throw new ResourceLimitError();
    rows.push({ cells, span: { start, end: offset }, number: rows.length + 1 });
    if (source[offset] === "\r") offset += 2; else if (source[offset] === "\n") offset++;
  }
  check("framing", rows.length > 0, "CSV Wire framing", "Nonempty quoted comma-separated records; one payment per row, no header, LF/CRLF and optional final separator.");
  if (!rows.length) return output();
  // Capture one reference day per run. Date results retain it in JSON/CSV for
  // reproducibility. UTC is a disclosed candidate convention, not bank time.
  const referenceDay = new Date().toISOString().slice(0, 10);
  const latest = Date.parse(`${referenceDay}T00:00:00Z`) + 30 * 86400000;
  for (const row of rows) {
    const f = (n: number): string => row.cells[n - 1]?.value ?? "";
    const type = f(1);
    if (type !== "USWIRE" && type !== "INT") unsupported("Only USWIRE and INT payment rows are supported; headers/custom mappings are excluded.");
    const intl = type === "INT"; const layout = intl ? WIRE_LAYOUTS.INT : WIRE_LAYOUTS.USWIRE;
    check("layout", row.cells.length === layout.length, "CSV Wire layout", `Require exactly ${layout.length} fields for ${type}.`, row);
    if (row.cells.length !== layout.length) continue;
    if (intl && f(5) && f(5) !== "USD") unsupported("Non-USD currency and CAD/other business-day scheduling require bank-calendar qualification.");
    if (intl && f(11) === "IBAN") unsupported("IBAN country/account rules and the guide's undefined S34 format are not qualified.");
    if (intl && WIRE_COUNTRIES.has(f(17)) && !["US", "CA"].includes(f(17))) unsupported("International beneficiary countries outside US/CA need qualified IBAN applicability rules.");
    for (const n of intl ? [31, 51] : []) if (f(n) === "SWIFT") unsupported("The guide specifies 13-character intermediary SWIFT/BIC codes without a resolvable grammar.");
    const at = (id: string, ok: boolean, n: number, message: string): void => check(id, ok, layout[n - 1]!.name, message, row, row.cells[n - 1]);
    layout.forEach((field, i) => {
      const n = i + 1; const value = f(n);
      at("required", !field.required || value.trim().length > 0, n, "Mandatory fields must contain nonblank data.");
      if (field.max !== null) at("length", value.length <= field.max, n, `Value must fit the guide's C${field.max} printable-character limit.`);
      if (field.blank) at("reserved", value === "", n, "The guide marks this field N/A; leave it empty.");
    });
    const when = calendar(f(2));
    at("date", when !== null && when <= latest, 2, `Use a real YYYYMMDD date no later than 30 calendar days after UTC reference date ${referenceDay}. The guide supplies no past-date limit; bank-day/cutoff eligibility is excluded.`);
    for (const n of intl ? [3, 7] : [3]) if (!intl || n === 7 || f(n)) at("amount", decimal(f(n), intl ? 3 : 2, 18, 18), n, `Amount requires digits, a decimal point, 1–${intl ? 3 : 2} fractional digits and fewer than 18 significant figures; signs/grouping/exponents are excluded.`);
    at("debit-account", /^\d{11}$/.test(f(intl ? 6 : 5)), intl ? 6 : 5, "Debit account must contain exactly 11 digits; no ownership or entitlement check is performed.");
    at("account-type", f(intl ? 11 : 7) === "OTHER", intl ? 11 : 7, "The qualified beneficiary account type is OTHER; IBAN scenarios receive no verdict.");
    if (!intl) {
      at("address", !(f(9) || f(10)) || !!f(11).trim(), 11, "Beneficiary city is required when either beneficiary address line is populated.");
      at("address", !(f(9) || f(10)) || !!f(13).trim(), 13, "Beneficiary country is required when either beneficiary address line is populated.");
    }
    for (const n of intl ? [17, 24, 36, 49, 56] : [13, 20, 32, 44, 52]) if (f(n)) at("country", WIRE_COUNTRIES.has(f(n)), n, "Use an uppercase ISO 3166-1 alpha-2 country code from the frozen candidate list.");
    const primary = intl ? 19 : 15;
    at("bank", f(primary) === (intl ? "SWIFT" : "ABA"), primary, `Beneficiary bank code type must be ${intl ? "SWIFT" : "ABA"}.`);
    at("bank", intl ? /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}[A-Z0-9]{3}$/.test(f(20)) && WIRE_COUNTRIES.has(f(20).slice(4, 6)) : routing(f(16)), intl ? 20 : 16, intl ? "Beneficiary SWIFT/BIC requires 11 characters and a recognized country; directory membership is not verified." : "Beneficiary ABA requires nine digits, a nonzero eligible prefix and a valid checksum; directory membership is not verified.");
    if (intl && f(24)) at("bank", f(24) === f(20).slice(4, 6), 24, "Populated beneficiary bank country must match BIC characters 5–6.");
    for (const n of intl ? [31, 51] : [27, 46]) {
      if (f(n) || f(n + 1)) {
        at("bank", f(n) === "ABA", n, "A populated intermediary code pair requires type ABA in this candidate; international SWIFT intermediary grammar is unsupported.");
        at("bank", routing(f(n + 1)), n + 1, "A populated intermediary code pair requires a nine-digit ABA with valid prefix/checksum.");
      }
    }
    if (intl) {
      at("charges", ["BEN", "OUR"].includes(f(25)), 25, "International charges must be BEN or OUR.");
      if (f(8)) at("fx", decimal(f(8), null, 10, 10), 8, "FX rate requires a decimal point, digits and fewer than 10 significant figures; FX Desk authorization is not verified.");
    }
  }
  const valid = [...checks.values()].every(c => c.ok);
  return output(valid);
}
