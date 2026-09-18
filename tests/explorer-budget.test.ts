import { describe, expect, it } from "vitest";
import {
  evaluateExplorerBudget,
  EXCERPT_CONTEXT_CHARACTERS,
  MAX_FULL_VIEWER_CHARACTERS,
  MAX_FULL_VIEWER_LINE_CHARACTERS,
  MAX_SOURCE_INDEX_CHARACTERS,
  sourceExcerpt,
} from "../src/explorer-budget";

describe("explorer budgets", () => {
  it("uses the full viewer only inside both character and long-line budgets", () => {
    expect(evaluateExplorerBudget("a\nb").mode).toBe("full");
    expect(evaluateExplorerBudget("x".repeat(MAX_FULL_VIEWER_LINE_CHARACTERS + 1)).mode).toBe("excerpt");
    expect(evaluateExplorerBudget(`${"x\n".repeat(Math.ceil(MAX_FULL_VIEWER_CHARACTERS / 2))}x`).mode).toBe("excerpt");
    expect(MAX_SOURCE_INDEX_CHARACTERS).toBe(MAX_FULL_VIEWER_CHARACTERS);
  });

  it("builds bounded exact-source excerpts around targets", () => {
    const source = "0123456789".repeat(3_000);
    const excerpt = sourceExcerpt(source, { start: 15_000, end: 15_003 });
    expect(excerpt.text).toBe(source.slice(excerpt.span.start, excerpt.span.end));
    expect(excerpt.text.length).toBeLessThanOrEqual(EXCERPT_CONTEXT_CHARACTERS + 3);
    expect(excerpt.span.start).toBeLessThanOrEqual(15_000);
    expect(excerpt.span.end).toBeGreaterThanOrEqual(15_003);
    expect(excerpt.prefixTruncated).toBe(true);
    expect(excerpt.suffixTruncated).toBe(true);
  });
});
