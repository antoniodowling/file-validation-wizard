import { BAI2_DETAIL_CODES, BAI2_SUMMARY_CODES } from "../bai2-codes";
import { MAX_MODEL_NODES, MAX_SCALAR_UNITS, ResourceLimitError, UnsupportedInputError } from "../resource-policy";
import type { FindingLocation, FormatPack, RuleResult, SourceSpan } from "../types";
import type { ParserOutput } from "./iso";

export const BAI2_PROFILE = "huntington-bai2-public-2026-r1";
export const BAI2_RULE_IDS = Object.freeze([
  "characters", "framing", "continuation", "hierarchy", "layout", "file-header", "group-header",
  "account-id", "currency", "summary-code", "detail-code", "summary-fields", "amount",
  "trailer-fields", "account-total", "account-count", "group-total", "group-accounts", "group-count",
  "file-total", "file-groups", "file-count",
].map(id => `bai2.${id}`));

interface Field { value: string; span: SourceSpan }
interface Physical { start: number; end: number; number: number; text: string }
interface Logical { code: string; rows: Physical[]; fields: Field[] }
interface Account { header: Logical; entries: Logical[]; trailer: Logical }
interface Group { header: Logical; accounts: Account[]; trailer: Logical }

const value = (record: Logical, index: number): string => record.fields[index]?.value.trim() ?? "";
const integer = (text: string): bigint | null => /^-?\d{1,40}$/.test(text) ? BigInt(text) : null;
const count = (text: string): bigint | null => /^\d{1,40}$/.test(text) ? BigInt(text) : null;
const time = (text: string): boolean => text === "2400" || /^(?:[01]\d|2[0-3])[0-5]\d$/.test(text);
// A disclosed 2000–2099 candidate interpretation, not a bank-confirmed century rule.
function date(text: string): boolean {
  if (!/^\d{6}$/.test(text)) return false;
  const year = 2000 + Number(text.slice(0, 2)), month = Number(text.slice(2, 4)), day = Number(text.slice(4));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

/** Logical assembly retains original physical coordinates and counts. No selected data leaves the worker. */
export function parseBai2(source: string, pack: FormatPack): ParserOutput {
  if (pack.id !== BAI2_PROFILE || pack.identifiers?.kind !== "BAI2" || pack.identifiers.profile !== BAI2_PROFILE)
    throw new UnsupportedInputError("The selected BAI2 profile is outside this candidate revision.");
  const results: RuleResult[] = [];
  const add = (id: string, ok: boolean, message: string, record?: Logical, field?: number): void => {
    if (results.length >= 5000) throw new ResourceLimitError();
    const token = field === undefined ? undefined : record?.fields[field];
    const row = record?.rows[0];
    const location: FindingLocation = token && token.span.end > token.span.start
      ? { kind: "located", primary: { kind: "exact", label: `${record!.code} field ${field! + 1}`, span: token.span }, related: [] }
      : row ? { kind: "located", primary: { kind: "context", label: `${record!.code} record context`, span: { start: row.start, end: row.end } },
        related: record!.rows.slice(1, 33).map(part => ({ kind: "context", label: `Continuation line ${part.number}`, span: { start: part.start, end: part.end } })),
        ...(record!.rows.length > 33 ? { relatedTruncated: true } : {}) }
      : { kind: "file-wide", explanation: "This check applies to the BAI2 document." };
    results.push({ ruleId: `bai2.${id}`, outcome: ok ? "PASS" : "ERROR", severity: ok ? null : "ERROR", field: `BAI2 ${id}`,
      locator: row ? `Line ${row.number} / ${record!.code}${field === undefined ? "" : ` / Field ${field + 1}`}` : "file",
      message: ok ? "The source meets this candidate check." : message, ordinal: results.length, location });
  };
  add("characters", /^[\x20-\x7e\r\n]*$/.test(source), "Use printable ASCII with LF, CRLF or CR record separators. BOMs, tabs and other characters are excluded by the candidate transport policy.");
  if (results.at(-1)!.outcome === "ERROR") return { context: null, results };

  const logical: Logical[] = [];
  const lines = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let physicalCount = 0, fieldCount = 0;
  for (const match of source.matchAll(lines)) {
    if (match.index === source.length) break; // A single final separator is allowed.
    if (++physicalCount > MAX_MODEL_NODES) throw new ResourceLimitError();
    const text = match[1]!;
    const row: Physical = { start: match.index!, end: match.index! + text.length, number: physicalCount, text };
    const code = text.slice(0, 2);
    const context: Logical = { code, rows: [row], fields: [] };
    if (!/^\d{2},/.test(text) || !text.endsWith("/") || text.length < 4) {
      add("framing", false, "Each nonblank physical record must start with its two-digit code and comma, and end with '/'.", text ? context : undefined);
      return { context: null, results };
    }
    if (!["01", "02", "03", "16", "88", "49", "98", "99"].includes(code))
      throw new UnsupportedInputError("This BAI2 candidate supports records 01, 02, 03, 16, 88, 49, 98 and 99 only.");
    const previous = logical.at(-1);
    if (code === "88" && !previous) {
      add("continuation", false, "An 88 continuation must have a preceding logical record.", context);
      return { context: null, results };
    }
    // After the sixth comma in a 16 record, continuation payload is opaque text,
    // including commas and slashes. It contributes no new monetary fields.
    if (code === "88" && text.length === 4) {
      add("continuation", false, "An 88 record must carry continuation content.", context);
      return { context: null, results };
    }
    if (code === "88" && previous!.code === "16" && previous!.fields.length >= 7) {
      if (text.length > MAX_SCALAR_UNITS) throw new ResourceLimitError();
      previous!.rows.push(row);
      continue;
    }
    const bodyStart = code === "88" ? 3 : 0;
    const body = text.slice(bodyStart, -1);
    const detail = code === "16" || (code === "88" && previous!.code === "16");
    if (!detail && body.includes("/")) {
      add("framing", false, "Structured fields cannot contain a slash. Concatenated physical records are outside this line-based candidate.", context);
      return { context: null, results };
    }
    const fields: Field[] = [];
    let offset = row.start + bodyStart;
    // Preserve comma positions, including the final optional empty field.
    // Bound field allocation before split; a hostile delimiter stream must not allocate millions of nodes.
    for (let start = 0; start <= body.length;) {
      if (++fieldCount > MAX_MODEL_NODES) throw new ResourceLimitError();
      const inText = detail && (code === "16" ? fields.length >= 6 : previous!.fields.length - 1 + fields.length >= 6);
      const comma = inText ? -1 : body.indexOf(",", start), end = comma === -1 ? body.length : comma;
      if (end - start > MAX_SCALAR_UNITS) throw new ResourceLimitError();
      fields.push({ value: body.slice(start, end), span: { start: offset + start, end: offset + end } });
      if (!inText && fields.at(-1)!.value.includes("/")) {
        add("framing", false, "Structured fields cannot contain a slash; transaction text is preserved separately.", context);
        return { context: null, results };
      }
      if (comma === -1) break;
      start = comma + 1;
    }
    if (code === "88") {
      const last = previous!.rows.at(-1)!;
      if (!last.text.endsWith(",/"))
        throw new UnsupportedInputError("Structured continuations require a complete field boundary (',/' before 88). Splitting a scalar across records is not specified by this candidate.");
      // The guide's 03 sample ends a complete tuple with its empty funds field
      // before an 88 starts a new tuple. That empty field is data, not a spare
      // delimiter placeholder. At other field boundaries the final empty slot
      // is replaced by the first continuation field.
      const completedSummary = previous!.code === "03" && previous!.fields.length >= 3 && (previous!.fields.length - 3) % 4 === 0;
      const carriedCurrency = previous!.code === "03" && previous!.fields.length === 3 && /^[A-Z]{3}$/.test(fields[0]?.value.trim() ?? "");
      if (!completedSummary || carriedCurrency) previous!.fields.pop();
      for (const field of fields) previous!.fields.push(field);
      previous!.rows.push(row);
    } else logical.push({ ...context, fields });
  }
  add("framing", physicalCount > 0, "Provide a nonempty line-delimited BAI2 document.");
  if (!physicalCount) return { context: null, results };
  add("continuation", true, "Continuations must attach to a preceding logical record.");

  // Establish ownership before field/count checks so malformed nesting cannot manufacture totals.
  const groups: Group[] = [];
  let fileHeader: Logical | undefined, fileTrailer: Logical | undefined;
  let groupHeader: Logical | undefined, accountHeader: Logical | undefined;
  let accounts: Account[] = [], entries: Logical[] = [];
  let bad: Logical | undefined;
  for (const record of logical) {
    if (fileTrailer) { bad = record; break; }
    switch (record.code) {
      case "01": if (fileHeader || groups.length || groupHeader) bad = record; else fileHeader = record; break;
      case "02": if (!fileHeader || groupHeader || accountHeader) bad = record; else { groupHeader = record; accounts = []; } break;
      case "03": if (!groupHeader || accountHeader) bad = record; else { accountHeader = record; entries = []; } break;
      case "16": if (!accountHeader) bad = record; else entries.push(record); break;
      case "49": if (!accountHeader) bad = record; else { accounts.push({ header: accountHeader, entries, trailer: record }); accountHeader = undefined; } break;
      case "98": if (!groupHeader || accountHeader || !accounts.length) bad = record; else { groups.push({ header: groupHeader, accounts, trailer: record }); groupHeader = undefined; } break;
      case "99": if (!fileHeader || groupHeader || accountHeader || !groups.length) bad = record; else fileTrailer = record; break;
    }
    if (bad) break;
  }
  add("hierarchy", !bad && !!fileHeader && !!fileTrailer && !groupHeader && !accountHeader,
    "Require one 01…99 file, one or more 02…98 groups, and one or more 03…49 accounts in each group. Detail records belong inside an account.", bad ?? logical.at(-1));
  if (results.at(-1)!.outcome === "ERROR") return { context: null, results };

  const layouts = new Map<Logical, boolean>();
  for (const record of logical) {
    const n = record.fields.length;
    const ok = record.code === "01" ? n === 9 : record.code === "02" ? n >= 5 && n <= 8
      : record.code === "03" ? n >= 2 : record.code === "16" ? n >= 2
      : record.code === "49" ? n === 3 : n === 4;
    layouts.set(record, ok);
    add("layout", ok, "The logical record has an invalid field count for its record type; optional trailing fields may be omitted on 02/03/16.", record);
  }
  const currency = (record: Logical, index: number): void => {
    const text = value(record, index);
    if (/^[A-Z]{3}$/.test(text) && text !== "USD") throw new UnsupportedInputError("Only USD or an omitted currency is qualified by this Huntington BAI2 candidate.");
    add("currency", !text || text === "USD", "Currency must be omitted or USD in this candidate.", record, index);
  };
  const codeCheck = (record: Logical, index: number, summary: boolean): void => {
    const text = value(record, index), known = BAI2_SUMMARY_CODES.has(text) || BAI2_DETAIL_CODES.has(text);
    if (/^\d{3}$/.test(text) && !known) throw new UnsupportedInputError("An unqualified three-digit BAI2 type code was found. This candidate uses the frozen Huntington guide code list.");
    add(summary ? "summary-code" : "detail-code", (summary ? BAI2_SUMMARY_CODES : BAI2_DETAIL_CODES).has(text),
      "Use a three-digit code listed at the correct summary/status or detail level in the candidate's Huntington source.", record, index);
  };
  const monetary = (record: Logical, index: number, required = false): bigint | null => {
    const text = value(record, index), amount = integer(text);
    add("amount", (!required && !text) || amount !== null, "Use an integer amount with no decimal point (candidate admits an optional minus sign and at most 40 digits).", record, index);
    return !text && !required ? 0n : amount;
  };
  if (layouts.get(fileHeader!)) {
    const f = fileHeader!;
    if (value(f, 8) && value(f, 8) !== "2") throw new UnsupportedInputError("This candidate supports BAI version 2 only.");
    if (value(f, 6) || value(f, 7)) throw new UnsupportedInputError("Declared physical record length and blocking are unqualified; this candidate supports the guide's unblocked empty-field scenario.");
    add("file-header", !!value(f, 1) && !!value(f, 2) && date(value(f, 3)) && time(value(f, 4)) && !!value(f, 5) && value(f, 8) === "2",
      "Populate sender, receiver and file ID; use a real YYMMDD date, HHMM time (2400 allowed), and version 2. Example identity defaults are not required.", f);
  }
  const physicalThrough = (start: Logical, end: Logical): bigint => BigInt(end.rows.at(-1)!.number - start.rows[0]!.number + 1);
  const trailer = (record: Logical): bigint | null => {
    if (!layouts.get(record)) return null;
    const total = monetary(record, 1, true);
    for (let i = 2; i < record.fields.length; i++) add("trailer-fields", count(value(record, i)) !== null, "Trailer counts must be unsigned integers of at most 40 digits.", record, i);
    return total;
  };
  let fileSum = 0n, fileKnown = true;
  for (const group of groups) {
    const g = group.header;
    if (layouts.get(g)) {
      if (value(g, 7) && value(g, 7) !== "2") throw new UnsupportedInputError("As-of-date modifiers other than the guide's previous-day value 2 are unqualified. Omitted modifiers are admitted without inferring reporting mode.");
      add("group-header", !!value(g, 2) && value(g, 3) === "1" && date(value(g, 4)) && (!value(g, 5) || time(value(g, 5))),
        "Populate originator, group status 1 and a real YYMMDD as-of date; optional as-of time must be HHMM (2400 allowed).", g);
      currency(g, 6);
    }
    let groupSum = 0n, groupKnown = true;
    for (const account of group.accounts) {
      const a = account.header;
      let accountSum = 0n, accountKnown = !!layouts.get(a);
      if (layouts.get(a)) {
        add("account-id", /^[1-9]\d*$/.test(value(a, 1)), "Use a populated numeric account identifier without leading zeros; surrounding field spaces are tolerated as in the guide sample.", a, 1);
        currency(a, 2);
        for (let i = 3; i < a.fields.length; i += 4) {
          if (a.fields.slice(i, i + 4).every(field => !field.value.trim())) continue;
          codeCheck(a, i, true);
          const amount = monetary(a, i + 1);
          if (amount === null) accountKnown = false; else accountSum += amount;
          add("summary-fields", (!value(a, i + 2) || /^0+$/.test(value(a, i + 2))), "A present summary item count must be zero in the Huntington guide scenario.", a, i + 2);
          if (value(a, i + 3)) throw new UnsupportedInputError("Nonempty funds availability fields are unqualified: Huntington's guide does not specify their additional-field grammar.");
        }
      }
      for (const detail of account.entries) {
        if (!layouts.get(detail)) { accountKnown = false; continue; }
        codeCheck(detail, 1, false);
        const amount = monetary(detail, 2);
        if (amount === null) accountKnown = false; else accountSum += amount;
        if (value(detail, 3)) throw new UnsupportedInputError("Nonempty detail funds availability fields are outside the source-qualified candidate scenario.");
      }
      const declared = trailer(account.trailer);
      if (declared !== null && accountKnown) add("account-total", declared === accountSum, "Account control total must equal the sum of reported summary and detail amounts, including fields carried by 88 records, counted once.", account.trailer, 1);
      if (layouts.get(account.trailer) && count(value(account.trailer, 2)) !== null) add("account-count", count(value(account.trailer, 2)) === physicalThrough(a, account.trailer), "Account record count must include 03, every attached 88 and 16, and 49 (including its continuations).", account.trailer, 2);
      if (declared === null) groupKnown = false; else groupSum += declared;
    }
    const declared = trailer(group.trailer);
    if (declared !== null && groupKnown) add("group-total", declared === groupSum, "Group control total must equal the sum of its account trailer control totals.", group.trailer, 1);
    if (layouts.get(group.trailer)) {
      if (count(value(group.trailer, 2)) !== null) add("group-accounts", count(value(group.trailer, 2)) === BigInt(group.accounts.length), "Group account count must equal its number of 03 records.", group.trailer, 2);
      if (count(value(group.trailer, 3)) !== null) add("group-count", count(value(group.trailer, 3)) === physicalThrough(g, group.trailer), "Group record count must include 02 through 98 and all their continuations.", group.trailer, 3);
    }
    if (declared === null) fileKnown = false; else fileSum += declared;
  }
  const declared = trailer(fileTrailer!);
  if (declared !== null && fileKnown) add("file-total", declared === fileSum, "File control total must equal the sum of its group trailer control totals.", fileTrailer!, 1);
  if (layouts.get(fileTrailer!)) {
    if (count(value(fileTrailer!, 2)) !== null) add("file-groups", count(value(fileTrailer!, 2)) === BigInt(groups.length), "File group count must equal its number of 02 records.", fileTrailer!, 2);
    if (count(value(fileTrailer!, 3)) !== null) add("file-count", count(value(fileTrailer!, 3)) === BigInt(physicalCount), "File record count must include every physical record, including 01, 99 and all continuations.", fileTrailer!, 3);
  }
  const notApplicable = accountDetailAbsent(groups) ? ["bai2.detail-code"] : [];
  if (groups.every(group => group.accounts.every(account => account.header.fields.slice(3).every(field => !field.value.trim()))))
    notApplicable.push("bai2.summary-code", "bai2.summary-fields");
  return { context: { source, parserKind: "BAI2" }, results, notApplicable };
}

function accountDetailAbsent(groups: readonly Group[]): boolean {
  return groups.every(group => group.accounts.every(account => !account.entries.length));
}
