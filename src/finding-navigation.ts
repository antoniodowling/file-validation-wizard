import type { RuleResult } from "./types";

export function navigableFindings(visible: readonly RuleResult[]): readonly RuleResult[] {
  return visible.filter((finding) => finding.outcome !== "PASS");
}

export function adjacentFinding(
  visible: readonly RuleResult[],
  selectedOrdinal: number | null,
  direction: "previous" | "next",
): RuleResult | null {
  const navigable = navigableFindings(visible);
  if (navigable.length === 0) return null;
  if (selectedOrdinal === null) return direction === "next" ? navigable[0] ?? null : navigable.at(-1) ?? null;
  const index = navigable.findIndex((finding) => finding.ordinal === selectedOrdinal);
  if (index < 0) return direction === "next" ? navigable[0] ?? null : navigable.at(-1) ?? null;
  return direction === "next" ? navigable[index + 1] ?? null : navigable[index - 1] ?? null;
}

export function pageForFinding(
  visible: readonly RuleResult[],
  ordinal: number,
  pageSize: number,
): number | null {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("Page size must be a positive integer.");
  const index = visible.findIndex((finding) => finding.ordinal === ordinal);
  return index < 0 ? null : Math.floor(index / pageSize) + 1;
}
