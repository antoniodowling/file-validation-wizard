import type { FormatPack, ReleaseApproval, ValidationContext, ValidationRule } from "./types";

const noApprovals: ReleaseApproval = Object.freeze({
  product: false,
  sc: false,
  ft: false,
  rulesApproved: false,
  fixturesApproved: false,
});

const PAIN_001_GUIDE_URL = "https://developer.huntington.com/enterprisepayments/docs/iso-pain001";
const PAIN_008_GUIDE_URL = "https://developer.huntington.com/enterprisepayments/docs/iso-pain008";
const EDI_820_GUIDE_URL = "https://developer.huntington.com/enterprisepayments/docs/edi-820";
const NACHA_GUIDE_URL = "https://developer.huntington.com/enterprisepayments/docs/nacha";

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
    outcome: context.xml?.hasDeclaration === true ? "PASS" as const : "WARNING" as const,
    message: context.xml?.hasDeclaration === true
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
    guideUrl: family === "PAIN.001" ? PAIN_001_GUIDE_URL : PAIN_008_GUIDE_URL,
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
    guideUrl: EDI_820_GUIDE_URL,
    enabled: true,
    mode: "DEMO",
    identifiers: Object.freeze({
      kind: "EDI_X12",
      isa12: version === "004010" ? "00401" : "00501",
      gs08: version,
    }),
    approval: noApprovals,
    rules: Object.freeze([nonEmptyRule]),
  });

const LEGACY_FORMAT_PACKS: readonly FormatPack[] = Object.freeze([
  isoPack("pain-001-03", "PAIN.001", "pain.001.001.03", "CstmrCdtTrfInitn"),
  isoPack("pain-001-09", "PAIN.001", "pain.001.001.09", "CstmrCdtTrfInitn"),
  isoPack("pain-001-13", "PAIN.001", "pain.001.001.13", "CstmrCdtTrfInitn"),
  isoPack("pain-008-02", "PAIN.008", "pain.008.001.02", "CstmrDrctDbtInitn"),
  isoPack("pain-008-08", "PAIN.008", "pain.008.001.08", "CstmrDrctDbtInitn"),
  isoPack("pain-008-12", "PAIN.008", "pain.008.001.12", "CstmrDrctDbtInitn"),
  ediPack("004010"),
  ediPack("005010"),
  ediPack("008030"),
  Object.freeze({
    id: "nacha-origination-public-2026",
    family: "NACHA",
    label: "NACHA / ACH — CCD, PPD, CTX, WEB, TEL originations",
    version: "origination-public-2026",
    parserKind: "NACHA_FIXED",
    extensions: Object.freeze([".ach", ".txt"]),
    guideUrl: NACHA_GUIDE_URL,
    enabled: true,
    mode: "CANDIDATE",
    identifiers: Object.freeze({
      kind: "NACHA_FIXED",
      profile: "origination-public-2026",
      secCodes: Object.freeze(["CCD", "PPD", "CTX", "WEB", "TEL"]),
    }),
    approval: noApprovals,
    rules: Object.freeze([Object.freeze({
      id: "nacha.non-empty-source",
      description: "The selected ACH file contains records.",
      field: "File content",
      defaultLocator: "file",
      evaluate: (context: ValidationContext) => ({
        outcome: context.source.length > 0 ? "PASS" as const : "ERROR" as const,
        message: context.source.length > 0 ? "The ACH file contains records." : "The ACH file is empty.",
      }),
    })]),
  } as FormatPack),
]);

export const EXPANDED_NACHA_PACK: FormatPack = Object.freeze({
  ...LEGACY_FORMAT_PACKS.find(pack => pack.id === "nacha-origination-public-2026")!,
  id: "nacha-origination-expanded-public-2026-r1",
  label: "NACHA / ACH — expanded entry types (public-source candidate)",
  version: "origination-expanded-public-2026-r1",
  identifiers: Object.freeze({ kind: "NACHA_FIXED", profile: "origination-expanded-public-2026-r1", secCodes: Object.freeze(["CCD", "PPD", "CTX", "WEB", "TEL"]) }),
});

export const ORIGINATION_R2_PACK: FormatPack = Object.freeze({
  ...EXPANDED_NACHA_PACK,
  id: "nacha-origination-expanded-public-2026-r2",
  label: "NACHA / ACH — expanded entries and declared healthcare (2026 r2 candidate)",
  version: "origination-expanded-public-2026-r2",
  identifiers: Object.freeze({ kind: "NACHA_FIXED", profile: "origination-expanded-public-2026-r2", secCodes: Object.freeze(["CCD", "PPD", "CTX", "WEB", "TEL"]) }),
});
const flatCandidate = (id: string, family: FormatPack["family"], version: string, identifiers: NonNullable<FormatPack["identifiers"]>, guideUrl: string): FormatPack => Object.freeze({
  id, family, label: family, version, parserKind: identifiers.kind, identifiers,
  extensions: Object.freeze(family === "NACHA Returns" ? [".ach", ".txt"] : [".txt"]),
  guideUrl, enabled: true, mode: "CANDIDATE", approval: noApprovals,
  rules: Object.freeze([Object.freeze({ ...nonEmptyRule, id: `${id}.non-empty-source` })]),
});
export const RETURNS_PACK = flatCandidate("nacha-returns-network-public-2026-r1", "NACHA Returns", "returns-network-public-2026-r1",
  Object.freeze({ kind: "NACHA_RETURN_FIXED", profile: "returns-network-public-2026-r1", secCodes: Object.freeze(["CCD", "PPD", "CTX", "WEB", "TEL", "COR"]) }), "https://developer.huntington.com/enterprisepayments/docs/nacha-returns");
export const CONTROL_TOTAL_PACK = flatCandidate("huntington-control-total-public-2026-r1", "Huntington Control Totals", "control-total-public-2026-r1",
  Object.freeze({ kind: "ACH_CONTROL_FIXED", profile: "control-total-public-2026-r1" }), "https://developer.huntington.com/enterprisepayments/docs/ach-control-total-flat-file");
export const ACK_PACK = flatCandidate("huntington-ack-pipe-1.0-candidate-r1", "Huntington ACK", "pipe-1.0-candidate-r1",
  Object.freeze({ kind: "HUNTINGTON_ACK", profile: "huntington-ack-pipe-1.0-candidate-r1" }), "https://developer.huntington.com/enterprisepayments/docs/file-received-ack-flat-file");
export const BAI2_PACK: FormatPack = Object.freeze({
  ...flatCandidate("huntington-bai2-public-2026-r1", "BAI2", "huntington-bai2-public-2026-r1",
    Object.freeze({ kind: "BAI2", profile: "huntington-bai2-public-2026-r1" }), "https://developer.huntington.com/enterprisepayments/docs/bai2"),
  label: "BAI2 — Huntington public-guide candidate",
  extensions: Object.freeze([".bai", ".bai2", ".txt"]),
});
export const CSV_WIRE_PACK: FormatPack = Object.freeze({
  ...flatCandidate("huntington-csv-wire-public-2026-r1", "CSV Wire", "huntington-csv-wire-public-2026-r1",
    Object.freeze({ kind: "CSV_WIRE", profile: "huntington-csv-wire-public-2026-r1" }), "https://developer.huntington.com/enterprisepayments/docs/wires-payments-automation"),
  label: "CSV Wire — Huntington public-guide candidate",
  extensions: Object.freeze([".csv", ".txt"]),
});
export const FORMAT_PACKS: readonly FormatPack[] = Object.freeze([...LEGACY_FORMAT_PACKS, EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK, RETURNS_PACK, CONTROL_TOTAL_PACK, ACK_PACK, BAI2_PACK, CSV_WIRE_PACK]);

export function formatPackReleaseErrors(pack: FormatPack): readonly string[] {
  if (!pack.enabled) return [];

  const errors: string[] = [];
  if (!pack.version?.trim()) errors.push("exact version");
  if (!pack.identifiers) errors.push("version identifiers");
  if (pack.rules.length === 0) errors.push("validation rules");
  if (pack.identifiers && pack.identifiers.kind !== pack.parserKind) {
    errors.push("parser/version identifier agreement");
  }
  if (pack.mode === "CANDIDATE" && !pack.guideUrl?.trim()) errors.push("source guide URL");
  if (pack.mode === "PRODUCTION") {
    if (!pack.releaseEvidence || Object.values(pack.releaseEvidence).some(value => !value.trim())) errors.push("revision-bound specification/ruleset/fixture/acceptance evidence");
    if (!pack.guideUrl?.trim()) errors.push("approved guide URL");
    if (!pack.approval.rulesApproved) errors.push("rules approval");
    if (!pack.approval.fixturesApproved) errors.push("fixture approval");
    if (!pack.approval.product) errors.push("Product sign-off");
    if (!pack.approval.sc) errors.push("SC sign-off");
    if (!pack.approval.ft) errors.push("FT sign-off");
  } else if (Object.values(pack.approval).some(Boolean)) {
    errors.push(`${pack.mode.toLowerCase()} profile must not claim release approval`);
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
