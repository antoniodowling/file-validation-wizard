import { describe, expect, it } from "vitest";
import { locateFindings } from "../src/finding-locations";
import { FORMAT_PACKS } from "../src/format-packs";
import { MAX_SOURCE_INDEX_CHARACTERS } from "../src/explorer-budget";
import type { FindingLocationEntry, RuleResult } from "../src/types";
import { validateSource } from "../src/validation";
import { ediPack, isoPack, validEdi820, validPain001 } from "./helpers";

function locationFor(entries: readonly FindingLocationEntry[], results: readonly RuleResult[], ruleId: string) {
  const ordinal = results.find((result) => result.ruleId === ruleId)?.ordinal;
  return entries.find((entry) => entry.ordinal === ordinal)?.location;
}

describe("XML finding locations", () => {
  it("maps a namespace mismatch to the actual root namespace value", () => {
    const source = validPain001.replace("pain.001.001.99", "pain.001.001.03");
    const pack = isoPack();
    const run = validateSource("wrong.xml", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "iso.namespace-version");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.primary.kind).toBe("exact");
      expect(source.slice(location.primary.span.start, location.primary.span.end)).toBe(
        "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03",
      );
    }
  });

  it("uses existing parents for missing elements and exact lexical spans for invalid values", () => {
    const source = validPain001
      .replace("<MsgId>TEST-001</MsgId>", "")
      .replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs> 12X </NbOfTxs>");
    const pack = isoPack();
    const run = validateSource("missing.xml", source, pack);
    const locations = locateFindings(source, pack, run);
    const missing = locationFor(locations, run.results, "iso.message-id");
    const invalid = locationFor(locations, run.results, "iso.transaction-count-type");
    expect(missing?.kind).toBe("located");
    expect(invalid?.kind).toBe("located");
    if (missing?.kind === "located") {
      expect(missing.primary.kind).toBe("context");
      expect(source.slice(missing.primary.span.start, missing.primary.span.end)).toContain("<GrpHdr>");
    }
    if (invalid?.kind === "located") {
      expect(invalid.primary.kind).toBe("exact");
      expect(source.slice(invalid.primary.span.start, invalid.primary.span.end)).toBe("12X");
    }
  });

  it("uses structured parser coordinates for malformed XML", () => {
    const source = "<Document>\r\n  <GrpHdr>\r\n</Document>";
    const pack = isoPack();
    const run = validateSource("malformed.xml", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "iso.well-formed");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.primary.kind).toBe("parser-position");
      expect(source.slice(location.primary.span.start, location.primary.span.start + 2)).toBe("</");
    }
  });

  it("highlights the exact substring used by the prohibited-declaration detector", () => {
    const source = '<!DOCTYPE Document [<!ENTITY example "value">]><Document/>';
    const pack = isoPack();
    const run = validateSource("unsafe.xml", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "iso.safe-declarations");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(source.slice(location.primary.span.start, location.primary.span.end)).toBe("<!DOCTYPE");
    }
  });

  it.each([
    ["iso.document-root", validPain001.replaceAll("Document", "Envelope")],
    ["iso.message-container", validPain001.replaceAll("CstmrCdtTrfInitn", "OtherMessage")],
    ["iso.group-header", validPain001.replace("<GrpHdr><MsgId>TEST-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>", "")],
    ["iso.message-id", validPain001.replace("<MsgId>TEST-001</MsgId>", "")],
    ["iso.payment-information", validPain001.replace("<PmtInf><PmtInfId>PAYMENT-1</PmtInfId></PmtInf>", "")],
    ["iso.transaction-count-type", validPain001.replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs/>" )],
  ])("provides an honest source outcome for %s", (ruleId, source) => {
    const pack = isoPack();
    const run = validateSource("case.xml", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, ruleId);
    expect(location, ruleId).toBeTruthy();
    expect(location?.kind, ruleId).not.toBe("unavailable");
  });

  it("maps the demo XML-declaration warning to the start of the document", () => {
    const pack = FORMAT_PACKS.find((candidate) => candidate.id === "pain-001-03");
    expect(pack).toBeTruthy();
    if (!pack) return;
    const source = validPain001
      .replace("pain.001.001.99", "pain.001.001.03")
      .replace(/^<\?xml[^>]+>\n/u, "");
    const run = validateSource("case.xml", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "demo.xml-declaration");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.primary.kind).toBe("context");
      expect(location.primary.span).toEqual({ start: 0, end: 0 });
    }
  });
});

describe("EDI finding locations", () => {
  it("maps version failures to the actual ISA, GS, and ST fields", () => {
    const source = validEdi820
      .replace("*00501*000000001", "*00401*000000001")
      .replaceAll("005010", "004010");
    const pack = ediPack();
    const run = validateSource("wrong.edi", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "edi.version");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      const values = [location.primary, ...location.related]
        .map((entry) => source.slice(entry.span.start, entry.span.end));
      expect(values).toEqual(["00401", "004010", "004010"]);
    }
  });

  it("keeps duplicate transaction values tied to their evaluated occurrences", () => {
    const second = "ST*999*0002*005010~BPR*C*2.00*C*ACH~SE*3*0002~";
    const source = validEdi820.replace("GE*1*1~", `${second}GE*2*1~`);
    const pack = ediPack();
    const run = validateSource("transactions.edi", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "edi.transaction-set-code");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(source.slice(location.primary.span.start, location.primary.span.end)).toBe("999");
      expect(location.primary.span.start).toBe(source.indexOf("999"));
    }
  });

  it("labels aggregate BPR-count failures as file-wide", () => {
    const source = validEdi820.replace("BPR*C*1.00*C*ACH~", "");
    const pack = ediPack();
    const run = validateSource("missing-bpr.edi", source, pack);
    expect(locationFor(locateFindings(source, pack, run), run.results, "edi.payment-remittance")?.kind)
      .toBe("file-wide");
  });

  it.each([
    ["edi.fixed-header", "ISA"],
    ["edi.interchange-envelope", validEdi820.replace("IEA*1*000000001~", "")],
    ["edi.functional-group-envelope", validEdi820.replace("GE*1*1~", "")],
    ["edi.transaction-set-envelope", validEdi820.replace("SE*3*0001~", "")],
    ["edi.control-numbers", validEdi820.replace("IEA*1*000000001~", "IEA*1*999999999~")],
    ["edi.segment-count", validEdi820.replace("SE*3*0001~", "SE*99*0001~")],
  ])("provides an honest source outcome for %s", (ruleId, source) => {
    const pack = ediPack();
    const run = validateSource("case.edi", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, ruleId);
    expect(location, ruleId).toBeTruthy();
    expect(location?.kind, ruleId).not.toBe("unavailable");
  });

  it("bounds related locations and discloses truncation", () => {
    const transaction = (index: number) => `ST*999*${String(index).padStart(4, "0")}*005010~BPR*C*1.00*C*ACH~SE*3*${String(index).padStart(4, "0")}~`;
    const source = validEdi820
      .replace("ST*820*0001*005010~BPR*C*1.00*C*ACH~SE*3*0001~", Array.from({ length: 40 }, (_, index) => transaction(index + 1)).join(""))
      .replace("GE*1*1~", "GE*40*1~");
    const pack = ediPack();
    const run = validateSource("many.edi", source, pack);
    const location = locationFor(locateFindings(source, pack, run), run.results, "edi.transaction-set-code");
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.related).toHaveLength(32);
      expect(location.relatedTruncated).toBe(true);
    }
  });

  it("degrades deterministically beyond the source-index budget", () => {
    const source = `${validEdi820}${" ".repeat(MAX_SOURCE_INDEX_CHARACTERS)}`;
    const pack = ediPack();
    const run = validateSource("large.edi", source, pack);
    const mismatched = run.results.map((finding) => finding.ruleId === "edi.segment-count"
      ? { ...finding, outcome: "ERROR" as const, severity: "ERROR" as const }
      : finding);
    const location = locationFor(locateFindings(source, pack, { ...run, results: mismatched }), mismatched, "edi.segment-count");
    expect(location?.kind).toBe("unavailable");
    if (location?.kind === "unavailable") expect(location.explanation).toContain("location-index budget");
  });
});
