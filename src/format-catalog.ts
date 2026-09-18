import type { FormatCatalogEntry, FormatVersionOption } from "./types";

const XML_EXTENSIONS = Object.freeze([".xml"]);
const SWIFT_EXTENSIONS = Object.freeze([".fin", ".mt", ".txt"]);
const X12_EXTENSIONS = Object.freeze([".edi", ".x12", ".txt"]);
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

const isoVersions = (...identifiers: string[]): readonly FormatVersionOption[] =>
  identifiers.map((identifier) => version(identifier, XML_EXTENSIONS));

const isoEntry = (
  code: string,
  name: string,
  versions: readonly FormatVersionOption[],
): FormatCatalogEntry =>
  entry(code.replace(".", "-"), "ISO 20022", code, name, [code, name, "ISO XML"], versions);

const swiftEntry = (code: string, name: string): FormatCatalogEntry =>
  entry(
    code.toLowerCase().replaceAll(" ", "-"),
    "SWIFT FIN",
    code,
    name,
    [code.replace("MT", "MT "), name, "SWIFT MT", "FIN"],
    ["SR2023", "SR2024", "SR2025"].map((release) => version(release, SWIFT_EXTENSIONS)),
  );

const x12Entry = (code: string, name: string, supported = false): FormatCatalogEntry => {
  const extensions = code === "820" ? X12_820_EXTENSIONS : X12_EXTENSIONS;
  const versions = ["004010", "005010", "008030"].map((release) =>
    version(release, extensions, supported ? `edi-820-${release}` : undefined),
  );
  return entry(`x12-${code}`, "ASC X12", code, name, [`EDI ${code}`, `X12 ${code}`, name], versions);
};

const achEntry = (code: string, name: string): FormatCatalogEntry =>
  entry(
    `ach-${code.toLowerCase()}`,
    "Nacha ACH",
    code,
    name,
    [`ACH ${code}`, `Nacha ${code}`, name],
    ["2024 Nacha Rules", "2025 Nacha Rules", "2026 Nacha Rules"].map((release) =>
      version(release, ACH_EXTENSIONS),
    ),
  );

export const FORMAT_CATALOG: readonly FormatCatalogEntry[] = Object.freeze([
  isoEntry("pain.001", "Customer Credit Transfer Initiation", [
    version("pain.001.001.03", XML_EXTENSIONS, "pain-001-03"),
    version("pain.001.001.09", XML_EXTENSIONS, "pain-001-09"),
    version("pain.001.001.13", XML_EXTENSIONS, "pain-001-13"),
  ]),
  isoEntry("pain.002", "Customer Payment Status Report", isoVersions("pain.002.001.13", "pain.002.001.14", "pain.002.001.15")),
  isoEntry("pain.007", "Customer Payment Reversal", isoVersions("pain.007.001.11", "pain.007.001.12", "pain.007.001.13")),
  isoEntry("pain.008", "Customer Direct Debit Initiation", [
    version("pain.008.001.02", XML_EXTENSIONS, "pain-008-02"),
    version("pain.008.001.08", XML_EXTENSIONS, "pain-008-08"),
    version("pain.008.001.12", XML_EXTENSIONS, "pain-008-12"),
  ]),
  isoEntry("pain.009", "Mandate Initiation Request", isoVersions("pain.009.001.06", "pain.009.001.07", "pain.009.001.08")),
  isoEntry("pain.010", "Mandate Amendment Request", isoVersions("pain.010.001.06", "pain.010.001.07", "pain.010.001.08")),
  isoEntry("pain.011", "Mandate Cancellation Request", isoVersions("pain.011.001.06", "pain.011.001.07", "pain.011.001.08")),
  isoEntry("pain.012", "Mandate Acceptance Report", isoVersions("pain.012.001.06", "pain.012.001.07", "pain.012.001.08")),
  isoEntry("pain.013", "Creditor Payment Activation Request", isoVersions("pain.013.001.10", "pain.013.001.11", "pain.013.001.12")),
  isoEntry("pain.014", "Creditor Payment Activation Request Status Report", isoVersions("pain.014.001.10", "pain.014.001.11", "pain.014.001.12")),
  isoEntry("camt.052", "Bank-to-Customer Account Report", isoVersions("camt.052.001.12", "camt.052.001.13", "camt.052.001.14")),
  isoEntry("camt.053", "Bank-to-Customer Statement", isoVersions("camt.053.001.12", "camt.053.001.13", "camt.053.001.14")),
  isoEntry("camt.054", "Bank-to-Customer Debit/Credit Notification", isoVersions("camt.054.001.12", "camt.054.001.13", "camt.054.001.14")),
  isoEntry("camt.055", "Customer Payment Cancellation Request", isoVersions("camt.055.001.11", "camt.055.001.12", "camt.055.001.13")),
  isoEntry("camt.056", "FI-to-FI Payment Cancellation Request", isoVersions("camt.056.001.10", "camt.056.001.11", "camt.056.001.12")),
  isoEntry("camt.057", "Notification to Receive", isoVersions("camt.057.001.07", "camt.057.001.08", "camt.057.001.09")),
  isoEntry("camt.060", "Account Reporting Request", isoVersions("camt.060.001.05", "camt.060.001.06", "camt.060.001.07")),
  isoEntry("camt.086", "Bank Services Billing Statement", isoVersions("camt.086.001.03", "camt.086.001.04", "camt.086.001.05")),
  isoEntry("pacs.002", "FI-to-FI Payment Status Report", isoVersions("pacs.002.001.14", "pacs.002.001.15", "pacs.002.001.16")),
  isoEntry("pacs.004", "Payment Return", isoVersions("pacs.004.001.13", "pacs.004.001.14", "pacs.004.001.15")),
  isoEntry("pacs.007", "FI-to-FI Payment Reversal", isoVersions("pacs.007.001.12", "pacs.007.001.13", "pacs.007.001.14")),
  isoEntry("pacs.008", "FI-to-FI Customer Credit Transfer", isoVersions("pacs.008.001.12", "pacs.008.001.13", "pacs.008.001.14")),
  isoEntry("pacs.009", "Financial Institution Credit Transfer", isoVersions("pacs.009.001.11", "pacs.009.001.12", "pacs.009.001.13")),
  isoEntry("pacs.010", "Financial Institution Direct Debit", isoVersions("pacs.010.001.04", "pacs.010.001.05", "pacs.010.001.06")),
  isoEntry("pacs.028", "FI-to-FI Payment Status Request", isoVersions("pacs.028.001.05", "pacs.028.001.06", "pacs.028.001.07")),
  swiftEntry("MT101", "Request for Transfer"),
  swiftEntry("MT103", "Single Customer Credit Transfer"),
  swiftEntry("MT202", "General Financial Institution Transfer"),
  swiftEntry("MT202 COV", "General Financial Institution Transfer with Cover"),
  swiftEntry("MT900", "Confirmation of Debit"),
  swiftEntry("MT910", "Confirmation of Credit"),
  swiftEntry("MT920", "Request Message"),
  swiftEntry("MT940", "Customer Statement Message"),
  swiftEntry("MT941", "Balance Report"),
  swiftEntry("MT942", "Interim Transaction Report"),
  swiftEntry("MT950", "Statement Message"),
  x12Entry("820", "Payment Order / Remittance Advice", true),
  x12Entry("821", "Financial Information Reporting"),
  x12Entry("822", "Account Analysis"),
  x12Entry("823", "Lockbox"),
  x12Entry("824", "Application Advice"),
  achEntry("ARC", "Accounts Receivable Entry"),
  achEntry("BOC", "Back Office Conversion Entry"),
  achEntry("CCD", "Corporate Credit or Debit"),
  achEntry("CTX", "Corporate Trade Exchange"),
  achEntry("IAT", "International ACH Transaction"),
  achEntry("POP", "Point-of-Purchase Entry"),
  achEntry("PPD", "Prearranged Payment and Deposit Entry"),
  achEntry("TEL", "Telephone-Initiated Entry"),
  achEntry("WEB", "Internet-Initiated / Mobile Entry"),
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
