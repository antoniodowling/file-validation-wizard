import { describe, expect, it } from "vitest";
import {
  extensionList,
  findCatalogEntry,
  findCatalogVersion,
  FORMAT_CATALOG,
  searchFormatCatalog,
} from "../src/format-catalog";
import { FORMAT_PACKS } from "../src/format-packs";

describe("focused format catalog", () => {
  it("retains executable demo families and all four ACH candidate families", () => {
    expect(FORMAT_CATALOG.map((item) => item.id)).toEqual(["pain-001", "pain-008", "x12-820", "nacha", "nacha-returns", "huntington-control-totals", "huntington-ack"]);
    expect(new Set(FORMAT_CATALOG.map((item) => item.id)).size).toBe(7);
    expect(FORMAT_CATALOG.filter((item) => item.status === "REFERENCE_ONLY").map((item) => item.id)).toEqual([]);
    expect(FORMAT_CATALOG.filter((item) => item.status === "DEMO_SUPPORTED").every((item) => item.versions.length === 3)).toBe(true);
  });

  it("connects the public NACHA candidate without claiming an embedded annual version", () => {
    const nacha = findCatalogEntry("nacha");
    expect(nacha?.versions.slice(0, 1)).toEqual([{
      id: "origination-public-2026",
      label: "Public specification profile (2026 review)",
      validationProfileId: "nacha-origination-public-2026",
      extensions: [".ach", ".txt"],
    }]);
    expect(FORMAT_PACKS.some((pack) => pack.id === "nacha-origination-public-2026")).toBe(true);
    for (const code of ["CCD", "PPD", "CTX", "WEB", "TEL"]) {
      expect(searchFormatCatalog(code).map((item) => item.id)).toEqual(["nacha"]);
    }
  });

  it("maps exactly fifteen supported versions to executable profiles", () => {
    const profileIds = FORMAT_CATALOG.flatMap((item) =>
      item.versions.flatMap((version) => version.validationProfileId ? [version.validationProfileId] : []),
    );
    expect(profileIds).toHaveLength(15);
    expect(new Set(profileIds)).toEqual(new Set(FORMAT_PACKS.map((pack) => pack.id)));
    expect(FORMAT_CATALOG.filter((item) => item.status === "DEMO_SUPPORTED").map((item) => item.code)).toEqual([
      "pain.001",
      "pain.008",
      "820",
    ]);
  });

  it("links every executable profile to its Huntington format-family guide", () => {
    const slugs: Record<string, string> = {
      "PAIN.001": "iso-pain001",
      "PAIN.008": "iso-pain008",
      "EDI 820": "edi-820",
      "NACHA": "nacha",
      "NACHA Returns": "nacha-returns",
      "Huntington Control Totals": "ach-control-total-flat-file",
      "Huntington ACK": "file-received-ack-flat-file",
    };
    for (const pack of FORMAT_PACKS) {
      expect(slugs[pack.family]).toBeDefined();
      expect(pack.guideUrl).toBe(`https://developer.huntington.com/enterprisepayments/docs/${slugs[pack.family]}`);
    }
  });

  it("searches codes, names, standards, and aliases case-insensitively", () => {
    expect(searchFormatCatalog("credit transfer").map((item) => item.code)).toContain("pain.001");
    expect(searchFormatCatalog("SWIFT MT")).toEqual([]);
    expect(searchFormatCatalog("nacha ccd").map((item) => item.code)).toEqual(["NACHA"]);
    expect(searchFormatCatalog("x12 823").map((item) => item.code)).toEqual([]);
  });

  it("resolves dependent versions and extension labels", () => {
    expect(findCatalogEntry("pain-001")?.standard).toBe("ISO 20022");
    const version = findCatalogVersion("x12-820", "005010");
    expect(version?.validationProfileId).toBe("edi-820-005010");
    expect(extensionList(version?.extensions ?? [])).toBe("EDI, X12, 820, TXT");
  });
});
