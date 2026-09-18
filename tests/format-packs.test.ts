import { describe, expect, it } from "vitest";
import {
  FORMAT_PACKS,
  assertFormatPackRegistry,
  enabledFormatPacks,
  formatPackReleaseErrors,
} from "../src/format-packs";
import { isoPack } from "./helpers";

describe("format-pack release gates", () => {
  it("exposes nine complete demo profiles without claiming release approval", () => {
    expect(FORMAT_PACKS).toHaveLength(9);
    expect(enabledFormatPacks()).toHaveLength(9);
    expect(FORMAT_PACKS.every((pack) => pack.mode === "DEMO")).toBe(true);
    expect(FORMAT_PACKS.every((pack) => Object.values(pack.approval).every((value) => !value))).toBe(true);
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

  it("accepts a complete approved production pack", () => {
    expect(formatPackReleaseErrors(isoPack())).toEqual([]);
    expect(() => assertFormatPackRegistry([isoPack()])).not.toThrow();
  });
});
