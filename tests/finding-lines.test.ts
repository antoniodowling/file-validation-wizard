import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findingLines } from "../src/finding-lines";
import { locateFindings } from "../src/finding-locations";
import { findEnabledFormatPack } from "../src/format-packs";
import { validateSource } from "../src/validation";
import type { FindingLocationEntry, SourceTargetKind } from "../src/types";
import { validPain001, validEdi820 } from "./helpers";

function entry(start: number, end: number, kind: SourceTargetKind = "exact"): FindingLocationEntry {
  return { ordinal: 0, location: { kind: "located", primary: { span: { start, end }, kind, label: "Test field" }, related: [] } };
}
function mapped(source: string, packId: string, ruleId: string) {
  const pack = findEnabledFormatPack(packId)!;
  const run = validateSource("test", source, pack);
  const ordinal = run.results.find((finding) => finding.ruleId === ruleId)!.ordinal;
  return findingLines(source, locateFindings(source, pack, run)).find((line) => line.ordinal === ordinal)!;
}

describe("finding line summaries", () => {
  it.each(["\n", "\r\n", "\r"])("counts one-based lines for %j and excludes a trailing newline from a span", (newline) => {
    const source = `first${newline}value${newline}last`;
    const start = source.indexOf("value");
    expect(findingLines(source, [entry(start, source.indexOf("last"))])[0]!.label).toBe("2");
    expect(findingLines(source, [entry(0, source.length, "context")])[0]!.label).toBe("1–3");
  });
  it("handles zero-width and EOF context, malformed spans, and whole-file findings", () => {
    expect(findingLines("one\ntwo", [entry(7, 7, "context")])[0]!.label).toBe("2");
    expect(findingLines("", [entry(0, 0, "parser-position")])[0]!.label).toBe("1");
    expect(findingLines("test", [entry(-1, 1), entry(1, 5), entry(3, 1)]).map(line => line.label)).toEqual(["Unavailable", "Unavailable", "Unavailable"]);
    expect(findingLines("test", [entry(3, 4), entry(3, 1)]).map(line => line.label)).toEqual(["1", "Unavailable"]);
    expect(findingLines("", [{ ordinal: 1, location: { kind: "file-wide", explanation: "Entire document" } }, { ordinal: 2, location: { kind: "unavailable", explanation: "Budget exceeded" } }])).toEqual([
      { ordinal: 1, label: "Whole file", description: "Entire document" },
      { ordinal: 2, label: "Unavailable", description: "Budget exceeded" },
    ]);
  });
  it("maps invalid XML values and distinguishes context for the missing declaration", () => {
    const source = validPain001.replace("pain.001.001.99", "pain.001.001.09").replace("<NbOfTxs>1", "<NbOfTxs>bad");
    expect(mapped(source, "pain-001-09", "iso.transaction-count-type").label).toBe("4");
    expect(mapped(source, "pain-001-09", "iso.transaction-count-type").context).toBeUndefined();
    expect(mapped(source.replace(/^<\?xml[^>]+>\n/u, ""), "pain-001-09", "demo.xml-declaration").context).toBe(true);
    expect(mapped(source.replace(/^<\?xml[^>]+>\n/u, ""), "pain-001-09", "demo.xml-declaration").label).toBe("1");
  });
  it("maps pretty-printed and single-line EDI to physical lines", () => {
    const source = validEdi820.replace("SE*3*", "SE*999*");
    expect(mapped(source, "edi-820-005010", "edi.segment-count").label).toBe("1");
    expect(mapped(source.replaceAll("~", "~\r\n"), "edi-820-005010", "edi.segment-count").label).toBe("5");
  });
  it.each(["\n", "\r\n", "\r", ""])("maps NACHA record fields to physical lines for %j framing", (delimiter) => {
    const source = readFileSync(resolve(process.cwd(), "demo-files/nacha/routing-check-digit-fail.ach"), "utf8").replaceAll("\n", delimiter);
    expect(mapped(source, "nacha-origination-public-2026", "nacha.routing").label).toBe(delimiter ? "3" : "1");
  });

});
