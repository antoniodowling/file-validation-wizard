import type { FormatCatalogEntry, FormatVersionOption } from "./types";

const XML_EXTENSIONS = Object.freeze([".xml"]);
const X12_820_EXTENSIONS = Object.freeze([".edi", ".x12", ".820", ".txt"]);
const ACH_EXTENSIONS = Object.freeze([".ach", ".txt"]);

const version = (
  label: string,
  extensions: readonly string[],
  validationProfileId?: string,
): FormatVersionOption =>
  Object.freeze(
    validationProfileId
      ? { id: label.toLowerCase(), label, extensions, validationProfileId }
      : { id: label.toLowerCase(), label, extensions },
  );

const entry = (
  id: string,
  standard: string,
  code: string,
  name: string,
  aliases: readonly string[],
  versions: readonly FormatVersionOption[],
): FormatCatalogEntry =>
  Object.freeze({
    id,
    standard,
    code,
    name,
    aliases: Object.freeze(aliases),
    status: versions.some((item) => item.validationProfileId) ? "DEMO_SUPPORTED" : "REFERENCE_ONLY",
    versions: Object.freeze(versions),
  });

// Retain the formats with executable validation. NACHA is the sole pending
// entry; its rules-year label does not claim an implemented or approved pack.
export const FORMAT_CATALOG: readonly FormatCatalogEntry[] = Object.freeze([
  entry("pain-001", "ISO 20022", "pain.001", "Customer Credit Transfer Initiation", [
    "PAIN.001", "Customer Credit Transfer Initiation", "ISO XML",
  ], [
    version("pain.001.001.03", XML_EXTENSIONS, "pain-001-03"),
    version("pain.001.001.09", XML_EXTENSIONS, "pain-001-09"),
    version("pain.001.001.13", XML_EXTENSIONS, "pain-001-13"),
  ]),
  entry("pain-008", "ISO 20022", "pain.008", "Customer Direct Debit Initiation", [
    "PAIN.008", "Customer Direct Debit Initiation", "ISO XML",
  ], [
    version("pain.008.001.02", XML_EXTENSIONS, "pain-008-02"),
    version("pain.008.001.08", XML_EXTENSIONS, "pain-008-08"),
    version("pain.008.001.12", XML_EXTENSIONS, "pain-008-12"),
  ]),
  entry("x12-820", "ASC X12", "820", "Payment Order / Remittance Advice", [
    "EDI 820", "X12 820", "Payment Order", "Remittance Advice",
  ], ["004010", "005010", "008030"].map((release) =>
    version(release, X12_820_EXTENSIONS, `edi-820-${release}`),
  )),
  entry("nacha", "Nacha ACH", "NACHA", "ACH Payment Instructions", [
    "ACH", "CCD", "CCD+", "PPD", "PPD+", "CTX", "WEB", "TEL",
    "Nacha CCD", "Nacha PPD", "Nacha CTX", "Nacha WEB", "Nacha TEL",
    "ACH CCD", "ACH PPD", "ACH CTX", "ACH WEB", "ACH TEL",
    "Corporate Credit or Debit", "Prearranged Payment and Deposit", "Corporate Trade Exchange",
    "Internet-Initiated", "Telephone-Initiated",
  ], [version("2026 Nacha Rules", ACH_EXTENSIONS)]),
]);

export function searchFormatCatalog(query: string): readonly FormatCatalogEntry[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return FORMAT_CATALOG;
  return FORMAT_CATALOG.filter((item) =>
    [item.standard, item.code, item.name, ...item.aliases]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalized),
  );
}

export const findCatalogEntry = (id: string | null): FormatCatalogEntry | undefined =>
  FORMAT_CATALOG.find((item) => item.id === id);

export const findCatalogVersion = (
  formatId: string | null,
  versionId: string | null,
): FormatVersionOption | undefined =>
  findCatalogEntry(formatId)?.versions.find((item) => item.id === versionId);

export function extensionList(extensions: readonly string[]): string {
  return extensions.map((item) => item.slice(1).toUpperCase()).join(", ");
}
