import type { CoverageRule, FormatPack } from "./types";
import { expandedNachaCoverageFor, NACHA_EXPANDED_EXCLUSIONS } from "./nacha-expanded-coverage";
export const NACHA_ORIGINATION_R2_REVISION = "nacha-origination-public-2026-r2.3";
export const NACHA_ORIGINATION_R2_GUIDE = "Public sources and supplied 2026 Basic Rules excerpts reviewed 2026-10-14; CMS generic TRN terminators rechecked 2026-10-29; origination-expanded-public-2026-r2; full Rules qualification deferred";
export const NACHA_ORIGINATION_R2_EXCLUSIONS = Object.freeze([
  ...NACHA_EXPANDED_EXCLUSIONS.filter(exclusion => !exclusion.startsWith("Healthcare classification")),
  "Healthcare classification is declared only by HCCLAIMPMT. Missing descriptors do not prove absence of healthcare, payroll or e-commerce purpose; actual purpose, TEL standing authorization and complete ASC X12 5010 835 business-guide conformance remain unverified.",
]);
const added: Readonly<Record<string, readonly [string, string, string]>> = {
  "description-case": ["Declared standardized Company Entry Description fields are uppercase, including alphabetic suffixes; PAYROLL has three discretionary suffix columns.", "Recognized standardized descriptors, including case-insensitive declarations.", "Trusted record envelopes"],
  "description-sec": ["Declared PAYROLL is PPD credit; PURCHASE is WEB or permitted TEL debit; HCCLAIMPMT is CCD. Real purpose/standing authorization is unverified.", "Recognized declarations with known SEC and entry type for direction checks.", "Trusted record envelopes; known SEC/entry type where needed"],
  "healthcare-addenda": ["Declared healthcare CCD entries require addenda and indicator 1 except prenotes.", "HCCLAIMPMT CCD entries with known non-prenote transaction type.", "Trusted record envelopes; known entry type"],
  "healthcare-trn": ["Declared healthcare CCD payment addenda contain a complete reassociation TRN segment ending in tilde or backslash; payload locations are contextual; full 835 guide conformance is excluded.", "HCCLAIMPMT CCD non-prenotes with present type-05 addenda.", "Trusted record envelopes; known entry type and payment addenda type"],
  "effective-holiday": ["A valid weekday Effective Entry Date on one of the 11 Federal Reserve Bank holidays (including observed Monday after a Sunday fixed-date holiday) generates a WARNING. Saturday holidays do not shift to Friday; weekend dates use the existing weekend warning.", "Each R2 origination batch with a valid Effective Entry Date; weekend dates do not trigger a duplicate holiday warning.", "Trusted record envelopes; valid Effective Entry Date"],
  "effective-past": ["A valid Effective Entry Date before the validation calendar date generates a WARNING, not an ACH Operator rejection claim. America/New_York determines today's date only; no time-of-day comparison.", "Each R2 origination batch with a valid Effective Entry Date.", "Trusted record envelopes; valid Effective Entry Date; reference instant captured once per run"],
};
export function originationR2CoverageFor(pack: FormatPack): readonly CoverageRule[] {
  return [...expandedNachaCoverageFor(pack), ...Object.entries(added).map(([key, metadata]) => ({
    id: `nacha.${key}`, description: metadata[0], ruleClass: "nacha-structure" as const,
    severity: key === "effective-holiday" || key === "effective-past" ? "WARNING" as const : "ERROR" as const,
    applicability: metadata[1], prerequisite: metadata[2],
    reference: key === "effective-holiday" || key === "effective-past"
      ? "docs/ACH_ORIGINATION_R2.md; https://www.frbservices.org/about/holiday-schedules/; https://www.nacha.org/rules/same-day-ach-moving-payments-faster-phase-2 (stale dates)"
      : "docs/ACH_ORIGINATION_R2.md; https://www.nacha.org/rules/risk-management-topics-company-entry-descriptions (effective 2026-03-20); supplied September 2026 Basic Supplement pp. 4-5 and 2026 Basic p. 92; https://www.cms.gov/regulations-and-guidance/guidance/transmittals/downloads/r1351otn.pdf (TRN structural corroboration, 2014)",
    evidence: key === "effective-holiday" || key === "effective-past"
      ? "tests/nacha-date-warnings.test.ts; deterministic synthetic calendar fixtures; candidate advisory only, no bank acceptance"
      : "tests/nacha-origination-r2.test.ts; candidate structural evidence only; no business approvals or hosted acceptance",
  }))];
}
