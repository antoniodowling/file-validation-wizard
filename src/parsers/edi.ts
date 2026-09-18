import type {
  EdiDocument,
  EdiSegment,
  EdiVersionIdentifiers,
  FormatPack,
  RuleResult,
  ValidationContext,
} from "../types";
import type { ParserOutput } from "./iso";
import { result } from "./shared";

const find = (segments: readonly EdiSegment[], id: string): readonly EdiSegment[] =>
  segments.filter((segment) => segment.id === id);

const element = (segment: EdiSegment | undefined, position: number): string =>
  segment?.elements[position - 1]?.trim() ?? "";

export function parseEdi(source: string, pack: FormatPack): ParserOutput {
  const results: RuleResult[] = [];
  const fixedHeader = source.startsWith("ISA") && source.length >= 106;
  results.push(
    result(
      results.length,
      "edi.fixed-header",
      fixedHeader ? "PASS" : "ERROR",
      "Interchange header",
      "ISA[1]",
      fixedHeader
        ? "The fixed-width ISA interchange header is present."
        : "The file must begin with a complete fixed-width ISA segment.",
    ),
  );
  if (!fixedHeader) return { context: null, results };

  const elementSeparator = source[3] ?? "";
  const componentSeparator = source[104] ?? "";
  const segmentTerminator = source[105] ?? "";
  const segments: EdiSegment[] = source
    .split(segmentTerminator)
    .map((raw) => raw.replace(/^[\r\n ]+|[\r\n ]+$/g, ""))
    .filter(Boolean)
    .map((raw, index) => {
      const parts = raw.split(elementSeparator);
      return Object.freeze({
        id: parts.shift()?.trim() ?? "",
        elements: Object.freeze(parts),
        position: index + 1,
      });
    });

  const isa = find(segments, "ISA")[0];
  const iea = find(segments, "IEA").at(-1);
  const interchangeOk = Boolean(isa && iea && isa.elements.length === 16 && iea.elements.length >= 2);
  results.push(
    result(
      results.length,
      "edi.interchange-envelope",
      interchangeOk ? "PASS" : "ERROR",
      "Interchange envelope",
      "ISA[1] / IEA[1]",
      interchangeOk
        ? "The ISA and IEA interchange envelope is complete."
        : "A complete 16-element ISA and matching IEA envelope are required.",
    ),
  );

  const gs = find(segments, "GS")[0];
  const ge = find(segments, "GE").at(-1);
  const groupOk = Boolean(gs && ge && gs.elements.length >= 8 && ge.elements.length >= 2);
  results.push(
    result(
      results.length,
      "edi.functional-group-envelope",
      groupOk ? "PASS" : "ERROR",
      "Functional group envelope",
      "GS[1] / GE[1]",
      groupOk
        ? "The GS and GE functional group envelope is complete."
        : "A complete GS and GE functional group envelope is required.",
    ),
  );

  const stSegments = find(segments, "ST");
  const seSegments = find(segments, "SE");
  const transactionEnvelopeOk = stSegments.length > 0 && stSegments.length === seSegments.length;
  results.push(
    result(
      results.length,
      "edi.transaction-set-envelope",
      transactionEnvelopeOk ? "PASS" : "ERROR",
      "Transaction set envelope",
      "ST / SE",
      transactionEnvelopeOk
        ? `${stSegments.length} paired transaction set envelope(s) found.`
        : "Each EDI 820 transaction set requires one paired ST and SE segment.",
    ),
  );

  const transactionTypeOk = stSegments.length > 0 && stSegments.every((segment) => element(segment, 1) === "820");
  results.push(
    result(
      results.length,
      "edi.transaction-set-code",
      transactionTypeOk ? "PASS" : "ERROR",
      "Transaction set code",
      "ST/ST01",
      transactionTypeOk
        ? "Every transaction set declares code 820."
        : "Every selected transaction set must declare 820 in ST01.",
    ),
  );

  const identifiers = pack.identifiers as EdiVersionIdentifiers;
  const versionOk =
    element(isa, 12) === identifiers.isa12 &&
    element(gs, 8) === identifiers.gs08 &&
    (identifiers.st03 ? stSegments.every((segment) => element(segment, 3) === identifiers.st03) : true);
  results.push(
    result(
      results.length,
      "edi.version",
      versionOk ? "PASS" : "ERROR",
      "EDI version",
      "ISA/ISA12, GS/GS08, ST/ST03",
      versionOk
        ? "The interchange, group, and implementation versions match the selected format pack."
        : "The EDI version identifiers do not match the selected format pack.",
    ),
  );

  const interchangeControlsMatch = element(isa, 13) !== "" && element(isa, 13) === element(iea, 2);
  const groupControlsMatch = element(gs, 6) !== "" && element(gs, 6) === element(ge, 2);
  const transactionControlsMatch = stSegments.every(
    (st, index) => element(st, 2) !== "" && element(st, 2) === element(seSegments[index], 2),
  );
  const controlsMatch = interchangeControlsMatch && groupControlsMatch && transactionControlsMatch;
  results.push(
    result(
      results.length,
      "edi.control-numbers",
      controlsMatch ? "PASS" : "ERROR",
      "Envelope control numbers",
      "ISA13/IEA02, GS06/GE02, ST02/SE02",
      controlsMatch
        ? "Interchange, group, and transaction control numbers match."
        : "Envelope control numbers must be populated and match their closing segments.",
    ),
  );

  const segmentCountsMatch = stSegments.length > 0 && stSegments.every((st, index) => {
    const se = seSegments[index];
    if (!se || !/^\d+$/.test(element(se, 1))) return false;
    return Number(element(se, 1)) === se.position - st.position + 1;
  });
  results.push(
    result(
      results.length,
      "edi.segment-count",
      segmentCountsMatch ? "PASS" : "ERROR",
      "Transaction segment count",
      "SE/SE01",
      segmentCountsMatch
        ? "Every SE segment count matches its transaction set."
        : "Each SE01 value must equal the number of segments from ST through SE.",
    ),
  );

  const hasBpr = find(segments, "BPR").length >= stSegments.length && stSegments.length > 0;
  results.push(
    result(
      results.length,
      "edi.payment-remittance",
      hasBpr ? "PASS" : "ERROR",
      "Payment order / remittance data",
      "BPR",
      hasBpr
        ? "A BPR payment/remittance segment is present for each transaction set."
        : "Each EDI 820 transaction set requires a BPR segment.",
    ),
  );

  const edi: EdiDocument = Object.freeze({
    elementSeparator,
    componentSeparator,
    segmentTerminator,
    segments: Object.freeze(segments),
  });
  const context: ValidationContext = Object.freeze({ source, parserKind: "EDI_X12", edi });
  return { context, results };
}
