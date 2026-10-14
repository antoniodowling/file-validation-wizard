import type { FormatPack, ParserKind, RuleResult } from "../types";
import type { ParserOutput } from "./iso";
import { MAX_DECODED_UNITS, MAX_MODEL_NODES, MAX_SCALAR_UNITS, ResourceLimitError, UnsupportedInputError } from "../resource-policy";

export const ACK_PROFILE = "huntington-ack-pipe-1.0-candidate-r1";
export const ACK_RULE_IDS: readonly string[] = Object.freeze(["framing", "record-order", "header", "file-identification", "status", "message", "batch", "validation-report", "control", "trailer", "timestamp-order"].map(id => `ack.${id}`));
type Status = "RECEIVED" | "ACCEPTED" | "REJECTED";
export interface AckReportedDisposition {
  readonly file: { readonly status: Status; readonly qualifier: string };
  readonly batches: readonly { readonly batchNumber: string; readonly batchReference: string; readonly status: Status; readonly qualifier: string }[];
}
export interface AckParserOutput extends ParserOutput { readonly reportedDisposition?: AckReportedDisposition }
interface Row { readonly text: string; readonly start: number; readonly number: number; readonly fields: readonly string[] }
const TAGS = new Set(["HDR", "FIL", "STA", "MSG", "BAT", "VAL", "CTL", "TRL"]);
const FIL_KEYS = new Set(["InboundFileName", "CorrelationId", "OriginalFileSizeBytes", "Transport", "ChecksumAlgo", "Checksum"]);
const CTL_KEYS = new Set(["DeclaredRecordCount", "ReceivedRecordCount", "DeclaredHash", "ReceivedHash"]);
const integer = (value: string | undefined): boolean => value !== undefined && /^\d+$/.test(value);
const positive = (value: string | undefined): boolean => integer(value) && /[1-9]/.test(value!);
function timestamp(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 19) === value.slice(0, 19) ? time : null;
}
function unsupported(message: string): never { throw new UnsupportedInputError(`${message} This ACK candidate issues no format verdict for that input.`); }

/** Local sample-based syntax scenario; bank disposition is separate from format validity. */
export function parseHuntingtonAck(source: string, pack: FormatPack): AckParserOutput {
  const identifiers = pack.identifiers as unknown as { kind?: string; profile?: string } | null;
  if (pack.id !== ACK_PROFILE || identifiers?.kind !== "HUNTINGTON_ACK" || identifiers.profile !== ACK_PROFILE) unsupported("The selected ACK profile is outside this scenario.");
  if (source.length > MAX_DECODED_UNITS) throw new ResourceLimitError();
  const rows: Row[] = [];
  let physicalRows = 0; let modelNodes = 0;
  for (let start = 0; start < source.length;) {
    const newline = source.indexOf("\n", start);
    const end = newline === -1 ? source.length : newline;
    const text = source.slice(start, source[end - 1] === "\r" && newline !== -1 ? end - 1 : end);
    if (++physicalRows > MAX_MODEL_NODES || text.length > MAX_SCALAR_UNITS) throw new ResourceLimitError();
    if (text.trim() && !text.startsWith("#")) {
      const fields = text.split("|", 33);
      modelNodes += 1 + fields.length;
      if (fields.length > 32 || modelNodes > MAX_MODEL_NODES) throw new ResourceLimitError();
      rows.push({ text, start, number: physicalRows, fields });
    }
    start = newline === -1 ? source.length : newline + 1;
  }
  for (const row of rows) {
    if (!row.text.includes("|") && /^(HDR|FIL|STA|MSG|BAT|VAL|CTL|TRL)[,\t;]/.test(row.text)) unsupported("Only the pipe delimiter is supported.");
  }
  const framed = !source.startsWith("\ufeff") && !/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\ufeff]/.test(source) && !/\r(?!\n)/.test(source);
  if (!framed || rows.length === 0) return { context: null, results: [{ ruleId: "ack.framing", ordinal: 0, outcome: "ERROR", severity: "ERROR", field: "ACK syntax", locator: "file", message: "Use nonempty UTF-8 decoded pipe records with LF or CRLF, no BOM or control characters; blank lines and # comments are admitted.", location: { kind: "file-wide", explanation: "Invalid ACK framing prevents record interpretation." } }] };
  for (const row of rows) {
    const tag = row.fields[0]!;
    if (!TAGS.has(tag)) unsupported("An unrecognized ACK record tag is outside this scenario.");
    if (tag === "HDR" && row.fields[2] && row.fields[2] !== "1.0") unsupported("Only ACK version 1.0 is supported.");
    if (tag === "STA" && row.fields[2] && !["RECEIVED", "ACCEPTED", "REJECTED"].includes(row.fields[2])) unsupported("An unrecognized disposition code is outside this scenario.");
  }
  const checks = new Map<string, { ok: boolean; count: number; row?: Row; message: string }>();
  const check = (id: string, ok: boolean, message: string, row?: Row): void => {
    const old = checks.get(id);
    if (!old || (old.ok && !ok)) checks.set(id, { ok, count: ok ? 0 : 1, ...(row ? { row } : {}), message });
    else if (!ok) old.count++;
  };
  check("framing", framed && rows.length > 0, "Use nonempty UTF-8 decoded pipe records with LF or CRLF, no BOM or control characters; blank lines and # comments are admitted.", rows[0]);
  let phase = 0; // 0 HDR, 1 FIL, 2 optional body, 3 CTL, 4 TRL
  let file: AckReportedDisposition["file"] | undefined;
  let pending: { batchNumber: string; batchReference: string } | undefined;
  const batches: AckReportedDisposition["batches"][number][] = [];
  const batchNumbers = new Set<string>();
  const fileFields = new Map<string, string>();
  let headerTime: number | null = null; let trailerTime: number | null = null;
  let bodyStage = 0; // messages, batches, validation reports
  for (const row of rows) {
    const f = row.fields; const tag = f[0]!;
    let ordered = false;
    if (tag === "HDR") {
      ordered = phase === 0; phase = 1;
      headerTime = timestamp(f[4]);
      check("header", f.length === 6 && f[1] === "ACK" && f[2] === "1.0" && f[3] === "FILE_RECEIVED_ACK" && headerTime !== null && f[5] === "UTC", "Expected HDR|ACK|1.0|FILE_RECEIVED_ACK|real UTC ISO timestamp|UTC.", row);
    } else if (tag === "FIL") {
      ordered = phase === 1;
      let valid = f.length >= 3 && f.length % 2 === 1;
      for (let i = 1; i < f.length; i += 2) {
        const key = f[i]!; const value = f[i + 1];
        if (!FIL_KEYS.has(key)) unsupported("An unrecognized FIL field is outside this scenario.");
        valid &&= !fileFields.has(key) && !!value?.trim() && (key !== "OriginalFileSizeBytes" || integer(value));
        if (value !== undefined) fileFields.set(key, value);
      }
      check("file-identification", valid, "FIL records contain distinct known name/value pairs; original size is nonnegative digits and other values are opaque populated text.", row);
    } else if (tag === "STA") {
      const status = f[2] as Status; const qualifier = f[3] ?? "";
      if (f[1] === "FILE") {
        ordered = phase === 1 && file === undefined;
        phase = 2; file = { status, qualifier };
        check("status", (f.length === 4 || (f.length === 6 && f[4] === "ParserVersion" && !!f[5]?.trim())) && !!qualifier.trim() && !!f[2], "One FILE STA has status, populated qualifier, and optional ParserVersion pair; BATCH STA has exactly four fields.", row);
      } else if (f[1] === "BATCH") {
        ordered = phase === 2 && pending !== undefined && bodyStage === 1;
        if (pending) { if (++modelNodes > MAX_MODEL_NODES) throw new ResourceLimitError(); batches.push({ ...pending, status, qualifier }); pending = undefined; }
        check("status", f.length === 4 && !!qualifier.trim() && !!f[2], "BATCH STA has exactly four fields including a populated qualifier.", row);
      } else check("status", false, "STA scope must be FILE or BATCH.", row);
    } else if (tag === "MSG") {
      ordered = phase === 2 && bodyStage === 0 && !pending;
      check("message", f.length === 3 && ["INFO", "WARNING", "ERROR"].includes(f[1] ?? "") && !!f[2]?.trim(), "MSG has INFO/WARNING/ERROR and one populated message field.", row);
    } else if (tag === "BAT") {
      ordered = phase === 2 && bodyStage <= 1 && !pending; bodyStage = 1;
      check("batch", f.length === 6 && positive(f[1]) && !batchNumbers.has(f[1]!) && f[2] === "BatchRef" && !!f[3]?.trim() && f[4] === "RecordCount" && integer(f[5]), "BAT has a unique positive numeric batch number, BatchRef value and nonnegative RecordCount; it is followed by one BATCH STA.", row);
      batchNumbers.add(f[1] ?? ""); pending = { batchNumber: f[1] ?? "", batchReference: f[3] ?? "" };
    } else if (tag === "VAL") {
      ordered = phase === 2 && !pending; bodyStage = 2;
      check("validation-report", f.length === 6 && ["WARNING", "ERROR"].includes(f[1]?.trim() ?? "") && f[2] === "LINE" && positive(f[3]) && /^Field: \S/.test(f[4] ?? "") && !!f[5]?.trim(), "VAL has WARNING/ERROR (sample severity padding admitted), LINE, positive source line, Field: label and populated message; reported ERROR is not an ACK syntax failure.", row);
    } else if (tag === "CTL") {
      ordered = phase === 2 && !pending; phase = 3;
      const keys = new Set<string>(); let valid = f.length === 9;
      for (let i = 1; i < f.length; i += 2) { const key = f[i]!; valid &&= CTL_KEYS.has(key) && !keys.has(key) && integer(f[i + 1]); keys.add(key); }
      check("control", valid && keys.size === 4, "CTL contains the four distinct count/hash pairs with nonnegative digit values. These describe the original file; equality and ACK line-count comparisons are not checked.", row);
    } else if (tag === "TRL") {
      ordered = phase === 3; phase = 4; trailerTime = timestamp(f[2]);
      check("trailer", f.length === 3 && f[1] === "END" && trailerTime !== null, "Final TRL is END plus a real UTC ISO timestamp.", row);
    }
    check("record-order", ordered, "Require one HDR, FIL identification, one FILE STA, optional MSG then BAT/BATCH STA then VAL, one CTL and final TRL.", row);
  }
  check("record-order", phase === 4 && !!file && !pending, "The candidate requires a complete header, file disposition, control and trailer.", rows.at(-1));
  check("file-identification", fileFields.has("InboundFileName") && fileFields.has("CorrelationId"), "FIL identification requires InboundFileName and CorrelationId.", rows.find(row => row.fields[0] === "FIL"));
  if (headerTime !== null && trailerTime !== null) check("timestamp-order", trailerTime >= headerTime, "Trailer timestamp must not precede the header timestamp.", rows.at(-1));
  const results: RuleResult[] = [...checks].map(([id, c], ordinal) => ({ ruleId: `ack.${id}`, ordinal, outcome: c.ok ? "PASS" : "ERROR", severity: c.ok ? null : "ERROR", field: "ACK syntax", locator: c.row ? `Line ${c.row.number}` : "file", message: c.message + (c.count > 1 ? ` (${c.count} violations; first location shown.)` : ""), location: c.row ? { kind: "located", primary: { kind: "context", label: `Line ${c.row.number}`, span: { start: c.row.start, end: c.row.start + c.row.text.length } }, related: [] } : { kind: "file-wide", explanation: "This check applies to the ACK envelope." } }));
  const valid = results.every(r => r.outcome === "PASS");
  return { context: valid ? { source, parserKind: "HUNTINGTON_ACK" as ParserKind } : null, results, notApplicable: valid ? ACK_RULE_IDS.filter(id => !checks.has(id.slice(4))) : [], ...(valid && file ? { reportedDisposition: { file, batches } } : {}) };
}
