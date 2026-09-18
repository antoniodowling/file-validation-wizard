import type { OverallStatus, RuleResult } from "./types";

export function deriveOverallStatus(results: readonly RuleResult[]): OverallStatus {
  if (results.some((result) => result.outcome === "ERROR")) return "FAIL";
  if (results.some((result) => result.outcome === "WARNING")) return "PASS_WITH_WARNINGS";
  return "PASS";
}

export function overallStatusLabel(status: OverallStatus): string {
  return status === "PASS_WITH_WARNINGS" ? "PASS WITH WARNINGS" : status;
}
