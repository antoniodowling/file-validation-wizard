import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { findEnabledFormatPack } from "../src/format-packs";
import { locateFindings } from "../src/finding-locations";
import { NACHA_EXPANDED_RULE_IDS } from "../src/parsers/nacha";
import { validateSource } from "../src/validation";
interface Fixture { file: string; description: string; expectedStatus: "PASS" | "PASS_WITH_WARNINGS" | "FAIL"; expectedRuleIds: string[]; sha256: string; bytes: number }
const directory = resolve(process.cwd(), "demo-files/nacha-expanded");
const manifest = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8")) as { synthetic: boolean; fixtures: Fixture[] };

describe("synthetic public NACHA origination fixtures", () => {
  it.each(manifest.fixtures)("validates $file with its intended outcome and navigable findings", (fixture) => {
    const pack = findEnabledFormatPack("nacha-origination-expanded-public-2026-r1");
    expect(pack).toBeTruthy();
    if (!pack) return;
    const source = readFileSync(resolve(directory, fixture.file), "utf8");
    expect(Buffer.byteLength(source)).toBe(fixture.bytes);
    expect(createHash("sha256").update(source).digest("hex")).toBe(fixture.sha256);
    const run = validateSource(fixture.file, source, pack);
    expect(run.overallStatus).toBe(fixture.expectedStatus);
    const failures = run.results.filter(result => result.outcome !== "PASS");
    for (const id of fixture.expectedRuleIds) expect(failures.map(result => result.ruleId)).toContain(id);
    const locations = locateFindings(source, pack, run);
    for (const result of failures) {
      const location = locations.find(entry => entry.ordinal === result.ordinal)?.location;
      expect(location, `${fixture.file}: ${result.ruleId}`).toBeTruthy();
      expect(location?.kind).not.toBe("unavailable");
      if (location?.kind === "located") {
        for (const target of [location.primary, ...location.related]) {
          expect(target.span.start).toBeGreaterThanOrEqual(0);
          expect(target.span.end).toBeGreaterThanOrEqual(target.span.start);
          expect(target.span.end).toBeLessThanOrEqual(source.length);
        }
      }
    }
  });

  it("covers every implemented rule's ERROR or WARNING branch in a named fixture", () => {
    const namedCoverage = new Set(manifest.fixtures.flatMap(fixture => fixture.expectedRuleIds));
    expect(NACHA_EXPANDED_RULE_IDS.filter(id => !namedCoverage.has(id))).toEqual([]);
    const pack = findEnabledFormatPack("nacha-origination-expanded-public-2026-r1");
    expect(pack).toBeTruthy();
    if (!pack) return;
    const actualCoverage = new Set(manifest.fixtures.flatMap(fixture => validateSource(fixture.file,
      readFileSync(resolve(directory, fixture.file), "utf8"), pack).results
      .filter(result => result.outcome === "ERROR" || result.outcome === "WARNING").map(result => result.ruleId)));
    expect(NACHA_EXPANDED_RULE_IDS.filter(id => !actualCoverage.has(id))).toEqual([]);
  });

  it("regenerates every fixture and its manifest byte-for-byte without private inputs", () => {
    const temporary = mkdtempSync(resolve(tmpdir(), "nacha-fixtures-"));
    try {
      const generated = spawnSync(process.execPath, [resolve(process.cwd(), "scripts/generate-nacha-expanded-files.mjs"), temporary], { encoding: "utf8" });
      expect(generated.status, generated.stderr).toBe(0);
      for (const file of ["manifest.json", ...manifest.fixtures.map(fixture => fixture.file)]) {
        expect(readFileSync(resolve(temporary, file))).toEqual(readFileSync(resolve(directory, file)));
      }
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });

  it("keeps all positive fixtures printable ASCII, fixed-width, and padded to ten records", () => {
    expect(manifest.synthetic).toBe(true);
    for (const fixture of manifest.fixtures.filter(f => f.expectedStatus === "PASS" || f.expectedStatus === "PASS_WITH_WARNINGS")) {
      const source = readFileSync(resolve(directory, fixture.file), "utf8");
      const rows = /\r|\n/.test(source) ? source.replace(/(?:\r\n|\r|\n)$/, "").split(/\r\n|\r|\n/) : source.match(/.{94}/g)!;
      expect(rows.length % 10, fixture.file).toBe(0);
      expect(rows.every(row => /^[\x20-\x7e]{94}$/.test(row)), fixture.file).toBe(true);
    }
  });
});
