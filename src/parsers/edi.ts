import type { EdiDocument, EdiVersionIdentifiers, FindingLocation, FormatPack, RuleResult } from "../types";
import { ResourceLimitError, UnsupportedInputError, MAX_MODEL_NODES } from "../resource-policy";
import type { ParserOutput } from "./iso";
import { scanEdiSegments, type LocatedEdiSegment } from "./edi-source";
import { result } from "./shared";

export interface EdiTransaction { readonly start: LocatedEdiSegment; readonly end: LocatedEdiSegment; readonly segments: readonly LocatedEdiSegment[] }
export interface EdiGroup { readonly start: LocatedEdiSegment; readonly end: LocatedEdiSegment; readonly transactions: readonly EdiTransaction[] }
const value = (segment: LocatedEdiSegment, n: number): string => segment.elements[n - 1]?.trim() ?? "";
export function parseEdi(source: string, pack: FormatPack, ctx = false): ParserOutput {
  return parseEdiEnvelope(source, pack, ctx, true);
}

function parseEdiEnvelope(source: string, pack: FormatPack, ctx: boolean, assessScope: boolean): ParserOutput {
  const results: RuleResult[] = [];
  const add = (id: string, ok: boolean, field: string, message: string, segment?: LocatedEdiSegment, context = false): void => {
    if (results.length >= 5000) throw new ResourceLimitError();
    const location: FindingLocation = segment ? { kind: "located", primary: { kind: context ? "context" : "exact", label: `${segment.id} at segment ${segment.position}`, span: segment.span }, related: [] } : { kind: "file-wide", explanation: "This check concerns the file envelope." };
    results.push({ ...result(results.length, id, ok ? "PASS" : "ERROR", field, segment ? `${segment.id}[${segment.position}]` : "file", message), location });
  };
  const sep = source[3] ?? "", component = source[104] ?? "", term = source[105] ?? "";
  const positions = [3,6,17,20,31,34,50,53,69,76,81,83,89,99,101,103];
  const fixed = source.startsWith("ISA") && source.length >= 106 && new Set([sep, component, term]).size === 3
    && [sep, component].every((s) => /^[^a-zA-Z0-9\s]$/.test(s))
    && (/^[^a-zA-Z0-9\s]$/.test(term) || (!ctx && (term === "\r" || term === "\n")))
    && positions.every((p) => source[p] === sep)
    && ![...source.slice(0,105)].some((s,i) => s === sep && !positions.includes(i));
  add("edi.fixed-header", fixed, "Interchange header", "A fixed-width ISA with distinct delimiters at the required positions is required.");
  if (!fixed) return { context: null, results };
  const segments = scanEdiSegments(source, sep, term);
  if (segments.length > MAX_MODEL_NODES) throw new ResourceLimitError();
  // Presentation suffixes cannot consume the selected delimiter itself.
  let contentEnd = source.length;
  while (contentEnd > 0 && source[contentEnd - 1] !== term && /[ \r\n]/.test(source[contentEnd - 1]!)) contentEnd--;
  const terminated = source[contentEnd - 1] === term;
  add("edi.final-termination", terminated, "Final segment terminator", "The final segment must be terminated.", segments.at(-1));
  if (!terminated) return { context: null, results };
  const groups: EdiGroup[] = [];
  let gs: LocatedEdiSegment | undefined, st: LocatedEdiSegment | undefined;
  let transactions: EdiTransaction[] = [], transactionSegments: LocatedEdiSegment[] = [];
  let iea: LocatedEdiSegment | undefined;
  let nesting = true;
  let multiple = false;
  for (let i=1; i<segments.length; i++) {
    const segment = segments[i]!;
    if (iea) { if (segment.id === "ISA") { multiple = true; break; } nesting = false; break; }
    if (segment.id === "GS" && !gs && !st) { gs = segment; transactions = []; }
    else if (segment.id === "ST" && gs && !st) { st = segment; transactionSegments = [segment]; }
    else if (segment.id === "SE" && st) { transactionSegments.push(segment); transactions.push({start:st,end:segment,segments:transactionSegments}); st = undefined; }
    else if (segment.id === "GE" && gs && !st) { groups.push({start:gs,end:segment,transactions}); gs = undefined; }
    else if (segment.id === "IEA" && !gs && !st) { iea = segment; }
    else if (!["ISA","GS","ST","SE","GE","IEA"].includes(segment.id) && st) { transactionSegments.push(segment); }
    else { nesting = false; break; }
  }
  if (multiple) {
    const starts = segments.filter(segment => segment.id === "ISA").map(segment => segment.span.start);
    for (let index = 0; index < starts.length; index++) {
      const part = parseEdiEnvelope(source.slice(starts[index], starts[index + 1] ?? source.length), pack, ctx, false);
      if (!part.context || part.results.some(r => r.outcome === "ERROR")) { add("edi.envelope-nesting", false, "Envelope ownership", "A subsequent interchange is malformed; no recovery is attempted."); return { context: null, results }; }
    }
    throw new UnsupportedInputError("Multiple complete interchanges are outside the supported assessment scope.");
  }
  nesting = nesting && !gs && !st && Boolean(iea) && groups.length > 0 && groups.every(g => g.transactions.length > 0);
  add("edi.envelope-nesting", nesting, "Envelope ownership", "One interchange containing complete nonempty groups and transactions is required; data segments must belong to a transaction.");
  if (!nesting || !iea) return { context: null, results };
  const isa = segments[0]!;
  add("edi.interchange-envelope", isa.elements.length === 16 && iea.elements.length === 2, "Interchange envelope", "ISA and IEA have their required envelope fields.", iea);
  add("edi.group-count", /^\d+$/.test(value(iea,1)) && Number(value(iea,1)) === groups.length, "Group count", "IEA01 must equal the number of groups in this interchange.", iea);
  add("edi.control-numbers", Boolean(value(isa,13)) && value(isa,13) === value(iea,2), "Interchange controls", "ISA13 and IEA02 must match.", iea);
  const ids = pack.identifiers as EdiVersionIdentifiers;
  const olderGroupScope = !ctx && !ids.unqualifiedReason && value(isa,12) === ids.isa12
    && groups.every(group => /^\d{6}$/.test(value(group.start,8)) && value(group.start,8) <= ids.gs08)
    && groups.some(group => value(group.start,8) < ids.gs08);
  if (!ctx && !ids.unqualifiedReason && !olderGroupScope) add("edi.version", value(isa,12) === ids.isa12, "Interchange version", "ISA12 must match the selected profile.", isa);
  for (const group of groups) {
    add("edi.functional-group-envelope", group.start.elements.length >= 8 && group.end.elements.length === 2, "Functional group", "GS and GE have their required envelope fields.", group.start);
    if (!ctx && !ids.unqualifiedReason && !olderGroupScope) add("edi.version", value(group.start,8) === ids.gs08, "Group version", "Every GS08 must match the selected profile. ST03 guide requirements are not evaluated.", group.start);
    add("edi.transaction-count", /^\d+$/.test(value(group.end,1)) && Number(value(group.end,1)) === group.transactions.length, "Transaction count", "GE01 must equal this group's transaction count.", group.end);
    add("edi.control-numbers", Boolean(value(group.start,6)) && value(group.start,6) === value(group.end,2), "Group controls", "GS06 and GE02 must match within their group.", group.end);
    for (const tx of group.transactions) {
      add("edi.transaction-set-envelope", tx.start.elements.length >= 2 && tx.end.elements.length === 2, "Transaction envelope", "ST and SE have their required envelope fields.", tx.start);
      add("edi.transaction-set-code", ctx ? /^\d{3}$/.test(value(tx.start,1)) : value(tx.start,1) === "820", "Transaction code", ctx ? "CTX must identify an X12 transaction set; it is not restricted to 820." : "Every ST01 must declare 820.", tx.start);
      add("edi.control-numbers", Boolean(value(tx.start,2)) && value(tx.start,2) === value(tx.end,2), "Transaction controls", "ST02 and SE02 must match within their transaction.", tx.end);
      add("edi.segment-count", /^\d+$/.test(value(tx.end,1)) && Number(value(tx.end,1)) === tx.segments.length, "Segment count", "SE01 must equal the segment count from this ST through its SE.", tx.end);
      add("edi.payment-remittance", tx.segments.filter(s => s.id === "BPR" || (ctx && s.id === "BPS")).length === 1, "Payment/remittance", ctx ? "CTX X12 transaction sets require a BPR or BPS payment segment." : "The DEMO profile expects exactly one BPR within each transaction; full 820 content is not assessed.", tx.start, true);
    }
  }
  if (assessScope && !ctx && !results.some(r => r.outcome === "ERROR")) {
    if (ids.unqualifiedReason) throw new UnsupportedInputError(ids.unqualifiedReason);
    if (olderGroupScope) throw new UnsupportedInputError("Older functional-group releases in this interchange are outside the selected exact-version DEMO subset; their exact release/control requirements are unqualified.");
    if (term === "\r" || term === "\n") {
      if (ids.gs08 !== "005010") throw new UnsupportedInputError("CR/LF segment terminators are qualified only for the standalone 005010 subset; this release remains unqualified.");
      if (source.includes("\r\n") || source.includes("\n\r")) throw new UnsupportedInputError("Combined CRLF/LFCR transport is not qualified; only a single CR or LF segment terminator is supported.");
    }
  }
  const edi: EdiDocument = { elementSeparator: sep, componentSeparator: component, segmentTerminator: term, segments, groups };
  return { context: { source, parserKind: "EDI_X12", edi }, results };
}
