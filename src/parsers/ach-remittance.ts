import { parseEdi } from "./edi";
import type { FormatPack } from "../types";
import { UnsupportedInputError, ResourceLimitError, MAX_MODEL_NODES } from "../resource-policy";

/** Checks ACH-required X12 framing/payment segments, not complete X12 business-guide conformance. */
export function ctxX12Syntax(payload: string, pack: FormatPack): boolean {
  const source = payload.trimEnd();
  if (source.startsWith("ISA")) {
    const sep = source[3] ?? ""; const term = source[105] ?? "";
    if (!term || !sep || !source.endsWith(term)) return false;
    // The historical EDI demo scanner tolerates empty/invalid segments. CTX's
    // new syntax promise needs lexical checks and group-scoped ST02 uniqueness.
    const references = new Set<string>();
    const rawSegments = source.slice(0, -1).split(term);
    if (rawSegments.length > MAX_MODEL_NODES) throw new ResourceLimitError();
    for (const segment of rawSegments) {
      const fields = segment.trimStart().split(sep); const tag = fields[0] ?? "";
      if (!/^[A-Z][A-Z0-9]{1,2}$/.test(tag)) return false;
      if (tag === "GS") references.clear();
      if (tag === "ST") { if (!fields[2]?.trim() || references.has(fields[2])) return false; references.add(fields[2]); }
    }
    try { return parseEdi(source, pack, true).results.every(rule => rule.outcome === "PASS"); }
    catch (error) { if (error instanceof UnsupportedInputError) return false; throw error; }
  }
  if (/^(UNA|UNB|UNH|<)/.test(source)) {
    throw new UnsupportedInputError("This candidate has not qualified UN/EDIFACT or opt-in XML CTX remittance syntax. No format verdict is issued for this file.");
  }
  if (!source.startsWith("ST")) return false;
  const sep = source[2] ?? "";
  const term = source.at(-1) ?? "";
  if (sep === term || !/^[^a-zA-Z0-9\s]$/.test(sep) || !/^[^a-zA-Z0-9\s]$/.test(term)) return false;
  const rawSegments = source.slice(0, -1).split(term);
  if (rawSegments.length > MAX_MODEL_NODES) throw new ResourceLimitError();
  const segments = rawSegments.map(segment => segment.split(sep));
  let start = -1;
  let payment = 0;
  let transactions = 0;
  const references = new Set<string>();
  for (const [index, fields] of segments.entries()) {
    const tag = fields[0] ?? "";
    if (!/^[A-Z][A-Z0-9]{1,2}$/.test(tag)) return false;
    if (tag === "ST") {
      if (start !== -1 || fields.length < 3 || !/^\d{3}$/.test(fields[1] ?? "") || !fields[2]?.trim() || references.has(fields[2])) return false;
      references.add(fields[2]); start = index; payment = 0;
    } else if (tag === "SE") {
      if (start === -1 || fields.length !== 3 || !/^\d+$/.test(fields[1] ?? "") || Number(fields[1]) !== index - start + 1 || fields[2] !== segments[start]?.[2] || payment !== 1) return false;
      start = -1; transactions++;
    } else {
      if (start === -1 || ["ISA", "IEA", "GS", "GE"].includes(tag)) return false;
      if (tag === "BPR" || tag === "BPS") payment++;
    }
  }
  return start === -1 && transactions > 0;
}
