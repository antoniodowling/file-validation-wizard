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
    status: id.startsWith("nacha") || id.startsWith("huntington") || id === "bai2" || id === "csv-wire" ? "CANDIDATE_SUPPORTED" : "DEMO_SUPPORTED",
    versions: Object.freeze(versions),
  });

// Each catalog entry has executable validation. The NACHA label identifies a
// public-source candidate profile, without claiming complete 2026 Rules approval.
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
  ], [Object.freeze({
    id: "origination-public-2026",
    label: "Public specification profile (2026 review)",
    extensions: ACH_EXTENSIONS,
    validationProfileId: "nacha-origination-public-2026",
  }), Object.freeze({
    id: "origination-expanded-public-2026-r1",
    label: "Expanded entry types — public-source candidate (2026 r1)",
    extensions: ACH_EXTENSIONS,
    validationProfileId: "nacha-origination-expanded-public-2026-r1",
  }), Object.freeze({
    id: "origination-expanded-public-2026-r2",
    label: "Expanded entries and declared healthcare — candidate (2026 r2)",
    extensions: ACH_EXTENSIONS,
    validationProfileId: "nacha-origination-expanded-public-2026-r2",
  })]),
  entry("nacha-returns", "Nacha ACH", "ACH Returns", "Returns and Notifications of Change", ["NACHA Returns", "ACH NOC", "COR", "Dishonored", "Contested", "Refused NOC"], [Object.freeze({
    id: "returns-network-public-2026-r1", label: "General network returns — public-source candidate (2026 r1)", extensions: ACH_EXTENSIONS, validationProfileId: "nacha-returns-network-public-2026-r1",
  })]),
  entry("huntington-control-totals", "Huntington", "ACH Control Totals", "Separate 58-column Control Total File", ["Huntington totals", "ACH totals"], [Object.freeze({
    id: "control-total-public-2026-r1", label: "58-column standalone candidate (2026 r1)", extensions: Object.freeze([".txt"]), validationProfileId: "huntington-control-total-public-2026-r1",
  })]),
  entry("huntington-ack", "Huntington", "File Received ACK", "File Received Acknowledgment", ["ACK", "Acknowledgement", "Receipt"], [Object.freeze({
    id: "pipe-1.0-candidate-r1", label: "Single pipe-delimited scenario — candidate (1.0 r1)", extensions: Object.freeze([".txt"]), validationProfileId: "huntington-ack-pipe-1.0-candidate-r1",
  })]),
  entry("bai2", "Information Reporting", "BAI2", "Balance and Transaction Reporting", ["BAI", "BAI2", "Bank statements", "Cash management", "Balance reporting"], [Object.freeze({
    id: "huntington-bai2-public-2026-r1", label: "Huntington public-guide candidate (BAI2 2026 r1)", extensions: Object.freeze([".bai", ".bai2", ".txt"]), validationProfileId: "huntington-bai2-public-2026-r1",
  })]),
  entry("csv-wire", "Huntington", "CSV Wire", "Domestic and International Wire Import", ["USWIRE", "INT", "Wire payments", "Comma separated"], [Object.freeze({
    id: "huntington-csv-wire-public-2026-r1", label: "Huntington CSV Wire — USD candidate (2026 r1)", extensions: Object.freeze([".csv", ".txt"]), validationProfileId: "huntington-csv-wire-public-2026-r1",
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
