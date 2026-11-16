import { describe, expect, it } from "vitest";
import {
  extensionList,
  findCatalogEntry,
  findCatalogVersion,
  FORMAT_CATALOG,
  searchFormatCatalog,
} from "../src/format-catalog";
import { FORMAT_PACKS } from "../src/format-packs";

describe("focused customer format catalog", () => {
  it("lists only executable retained families; excludes retired and hidden candidates", () => {
    expect(FORMAT_CATALOG.map(item => item.id)).toEqual(["pain-001", "nacha", "huntington-control-totals"]);
    expect(FORMAT_CATALOG.map(item => item.code)).toEqual(["pain.001", "NACHA", "ACH Control Totals"]);
    expect(FORMAT_CATALOG.filter(item => item.status === "DEMO_SUPPORTED")).toHaveLength(1);
    expect(FORMAT_CATALOG.filter(item => item.status === "CANDIDATE_SUPPORTED")).toHaveLength(2);
    for (const hiddenOrRetired of ["pain-008", "x12-820", "nacha-returns", "huntington-ack", "bai2", "csv-wire"]) {
      expect(findCatalogEntry(hiddenOrRetired)).toBeUndefined();
    }
  });

  it("exposes only R2 in NACHA, without claiming annual specification compliance", () => {
    expect(findCatalogEntry("nacha")?.versions).toEqual([{
      id: "origination-expanded-public-2026-r2",
      label: "Expanded entries and declared healthcare — candidate (2026 r2)",
      validationProfileId: "nacha-origination-expanded-public-2026-r2",
      extensions: [".ach", ".txt"],
    }]);
    for (const code of ["CCD", "PPD", "CTX", "WEB", "TEL"]) {
      expect(searchFormatCatalog(code).map(item => item.id)).toEqual(["nacha"]);
    }
  });

  it("maps exactly three customer versions to the executable pack registry", () => {
    const ids = FORMAT_CATALOG.flatMap(item =>
      item.versions.flatMap(version => version.validationProfileId ? [version.validationProfileId] : []));
    expect(ids).toHaveLength(3);
    expect(new Set(ids)).toEqual(new Set(FORMAT_PACKS.map(pack => pack.id)));
    expect(findCatalogEntry("pain-001")?.versions.map(v => v.id)).toEqual(["pain.001.001.03"]);
  });

  it("links every active profile to its Huntington format-family guide", () => {
    const slugs: Record<string, string> = {
      "PAIN.001": "iso-pain001",
      "NACHA": "nacha",
      "Huntington Control Totals": "ach-control-total-flat-file",
    };
    for (const pack of FORMAT_PACKS) {
      expect(slugs[pack.family]).toBeDefined();
      expect(pack.guideUrl).toBe(`https://developer.huntington.com/enterprisepayments/docs/${slugs[pack.family]}`);
    }
  });

  it("searches exact supported codes, names, and aliases case-insensitively", () => {
    expect(searchFormatCatalog("credit transfer").map(item => item.code)).toContain("pain.001");
    expect(searchFormatCatalog("SWIFT MT")).toEqual([]);
    expect(searchFormatCatalog("nacha ccd").map(item => item.code)).toEqual(["NACHA"]);
    expect(searchFormatCatalog("x12 823")).toEqual([]);
    expect(searchFormatCatalog("EDI 820")).toEqual([]);
    expect(searchFormatCatalog("CSV Wire")).toEqual([]);
  });

  it("resolves versions and extensions without leaving retired versions selectable", () => {
    expect(findCatalogEntry("pain-001")?.standard).toBe("ISO 20022");
    const r2 = findCatalogVersion("nacha", "origination-expanded-public-2026-r2");
    expect(r2?.validationProfileId).toBe("nacha-origination-expanded-public-2026-r2");
    expect(extensionList(r2?.extensions ?? [])).toBe("ACH, TXT");
    expect(findCatalogVersion("nacha", "origination-expanded-public-2026-r1")).toBeUndefined();
    expect(findCatalogVersion("pain-001", "pain.001.001.09")).toBeUndefined();
  });
});
