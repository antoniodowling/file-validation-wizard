import { describe, expect, it } from "vitest";
import {
  FORMAT_PACKS,
  ALL_FORMAT_PACKS,
  RETIRED_FORMAT_PACKS,
  HIDDEN_FORMAT_PACKS,
  CSV_WIRE_PACK,
  ORIGINATION_R2_PACK,
  EXPANDED_NACHA_PACK,
  findEnabledFormatPack,
  assertFormatPackRegistry,
  enabledFormatPacks,
  formatPackReleaseErrors,
} from "../src/format-packs";
import { isoPack } from "./helpers";

describe("format-pack release gates", () => {
  it("exposes three retained profiles and preserves archival definitions", () => {
    expect(FORMAT_PACKS.map(pack => pack.id)).toEqual([
      "pain-001-03",
      "nacha-origination-expanded-public-2026-r2",
      "huntington-control-total-public-2026-r1",
    ]);
    expect(enabledFormatPacks()).toHaveLength(3);
    expect(FORMAT_PACKS.filter(pack => pack.mode === "DEMO")).toHaveLength(1);
    expect(FORMAT_PACKS.filter(pack => pack.mode === "CANDIDATE").map(pack => pack.family)).toEqual(["NACHA", "Huntington Control Totals"]);
    expect(ALL_FORMAT_PACKS).toHaveLength(17);
    expect(RETIRED_FORMAT_PACKS).toHaveLength(13);
    expect(new Set(RETIRED_FORMAT_PACKS.map(pack => pack.id)).size).toBe(13);
    expect(HIDDEN_FORMAT_PACKS).toEqual([CSV_WIRE_PACK]);
    for (const pack of [...RETIRED_FORMAT_PACKS, ...HIDDEN_FORMAT_PACKS]) {
      expect(findEnabledFormatPack(pack.id), pack.id).toBeUndefined();
    }
    expect(ALL_FORMAT_PACKS.every(pack => Object.values(pack.approval).every(value => !value))).toBe(true);
  });

  it("preserves R2 non-empty validation without selecting retired profiles", () => {
    expect(ORIGINATION_R2_PACK.identifiers).toEqual({
      kind: "NACHA_FIXED", profile: "origination-expanded-public-2026-r2",
      secCodes: ["CCD", "PPD", "CTX", "WEB", "TEL"],
    });
    expect(ORIGINATION_R2_PACK.rules.map(rule => rule.id)).toEqual(EXPANDED_NACHA_PACK.rules.map(rule => rule.id));
    expect(ORIGINATION_R2_PACK.rules[0]?.evaluate({ source: "", parserKind: "NACHA_FIXED" }).outcome).toBe("ERROR");
    expect(ORIGINATION_R2_PACK.rules[0]?.evaluate({ source: "1", parserKind: "NACHA_FIXED" }).outcome).toBe("PASS");
  });

  it("rejects an incomplete enabled production pack", () => {
    const incomplete = isoPack({ version: null, guideUrl: null, rules: [] });
    expect(formatPackReleaseErrors(incomplete)).toContain("exact version");
    expect(() => assertFormatPackRegistry([incomplete])).toThrow(/incomplete/);
  });

  it("rejects demo profiles that claim release approval", () => {
    const mislabeled = isoPack({ mode: "DEMO" });
    expect(formatPackReleaseErrors(mislabeled)).toContain("demo profile must not claim release approval");
  });

  it("keeps candidate approval claims gated and requires a source guide", () => {
    const candidate = FORMAT_PACKS.find((pack) => pack.mode === "CANDIDATE")!;
    expect(formatPackReleaseErrors({ ...candidate, approval: { ...candidate.approval, rulesApproved: true } }))
      .toContain("candidate profile must not claim release approval");
    expect(formatPackReleaseErrors({ ...candidate, guideUrl: null })).toContain("source guide URL");
    expect(formatPackReleaseErrors({ ...candidate, mode: "PRODUCTION" })).toContain("rules approval");
  });

  it("accepts a complete approved production pack", () => {
    expect(formatPackReleaseErrors(isoPack())).toEqual([]);
    expect(() => assertFormatPackRegistry([isoPack()])).not.toThrow();
  });
});
