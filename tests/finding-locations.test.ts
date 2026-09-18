import { describe, expect, it } from "vitest";
import { locateFindings } from "../src/finding-locations";
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
});
