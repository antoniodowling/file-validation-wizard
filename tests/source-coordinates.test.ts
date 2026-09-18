import { describe, expect, it } from "vitest";
import {
  normalizeSourceForViewer,
  sourceLineColumnAtOffset,
  sourceLineStarts,
  sourceOffsetAtLineColumn,
} from "../src/source-coordinates";

describe("canonical source coordinates", () => {
  it("tracks LF, CRLF, lone CR, and mixed line endings", () => {
    const source = "alpha\r\nbeta\rgamma\ndelta";
    expect(sourceLineStarts(source)).toEqual([0, 7, 12, 18]);
    expect(sourceOffsetAtLineColumn(source, 2, 3)).toBe(9);
    expect(sourceOffsetAtLineColumn(source, 4, 6)).toBe(source.length);
    expect(sourceOffsetAtLineColumn(source, 4, 7)).toBeNull();
    expect(sourceLineColumnAtOffset(source, 14)).toEqual({ line: 3, column: 3 });
  });

  it("maps canonical CRLF offsets to a normalized viewer document", () => {
    const source = "a\r\nb\rc\nd";
    const viewer = normalizeSourceForViewer(source);
    expect(viewer.text).toBe("a\nb\nc\nd");
    expect(viewer.canonicalToViewer(0)).toBe(0);
    expect(viewer.canonicalToViewer(2)).toBe(2);
    expect(viewer.canonicalToViewer(3)).toBe(2);
    expect(viewer.canonicalToViewer(source.length)).toBe(viewer.text.length);
    expect(viewer.viewerToCanonical(2)).toBe(3);
    expect(viewer.viewerToCanonical(viewer.text.length)).toBe(source.length);
  });

  it("keeps Unicode offsets in UTF-16 code units", () => {
    const source = "A😀é\t&amp;\nB";
    expect(source.indexOf("e")).toBe(3);
    expect(sourceOffsetAtLineColumn(source, 1, 4)).toBe(3);
    expect(sourceLineColumnAtOffset(source, 3)).toEqual({ line: 1, column: 4 });
    expect(sourceLineColumnAtOffset(source, source.length)).toEqual({ line: 2, column: 2 });
  });

  it("preserves explicit EOF points through viewer normalization", () => {
    const source = "one\r\ntwo\r";
    const viewer = normalizeSourceForViewer(source);
    expect(viewer.canonicalToViewer(source.length)).toBe(viewer.text.length);
    expect(viewer.viewerToCanonical(viewer.text.length)).toBe(source.length);
    expect(sourceOffsetAtLineColumn(source, 3, 1)).toBe(source.length);
  });
});
