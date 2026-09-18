import { describe, expect, it } from "vitest";
import { deriveOverallStatus } from "../src/outcome";
import type { RuleResult } from "../src/types";

const result = (outcome: RuleResult["outcome"]): RuleResult => ({
  ruleId: outcome,
  outcome,
  severity: outcome === "PASS" ? null : outcome,
  field: "Field",
  locator: "path",
  message: "Message",
  ordinal: 0,
});

describe("deriveOverallStatus", () => {
  it("returns PASS for successful checks only", () => {
    expect(deriveOverallStatus([result("PASS")])).toBe("PASS");
  });

  it("returns PASS_WITH_WARNINGS when no errors exist", () => {
    expect(deriveOverallStatus([result("PASS"), result("WARNING")])).toBe("PASS_WITH_WARNINGS");
  });

  it("returns FAIL whenever an error exists", () => {
    expect(deriveOverallStatus([result("WARNING"), result("ERROR")])).toBe("FAIL");
  });
});
