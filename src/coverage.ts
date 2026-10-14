import { csvWireCoverageFor, CSV_WIRE_REVISION, CSV_WIRE_GUIDE, CSV_WIRE_EXCLUSIONS } from "./csv-wire-coverage";
import { ackCoverageFor, ACK_RULESET_REVISION, ACK_GUIDE_REVISION, ACK_EXCLUSIONS } from "./ack-coverage";
import { bai2CoverageFor, BAI2_REVISION, BAI2_GUIDE, BAI2_EXCLUSIONS } from "./bai2-coverage";
import { controlTotalCoverageFor, CONTROL_TOTAL_REVISION, CONTROL_TOTAL_GUIDE, CONTROL_TOTAL_EXCLUSIONS } from "./control-total-coverage";
import { nachaReturnsCoverageFor, NACHA_RETURNS_RULESET_REVISION, NACHA_RETURNS_GUIDE_REVISION, NACHA_RETURNS_EXCLUSIONS } from "./nacha-returns-coverage";
import { originationR2CoverageFor, NACHA_ORIGINATION_R2_REVISION, NACHA_ORIGINATION_R2_GUIDE, NACHA_ORIGINATION_R2_EXCLUSIONS } from "./nacha-origination-r2-coverage";
import { expandedNachaCoverageFor, NACHA_EXPANDED_REVISION, NACHA_EXPANDED_GUIDE, NACHA_EXPANDED_EXCLUSIONS } from "./nacha-expanded-coverage";
import type { CoverageRule, FormatPack, RunProvenance } from "./types";
import { nachaCoverageFor, NACHA_EXCLUSIONS, NACHA_GUIDE_REVISION, NACHA_RULESET_REVISION } from "./nacha-coverage";
export const RULESET_REVISION = "2.0.0";
export const EXCLUSIONS = Object.freeze([
  "DEMO checks only. No bank acceptance, funds availability, authorization, fraud approval, or execution guarantee.",
  "No complete ISO schema validation or Huntington implementation-guide validation.",
  "No historical or cross-session duplicate detection; no external account or payment verification.",
  "X12 implementation-guide/ST03 requirements and complete 820 content are not evaluated.",
]);
const xmlRules = ["safe-declarations", "well-formed", "document-root", "namespace-version", "message-container", "group-header", "message-id", "payment-information", "transaction-count-type"];
const ediRules = ["fixed-header", "final-termination", "envelope-nesting", "interchange-envelope", "group-count", "functional-group-envelope", "transaction-count", "transaction-set-envelope", "transaction-set-code", "version", "control-numbers", "segment-count", "payment-remittance"];

const descriptions: Record<string, readonly [string, string]> = {
  "iso.safe-declarations": ["No actual DTD or custom entity declaration; comment/CDATA/PI text is inert.", "UTF-8 decoded source admitted"],
  "iso.well-formed": ["XML 1.0 document syntax, exactly one root, legal characters and namespace bindings.", "iso.safe-declarations"],
  "iso.document-root": ["The single document element has local name Document.", "iso.well-formed"],
  "iso.namespace-version": ["Document expanded namespace equals the exact selected version; no auto-switch or conformance claim.", "iso.document-root"],
  "iso.message-container": ["Exactly one selected message container in the selected namespace.", "iso.namespace-version"],
  "iso.group-header": ["Exactly one direct GrpHdr in the selected namespace.", "iso.message-container"],
  "iso.message-id": ["Exactly one nonblank scalar MsgId element; attributes do not satisfy this check.", "iso.group-header"],
  "iso.transaction-count-type": ["Exactly one scalar NbOfTxs containing 1 to 15 digits; no reconciliation claim.", "iso.group-header"],
  "iso.payment-information": ["At least one direct PmtInf in the selected namespace.", "iso.message-container"],
  "edi.fixed-header": ["ISA fixed separator positions and distinct element/component/segment delimiters.", "UTF-8 decoded source admitted"],
  "edi.final-termination": ["Final segment terminator present (trailing whitespace permitted).", "edi.fixed-header"],
  "edi.envelope-nesting": ["One interchange; nonempty groups and transactions; every data segment owned by a transaction.", "edi.final-termination"],
  "edi.interchange-envelope": ["16 ISA fields and 2 IEA fields.", "edi.envelope-nesting"],
  "edi.group-count": ["IEA01 reconciles to actual groups.", "edi.envelope-nesting"],
  "edi.functional-group-envelope": ["Each GS has at least 8 fields and GE has 2 fields.", "edi.envelope-nesting"],
  "edi.transaction-count": ["Each GE01 reconciles to transactions in that group.", "edi.envelope-nesting"],
  "edi.transaction-set-envelope": ["Each ST has at least 2 fields and SE has 2 fields.", "edi.envelope-nesting"],
  "edi.transaction-set-code": ["Every ST01 is 820.", "edi.envelope-nesting"],
  "edi.version": ["ISA12 and every GS08 match selected DEMO identifiers. ST03 is excluded pending an implementation guide.", "edi.envelope-nesting"],
  "edi.control-numbers": ["Populated ISA13/IEA02, GS06/GE02, ST02/SE02 match within their own envelopes.", "edi.envelope-nesting"],
  "edi.segment-count": ["Each SE01 equals segments in its own ST–SE transaction.", "edi.envelope-nesting"],
  "edi.payment-remittance": ["DEMO expectation: exactly one BPR inside each transaction; no full 820 content validation.", "edi.envelope-nesting"],
  "demo.xml-declaration": ["Advisory: an XML declaration makes UTF-8 encoding explicit.", "Trusted format context"],
  "demo.non-empty-source": ["The admitted source contains non-whitespace text.", "Trusted format context"],
};

export function coverageFor(pack: FormatPack): readonly CoverageRule[] {
  if (pack.parserKind === "CSV_WIRE") return csvWireCoverageFor(pack);
  if (pack.parserKind === "BAI2") return bai2CoverageFor(pack);
  if (pack.id === "nacha-origination-expanded-public-2026-r2") return originationR2CoverageFor(pack);
  if (pack.parserKind === "NACHA_RETURN_FIXED") return nachaReturnsCoverageFor(pack);
  if (pack.parserKind === "ACH_CONTROL_FIXED") return controlTotalCoverageFor(pack);
  if (pack.parserKind === "HUNTINGTON_ACK") return [...ackCoverageFor(pack), ...pack.rules.map(rule => ({ id: rule.id, description: rule.description, ruleClass: "flat-file-structure" as const, severity: "ERROR" as const, applicability: "Selected ACK candidate.", prerequisite: "Trusted ACK syntax context", reference: "docs/HUNTINGTON_ACK_CANDIDATE.md", evidence: "tests/huntington-ack.test.ts" }))];
  if (pack.id === "nacha-origination-expanded-public-2026-r1") return expandedNachaCoverageFor(pack);
  if (pack.parserKind === "NACHA_FIXED") return nachaCoverageFor(pack);
  const xml = pack.parserKind === "ISO_XML";
  return [...(xml ? xmlRules.map(id => `iso.${id}`) : ediRules.map(id => `edi.${id}`)), ...pack.rules.map(r => r.id)].map(id => ({
    id, description: descriptions[id]?.[0] ?? pack.rules.find(r => r.id === id)?.description ?? id,
    ruleClass: id === "iso.well-formed" ? "xml-syntax" : id === "iso.safe-declarations" ? "tool-policy" : id.startsWith("demo.") ? "advisory" : "demo-structure",
    severity: id === "demo.xml-declaration" ? "WARNING" : "ERROR",
    applicability: `Selected profile ${pack.id}, message version ${pack.version}; repeated envelopes evaluated individually where present.`,
    prerequisite: descriptions[id]?.[1] ?? "Trusted format context",
    reference: id === "iso.well-formed" ? "https://www.w3.org/TR/2008/REC-xml-20081126/; https://www.w3.org/TR/2009/REC-xml-names-20091208/" : "docs/IMPLEMENTATION_EVIDENCE.md — DEMO ruleset 2; no bank-specification claim",
    evidence: "tests/hardening.test.ts; tests/validation.test.ts; synthetic structural evidence, not independently approved payment conformance",
  }));
}
export function provenanceFor(pack: FormatPack): RunProvenance {
  const nacha = pack.parserKind === "NACHA_FIXED";
  const expanded = pack.id === "nacha-origination-expanded-public-2026-r1";
  const profileMetadata: Partial<Record<string, readonly [string, string, readonly string[]]>> = {
    "CSV_WIRE": [CSV_WIRE_REVISION, CSV_WIRE_GUIDE, CSV_WIRE_EXCLUSIONS],
    "BAI2": [BAI2_REVISION, BAI2_GUIDE, BAI2_EXCLUSIONS],
    "nacha-origination-expanded-public-2026-r2": [NACHA_ORIGINATION_R2_REVISION, NACHA_ORIGINATION_R2_GUIDE, NACHA_ORIGINATION_R2_EXCLUSIONS],
    "NACHA_RETURN_FIXED": [NACHA_RETURNS_RULESET_REVISION, NACHA_RETURNS_GUIDE_REVISION, NACHA_RETURNS_EXCLUSIONS],
    "ACH_CONTROL_FIXED": [CONTROL_TOTAL_REVISION, CONTROL_TOTAL_GUIDE, CONTROL_TOTAL_EXCLUSIONS],
    "HUNTINGTON_ACK": [ACK_RULESET_REVISION, ACK_GUIDE_REVISION, ACK_EXCLUSIONS],
  };
  const metadata = profileMetadata[pack.id] ?? profileMetadata[pack.parserKind];
  const revision = metadata?.[0] ?? (expanded ? NACHA_EXPANDED_REVISION : nacha ? NACHA_RULESET_REVISION : RULESET_REVISION);
  return Object.freeze({ schemaVersion: metadata ? "3" : "2", profileId: pack.id, messageVersion: pack.version ?? "unavailable",
    implementationGuideRevision: metadata?.[1] ?? (expanded ? NACHA_EXPANDED_GUIDE : nacha ? NACHA_GUIDE_REVISION : "not supplied / not evaluated"), mode: pack.mode,
    rulesetRevision: revision, coverageRevision: `${pack.id}@${revision}`,
    buildRevision: typeof __BUILD_REVISION__ === "string" ? __BUILD_REVISION__ : "source-development",
    coverage: coverageFor(pack), exclusions: metadata?.[2] ?? (expanded ? NACHA_EXPANDED_EXCLUSIONS : nacha ? NACHA_EXCLUSIONS : EXCLUSIONS) });
}
declare const __BUILD_REVISION__: string;
