import type { FormatPack, ReleaseApproval, ValidationContext, ValidationRule } from "./types";

const noApprovals: ReleaseApproval = Object.freeze({
  product: false,
  sc: false,
  ft: false,
  rulesApproved: false,
  fixturesApproved: false,
});

const PAIN_001_GUIDE_URL = "https://developer.huntington.com/enterprisepayments/docs/iso-pain001";

const nonEmptyRule: ValidationRule = Object.freeze({
  id: "demo.non-empty-source",
  description: "The selected file contains data.",
  field: "File content",
  defaultLocator: "file",
  evaluate: (context: ValidationContext) => ({
    outcome: context.source.trim().length > 0 ? "PASS" as const : "ERROR" as const,
    message:
      context.source.trim().length > 0
        ? "The selected file contains data."
        : "The selected file is empty.",
  }),
});

const xmlDeclarationRule: ValidationRule = Object.freeze({
  id: "demo.xml-declaration",
  description: "An XML declaration is present.",
  field: "XML declaration",
  defaultLocator: "document",
  evaluate: (context: ValidationContext) => ({
    outcome: context.source.trimStart().startsWith("<?xml") ? "PASS" as const : "WARNING" as const,
    message: context.source.trimStart().startsWith("<?xml")
      ? "An XML declaration is present."
      : "Add an XML declaration to make the document encoding explicit.",
  }),
});

const isoPack = (
  id: string,
  family: "PAIN.001" | "PAIN.008",
  version: string,
  container: "CstmrCdtTrfInitn" | "CstmrDrctDbtInitn",
): FormatPack =>
  Object.freeze({
    id,
    family,
    label:
      family === "PAIN.001"
        ? "ISO 20022 PAIN.001 — Customer Credit Transfer Initiation"
        : "ISO 20022 PAIN.008 — Customer Direct Debit Initiation",
    version,
    parserKind: "ISO_XML",
    extensions: Object.freeze([".xml"]),
    guideUrl: family === "PAIN.001" ? PAIN_001_GUIDE_URL : null,
    enabled: true,
    mode: "DEMO",
    identifiers: Object.freeze({
      kind: "ISO_XML",
      namespace: `urn:iso:std:iso:20022:tech:xsd:${version}`,
      messageContainer: container,
    }),
    approval: noApprovals,
    rules: Object.freeze([nonEmptyRule, xmlDeclarationRule]),
  });

const ediPack = (version: "004010" | "005010" | "008030"): FormatPack =>
  Object.freeze({
    id: `edi-820-${version}`,
    family: "EDI 820",
    label: "ASC X12 EDI 820 — Payment Order / Remittance Advice",
    version,
    parserKind: "EDI_X12",
    extensions: Object.freeze([".edi", ".x12", ".820", ".txt"]),
    guideUrl: null,
    enabled: true,
    mode: "DEMO",
    identifiers: Object.freeze({
      kind: "EDI_X12",
      isa12: version === "004010" ? "00401" : "00501",
      gs08: version,
      st03: version,
    }),
    approval: noApprovals,
    rules: Object.freeze([nonEmptyRule]),
  });

export const FORMAT_PACKS: readonly FormatPack[] = Object.freeze([
  isoPack("pain-001-03", "PAIN.001", "pain.001.001.03", "CstmrCdtTrfInitn"),
  isoPack("pain-001-09", "PAIN.001", "pain.001.001.09", "CstmrCdtTrfInitn"),
  isoPack("pain-001-13", "PAIN.001", "pain.001.001.13", "CstmrCdtTrfInitn"),
  isoPack("pain-008-02", "PAIN.008", "pain.008.001.02", "CstmrDrctDbtInitn"),
  isoPack("pain-008-08", "PAIN.008", "pain.008.001.08", "CstmrDrctDbtInitn"),
  isoPack("pain-008-12", "PAIN.008", "pain.008.001.12", "CstmrDrctDbtInitn"),
  ediPack("004010"),
  ediPack("005010"),
  ediPack("008030"),
]);

export function formatPackReleaseErrors(pack: FormatPack): readonly string[] {
  if (!pack.enabled) return [];

  const errors: string[] = [];
  if (!pack.version?.trim()) errors.push("exact version");
  if (!pack.identifiers) errors.push("version identifiers");
  if (pack.rules.length === 0) errors.push("validation rules");
  if (pack.identifiers && pack.identifiers.kind !== pack.parserKind) {
    errors.push("parser/version identifier agreement");
  }
  if (pack.mode === "PRODUCTION") {
    if (!pack.guideUrl?.trim()) errors.push("approved guide URL");
    if (!pack.approval.rulesApproved) errors.push("rules approval");
    if (!pack.approval.fixturesApproved) errors.push("fixture approval");
    if (!pack.approval.product) errors.push("Product sign-off");
    if (!pack.approval.sc) errors.push("SC sign-off");
    if (!pack.approval.ft) errors.push("FT sign-off");
  } else if (Object.values(pack.approval).some(Boolean)) {
    errors.push("demo profile must not claim release approval");
  }
  return errors;
}

export function assertFormatPackRegistry(packs: readonly FormatPack[]): void {
  const ids = new Set<string>();
  for (const pack of packs) {
    if (ids.has(pack.id)) throw new Error(`Duplicate format-pack ID: ${pack.id}`);
    ids.add(pack.id);
    const errors = formatPackReleaseErrors(pack);
    if (errors.length > 0) {
      throw new Error(`Enabled format pack ${pack.id} is incomplete: ${errors.join(", ")}`);
    }
  }
}

assertFormatPackRegistry(FORMAT_PACKS);

export const enabledFormatPacks = (): readonly FormatPack[] =>
  FORMAT_PACKS.filter((pack) => pack.enabled && formatPackReleaseErrors(pack).length === 0);

export function findEnabledFormatPack(id: string): FormatPack | undefined {
  return enabledFormatPacks().find((pack) => pack.id === id);
}
