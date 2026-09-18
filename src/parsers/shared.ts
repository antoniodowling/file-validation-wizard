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

export function localName(name: string): string {
  const pieces = name.split(":");
  return pieces.at(-1) ?? name;
}

export function entriesByLocalName(
  node: Readonly<Record<string, unknown>> | null,
  wanted: string,
): readonly unknown[] {
  if (!node) return [];
  const entry = Object.entries(node).find(([key]) => localName(key) === wanted);
  if (!entry) return [];
  return Array.isArray(entry[1]) ? entry[1] : [entry[1]];
}

export function firstObjectByLocalName(
  node: Readonly<Record<string, unknown>> | null,
  wanted: string,
): Readonly<Record<string, unknown>> | null {
  const value = entriesByLocalName(node, wanted)[0];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

export function scalarByLocalName(
  node: Readonly<Record<string, unknown>> | null,
  wanted: string,
): string | null {
  const value = entriesByLocalName(node, wanted)[0];
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && "#text" in value) {
    const text = (value as { readonly "#text"?: unknown })["#text"];
    return typeof text === "string" || typeof text === "number" ? String(text).trim() : null;
  }
  return null;
}
