import { describe, expect, it } from "vitest";
import { scanEdiSegments } from "../src/parsers/edi-source";
import { validEdi820 } from "./helpers";

function legacyProjection(source: string, elementSeparator: string, segmentTerminator: string) {
  return source
    .split(segmentTerminator)
    .map((raw) => raw.replace(/^[\r\n ]+|[\r\n ]+$/g, ""))
    .filter(Boolean)
    .map((raw, index) => {
      const parts = raw.split(elementSeparator);
      return { id: parts.shift()?.trim() ?? "", elements: parts, position: index + 1 };
    });
}

describe("offset-preserving EDI scanner", () => {
  it("preserves the validator's previous segment semantics", () => {
    const source = validEdi820.replace("GS*", "\r\n  GS*").replace("BPR*C", "BPR*\tC");
    const scanned = scanEdiSegments(source, source[3] ?? "", source[105] ?? "");
    expect(scanned.map(({ id, elements, position }) => ({ id, elements, position })))
      .toEqual(legacyProjection(source, source[3] ?? "", source[105] ?? ""));
  });

  it("ties duplicate values to their original lexical occurrences", () => {
    const source = "ST* 820 *0001~ST*820*0002~";
    const segments = scanEdiSegments(source, "*", "~");
    const first = segments[0]?.locatedElements[0];
    const second = segments[1]?.locatedElements[0];
    expect(first && source.slice(first.valueSpan.start, first.valueSpan.end)).toBe("820");
    expect(second && source.slice(second.valueSpan.start, second.valueSpan.end)).toBe("820");
    expect(first?.valueSpan.start).toBe(source.indexOf("820"));
    expect(second?.valueSpan.start).toBe(source.lastIndexOf("820"));
  });
});
