import type { CoverageRule, FormatPack, RunProvenance } from "./types";
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
  return Object.freeze({ schemaVersion: "2", profileId: pack.id, messageVersion: pack.version ?? "unavailable",
    implementationGuideRevision: "not supplied / not evaluated", mode: pack.mode,
    rulesetRevision: RULESET_REVISION, coverageRevision: `${pack.id}@${RULESET_REVISION}`,
    buildRevision: typeof __BUILD_REVISION__ === "string" ? __BUILD_REVISION__ : "source-development",
    coverage: coverageFor(pack), exclusions: EXCLUSIONS });
}
declare const __BUILD_REVISION__: string;
