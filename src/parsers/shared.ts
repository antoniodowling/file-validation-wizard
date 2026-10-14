import type { FindingSeverity, RuleOutcome, RuleResult } from "../types";

export function result(
  ordinal: number,
  ruleId: string,
  outcome: RuleOutcome,
  field: string,
  locator: string,
  message: string,
): RuleResult {
  const severity: FindingSeverity | null = outcome === "PASS" ? null : outcome;
  return Object.freeze({ ruleId, outcome, severity, field, locator, message, ordinal });
}
