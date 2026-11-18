import { describe, expect, it } from "vitest";
import {
  FORMAT_PACKS,
  assertFormatPackRegistry,
  enabledFormatPacks,
  formatPackReleaseErrors,
} from "../src/format-packs";
import { isoPack } from "./helpers";

describe("format-pack release gates", () => {
  it("retains nine demo profiles and eight candidates without claiming release approval", () => {
    expect(FORMAT_PACKS).toHaveLength(17);
    expect(enabledFormatPacks()).toHaveLength(17);
    expect(FORMAT_PACKS.filter((pack) => pack.mode === "DEMO")).toHaveLength(9);
    expect(FORMAT_PACKS.filter((pack) => pack.mode === "CANDIDATE").map((pack) => pack.family)).toEqual(["NACHA", "NACHA", "NACHA", "NACHA Returns", "Huntington Control Totals", "Huntington ACK", "BAI2", "CSV Wire"]);
    expect(FORMAT_PACKS.every((pack) => Object.values(pack.approval).every((value) => !value))).toBe(true);
  });

  it("allows .nacha for all NACHA origination packs without changing returns or other formats", () => {
    const originations = FORMAT_PACKS.filter(pack => pack.family === "NACHA");
    expect(originations).toHaveLength(3);
    for (const pack of originations) {
      expect(pack.extensions).toEqual([".ach", ".nacha", ".txt"]);
    }
    expect(FORMAT_PACKS.find(pack => pack.family === "NACHA Returns")!.extensions)
      .toEqual([".ach", ".txt"]);
    expect(FORMAT_PACKS.find(pack => pack.id === "pain-001-03")!.extensions).toEqual([".xml"]);
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
