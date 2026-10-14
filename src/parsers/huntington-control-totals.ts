import { UnsupportedInputError } from "../resource-policy";
import type { FormatPack, RuleResult } from "../types";
import type { ParserOutput } from "./iso";
import { frameFixedRecords, slice, type RecordRow } from "./fixed-record";

export const CONTROL_TOTAL_RULE_IDS = Object.freeze(["framing", "ascii", "origin", "company", "credit", "debit", "transmission-date"].map(id => `ach-totals.${id}`));

/** Published fields; single printable-ASCII record framing is a disclosed candidate admission policy. */
export function parseHuntingtonControlTotals(source: string, _pack: FormatPack): ParserOutput {
  const results: RuleResult[] = [];
  const add = (id: string, ok: boolean, field: string, message: string, row?: RecordRow, from = 1, to = 58): void => {
    results.push(Object.freeze({ ruleId: `ach-totals.${id}`, outcome: ok ? "PASS" : "ERROR", severity: ok ? null : "ERROR", field,
      locator: row ? `Record ${row.number} / Columns ${from}-${to}` : "file", message: ok ? "The field meets this candidate's requirement." : message,
      ordinal: results.length, location: row ? { kind: "located", primary: { kind: "exact", label: `Record ${row.number}, columns ${from}-${to}`,
        span: { start: row.start + from - 1, end: Math.min(row.start + to, row.start + row.text.length) } }, related: [] } : { kind: "file-wide", explanation: "This check applies to the standalone control-total file." } } satisfies RuleResult));
  };
  // Avoid allocating a fixed-record model for an input far outside this one-record scenario.
  if (source.length > 118) throw new UnsupportedInputError("This control-total candidate supports one 58-column record. Multiple-record documents are outside its declared scenario.");
  const framed = frameFixedRecords(source, 58);
  add("framing", framed.framing && !framed.badWidth && framed.rows.length > 0, "Control-total framing", "Use one 58-column record, optionally followed by one LF, CRLF, or CR delimiter. Blank lines and a BOM are not part of this candidate scenario.", framed.badWidth);
  if (!framed.framing || framed.badWidth || !framed.rows.length) return { context: null, results };
  if (framed.rows.length !== 1) throw new UnsupportedInputError("This candidate supports a single control-total record; multi-record documents receive no validity verdict.");
  const row = framed.rows[0]!;
  add("ascii", /^[\x20-\x7e]{58}$/.test(row.text), "Control-total characters", "The candidate admits printable ASCII only, preserving byte/column correspondence and rejecting tabs, BOMs and multibyte characters.", row);
  if (results.at(-1)?.outcome === "ERROR") return { context: null, results };
  add("origin", !!slice(row, 1, 10).trim(), "Immediate origin", "Populate the ten-position origin field. A leading blank is retained; no bank-specific identifier or companion-file equality is assumed.", row, 1, 10);
  const company = slice(row, 11, 26);
  add("company", !!company.trim() && !/[a-z]/.test(company), "Company name", "Populate the company name using uppercase letters; Huntington's source prohibits lowercase names. No companion-file truncation or equality is checked.", row, 11, 26);
  add("credit", /^\d{12}$/.test(slice(row, 27, 38)), "Credit amount", "Credit amount must contain twelve unsigned, right-justified, zero-filled integer-cent digits, without a decimal point.", row, 27, 38);
  add("debit", /^\d{12}$/.test(slice(row, 39, 50)), "Debit amount", "Debit amount must contain twelve unsigned, right-justified, zero-filled integer-cent digits, without a decimal point.", row, 39, 50);
  const value = slice(row, 51, 58);
  let validDate = false;
  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4)), month = Number(value.slice(4, 6)), day = Number(value.slice(6));
    const parsed = new Date(0); parsed.setUTCFullYear(year, month - 1, day); parsed.setUTCHours(0, 0, 0, 0);
    validDate = year > 0 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }
  add("transmission-date", validDate, "Transmission date", "Use a real calendar date in CCYYMMDD format. Actual transmission time, collection window and companion-file date are outside standalone validation.", row, 51, 58);
  return { context: { source, parserKind: "ACH_CONTROL_FIXED" }, results };
}
