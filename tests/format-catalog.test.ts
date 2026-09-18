import { describe, expect, it } from "vitest";
import {
  extensionList,
  findCatalogEntry,
  findCatalogVersion,
  FORMAT_CATALOG,
  searchFormatCatalog,
} from "../src/format-catalog";
import { FORMAT_PACKS } from "../src/format-packs";

describe("demo format catalog", () => {
  it("contains exactly 50 unique payments and treasury entries", () => {
    expect(FORMAT_CATALOG).toHaveLength(50);
    expect(new Set(FORMAT_CATALOG.map((item) => item.id)).size).toBe(50);
    expect(FORMAT_CATALOG.every((item) => item.versions.length === 3)).toBe(true);
  });

  it("maps exactly nine supported versions to executable profiles", () => {
    const profileIds = FORMAT_CATALOG.flatMap((item) =>
      item.versions.flatMap((version) => version.validationProfileId ? [version.validationProfileId] : []),
    );
    expect(profileIds).toHaveLength(9);
    expect(new Set(profileIds)).toEqual(new Set(FORMAT_PACKS.map((pack) => pack.id)));
    expect(FORMAT_CATALOG.filter((item) => item.status === "DEMO_SUPPORTED").map((item) => item.code)).toEqual([
      "pain.001",
      "pain.008",
      "820",
    ]);
    expect(FORMAT_PACKS.filter((pack) => pack.family === "PAIN.001").every(
      (pack) => pack.guideUrl === "https://developer.huntington.com/enterprisepayments/docs/iso-pain001",
    )).toBe(true);
    expect(FORMAT_PACKS.filter((pack) => pack.family !== "PAIN.001").every((pack) => pack.guideUrl === null)).toBe(true);
  });

  it("searches codes, names, standards, and aliases case-insensitively", () => {
    expect(searchFormatCatalog("credit transfer").map((item) => item.code)).toContain("pain.001");
    expect(searchFormatCatalog("SWIFT MT")).toHaveLength(11);
    expect(searchFormatCatalog("nacha ccd").map((item) => item.code)).toEqual(["CCD"]);
    expect(searchFormatCatalog("x12 823").map((item) => item.code)).toEqual(["823"]);
  });

  it("resolves dependent versions and extension labels", () => {
    expect(findCatalogEntry("pain-001")?.standard).toBe("ISO 20022");
    const version = findCatalogVersion("x12-820", "005010");
    expect(version?.validationProfileId).toBe("edi-820-005010");
    expect(extensionList(version?.extensions ?? [])).toBe("EDI, X12, 820, TXT");
  });
});
