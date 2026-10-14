import { provenanceFor } from "./coverage";
import { MAX_DECODED_UNITS, ResourceLimitError, UnsupportedInputError } from "./resource-policy";
import { deriveOverallStatus } from "./outcome";
import { parseEdi } from "./parsers/edi";
import { parseNacha } from "./parsers/nacha";
import { parseIso } from "./parsers/iso";
import { result } from "./parsers/shared";
import type { FormatPack, RuleResult, ValidationRun } from "./types";

export function validateSource(fileName: string, source: string, pack: FormatPack): ValidationRun {
  if (!pack.enabled || !pack.version || !pack.identifiers) {
    throw new Error("The selected validation profile is not available.");
  }

  if (source.length > MAX_DECODED_UNITS) throw new ResourceLimitError();
  const provenance = provenanceFor(pack);
  let parsed;
  try {
    parsed = pack.parserKind === "ISO_XML" ? parseIso(source, pack)
      : pack.parserKind === "EDI_X12" ? parseEdi(source, pack)
      : pack.parserKind === "NACHA_FIXED" ? parseNacha(source, pack)
      : (() => { throw new Error("Unsupported parser kind."); })();
  } catch (error) {
    if (!(error instanceof UnsupportedInputError)) throw error;
    return Object.freeze({ fileName, formatId: pack.id, formatLabel: pack.label, version: pack.version, provenance,
      executionStatus: "UNSUPPORTED", executionReason: error.message, verdict: null, results: [], checks: provenance.coverage.map(rule => ({ ruleId: rule.id, state: "not-evaluated" as const, findingOrdinals: [] })),
      errorCount: 0, warningCount: 0, overallStatus: "UNSUPPORTED" });
  }
  const results: RuleResult[] = [...parsed.results];
  if (parsed.context) {
    for (const rule of pack.rules) {
      const evaluation = rule.evaluate(parsed.context);
      results.push(
        result(
          results.length,
          rule.id,
          evaluation.outcome,
          rule.field,
          evaluation.locator ?? rule.defaultLocator,
          evaluation.message ?? rule.description,
        ),
      );
    }
  }

  if (results.length > 5000) throw new ResourceLimitError();
  const frozenResults = Object.freeze(results.map((entry) => Object.freeze(entry)));
  const errorCount = frozenResults.filter((entry) => entry.outcome === "ERROR").length;
  const warningCount = frozenResults.filter((entry) => entry.outcome === "WARNING").length;
  return Object.freeze({
    provenance,
    executionStatus: "COMPLETED",
    verdict: deriveOverallStatus(frozenResults) as "PASS" | "PASS_WITH_WARNINGS" | "FAIL",
    checks: provenance.coverage.map(rule => {
      const evaluated = frozenResults.filter(r => r.ruleId === rule.id);
      return { ruleId: rule.id, state: evaluated.length === 0
        ? pack.parserKind === "NACHA_FIXED" && parsed.context && (
          ["nacha.addenda-type", "nacha.addenda-sequence", "nacha.addenda-link"].includes(rule.id)
          || (rule.id === "nacha.web-credit-originator" && !frozenResults.some(r => r.ruleId === "nacha.transaction-code" && r.outcome === "ERROR"))
        ) ? "not-applicable" as const : "not-evaluated" as const
        : evaluated.some(r => r.outcome !== "PASS") ? "failed" as const : "passed" as const,
        findingOrdinals: evaluated.filter(r => r.outcome !== "PASS").map(r => r.ordinal) };
    }),
    fileName,
    formatId: pack.id,
    formatLabel: pack.label,
    version: pack.version,
    results: frozenResults,
    errorCount,
    warningCount,
    overallStatus: deriveOverallStatus(frozenResults),
  });
}
