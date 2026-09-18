import { deriveOverallStatus } from "./outcome";
import { parseEdi } from "./parsers/edi";
import { parseIso } from "./parsers/iso";
import { result } from "./parsers/shared";
import type { FormatPack, RuleResult, ValidationRun } from "./types";

export function validateSource(fileName: string, source: string, pack: FormatPack): ValidationRun {
  if (!pack.enabled || !pack.version || !pack.identifiers) {
    throw new Error("The selected validation profile is not available.");
  }

  const parsed = pack.parserKind === "ISO_XML" ? parseIso(source, pack) : parseEdi(source, pack);
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

  const frozenResults = Object.freeze(results.map((entry) => Object.freeze(entry)));
  const errorCount = frozenResults.filter((entry) => entry.outcome === "ERROR").length;
  const warningCount = frozenResults.filter((entry) => entry.outcome === "WARNING").length;
  return Object.freeze({
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
