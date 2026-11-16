import type { FormatCatalogEntry, FormatVersionOption } from "./types";

const XML_EXTENSIONS = Object.freeze([".xml"]);
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
    status: id.startsWith("nacha") || id.startsWith("huntington") || id === "bai2" || id === "csv-wire" ? "CANDIDATE_SUPPORTED" : "DEMO_SUPPORTED",
    versions: Object.freeze(versions),
  });

// Each catalog entry has executable validation. The NACHA label identifies a
// public-source candidate profile, without claiming complete 2026 Rules approval.
// Only currently supported customer-facing profiles belong here. Retired packs
// and the intentionally hidden CSV Wire implementation are not selectable.
export const FORMAT_CATALOG: readonly FormatCatalogEntry[] = Object.freeze([
  entry("pain-001", "ISO 20022", "pain.001", "Customer Credit Transfer Initiation", [
    "PAIN.001", "Customer Credit Transfer Initiation", "ISO XML",
  ], [
    version("pain.001.001.03", XML_EXTENSIONS, "pain-001-03"),
  ]),
  entry("nacha", "Nacha ACH", "NACHA", "ACH Payment Instructions", [
    "ACH", "CCD", "CCD+", "PPD", "PPD+", "CTX", "WEB", "TEL",
    "Nacha CCD", "Nacha PPD", "Nacha CTX", "Nacha WEB", "Nacha TEL",
    "ACH CCD", "ACH PPD", "ACH CTX", "ACH WEB", "ACH TEL",
    "Corporate Credit or Debit", "Prearranged Payment and Deposit", "Corporate Trade Exchange",
    "Internet-Initiated", "Telephone-Initiated",
  ], [Object.freeze({
    id: "origination-expanded-public-2026-r2",
    label: "Expanded entries and declared healthcare — candidate (2026 r2)",
    extensions: ACH_EXTENSIONS,
    validationProfileId: "nacha-origination-expanded-public-2026-r2",
  })]),
  entry("huntington-control-totals", "Huntington", "ACH Control Totals", "Separate 58-column Control Total File", [
    "Huntington totals", "ACH totals",
  ], [Object.freeze({
    id: "control-total-public-2026-r1",
    label: "58-column standalone candidate (2026 r1)",
    extensions: Object.freeze([".txt"]),
    validationProfileId: "huntington-control-total-public-2026-r1",
  })]),
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
