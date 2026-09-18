import { describe, expect, it } from "vitest";
import { adjacentFinding, navigableFindings, pageForFinding } from "../src/finding-navigation";
import type { RuleResult } from "../src/types";

const finding = (ordinal: number, outcome: RuleResult["outcome"]): RuleResult => ({
  ruleId: `rule-${ordinal}`,
  outcome,
  severity: outcome === "PASS" ? null : outcome,
  field: `Field ${ordinal}`,
  locator: `path-${ordinal}`,
  message: `Message ${ordinal}`,
  ordinal,
});

describe("finding navigation", () => {
  const visible = [finding(5, "PASS"), finding(2, "ERROR"), finding(8, "PASS"), finding(7, "WARNING")];

  it("keeps filtered and sorted order while excluding PASS rows", () => {
    expect(navigableFindings(visible).map((entry) => entry.ordinal)).toEqual([2, 7]);
    expect(adjacentFinding(visible, null, "next")?.ordinal).toBe(2);
    expect(adjacentFinding(visible, null, "previous")?.ordinal).toBe(7);
    expect(adjacentFinding(visible, 2, "next")?.ordinal).toBe(7);
    expect(adjacentFinding(visible, 7, "next")).toBeNull();
  });

  it("calculates pages from the complete visible result list including PASS rows", () => {
    const rows = Array.from({ length: 51 }, (_, ordinal) => finding(ordinal, ordinal % 3 === 0 ? "ERROR" : "PASS"));
    expect(pageForFinding(rows, 24, 25)).toBe(1);
    expect(pageForFinding(rows, 25, 25)).toBe(2);
    expect(pageForFinding(rows, 50, 25)).toBe(3);
    expect(pageForFinding(rows, 99, 25)).toBeNull();
  });
});
