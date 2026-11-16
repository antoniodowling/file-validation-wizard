import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import published from "../docs/coverage/report-schema-4.0.0.json";
import active from "../docs/coverage/active-profiles-2026-11-16.json";
import {
  ALL_FORMAT_PACKS, FORMAT_PACKS, RETIRED_FORMAT_PACKS,
  HIDDEN_FORMAT_PACKS, CSV_WIRE_PACK, ORIGINATION_R2_PACK,
  CONTROL_TOTAL_PACK, findEnabledFormatPack,
} from "../src/format-packs";
import { FORMAT_CATALOG } from "../src/format-catalog";
import { provenanceFor } from "../src/coverage";
import { validateSource } from "../src/validation";
import { syntheticSample } from "../src/samples";
import { validateWorkerRequest } from "../src/worker-request";

describe("retirement invariants (#65)", () => {
  const ids = ["pain-001-03", "nacha-origination-expanded-public-2026-r2", "huntington-control-total-public-2026-r1"];
  it("has a single closed active allowlist, with exactly 13 retired and one hidden", () => {
    expect(FORMAT_PACKS.map(pack => pack.id)).toEqual(ids);
    expect(active.map(p => p.profileId)).toEqual(ids);
    expect(published).toHaveLength(17);
    expect(ALL_FORMAT_PACKS.map(p => p.id)).toEqual(published.map(p => p.profileId));
    expect(RETIRED_FORMAT_PACKS).toHaveLength(13);
    expect(HIDDEN_FORMAT_PACKS).toEqual([CSV_WIRE_PACK]);
    expect(FORMAT_CATALOG.flatMap(entry => entry.versions.map(v => v.validationProfileId))).toEqual(ids);
    for (const pack of [...RETIRED_FORMAT_PACKS, CSV_WIRE_PACK]) {
      expect(findEnabledFormatPack(pack.id), pack.id).toBeUndefined();
      const outcome = validateWorkerRequest({ type: "validate", fileName: "retired.txt", packId: pack.id,
        bytes: new TextEncoder().encode("not a payment").buffer });
      expect(outcome, pack.id).toEqual({ type: "error", code: "PROFILE_UNAVAILABLE" });
    }
  });

  it("keeps R2 coverage/provenance identical to the published 52-check baseline", () => {
    const { buildRevision, ...snapshot } = provenanceFor(ORIGINATION_R2_PACK);
    const baseline = published.find(p => p.profileId === ORIGINATION_R2_PACK.id);
    expect(snapshot).toEqual(baseline);
    expect(snapshot.coverage).toHaveLength(52);
    expect(snapshot.coverage.map(rule => rule.id)).toEqual(active[1]!.coverage.map(rule => rule.id));
  });

  it("retains CTX X12 scanning and exclusion gates without a standalone EDI 820 option", () => {
    const scenarios = [
      ["ctx-pass.ach", "PASS", undefined],
      ["ctx-remittance-fail.ach", "FAIL", "nacha.ctx-remittance"],
      ["ctx-edifact-unsupported.ach", "UNSUPPORTED", undefined],
    ] as const;
    for (const [name, status, expectedRule] of scenarios) {
      const source = readFileSync(`demo-files/nacha-expanded/${name}`, "utf8");
      const run = validateSource(name, source, ORIGINATION_R2_PACK);
      expect(run.overallStatus, name).toBe(status);
      if (expectedRule) expect(run.results.some(r => r.ruleId === expectedRule && r.outcome === "ERROR"), name).toBe(true);
    }
    expect(FORMAT_CATALOG.some(entry => entry.id === "x12-820")).toBe(false);
  });

  it("validates NACHA R2 controls without uploading a separate Control Total file", () => {
    const nacha = readFileSync("demo-files/ach-candidates/origination-healthcare-pass.ach", "utf8");
    expect(validateSource("origination.ach", nacha, ORIGINATION_R2_PACK).overallStatus).toBe("PASS");
    const totals = readFileSync("demo-files/ach-candidates/totals-pass.txt", "utf8");
    expect(validateSource("control.txt", totals, CONTROL_TOTAL_PACK).overallStatus).toBe("PASS");
    expect(FORMAT_PACKS).toContain(CONTROL_TOTAL_PACK);
  });

  it("preserves hidden CSV Wire's parser, rules, coverage and direct test execution", () => {
    const { buildRevision, ...snapshot } = provenanceFor(CSV_WIRE_PACK);
    expect(snapshot).toEqual(published.find(p => p.profileId === CSV_WIRE_PACK.id));
    const run = validateSource("synthetic.csv", syntheticSample(CSV_WIRE_PACK, false), CSV_WIRE_PACK);
    expect(run.overallStatus).toBe("PASS");
    expect(run.provenance?.coverage.length).toBeGreaterThan(0);
  });

  it("retains PAIN.001 V3 and the ISO parser without enabling .09/.13", () => {
    const v3 = FORMAT_PACKS.find(pack => pack.id === "pain-001-03")!;
    expect(validateSource("synthetic.xml", syntheticSample(v3, false), v3).overallStatus).toBe("PASS");
    expect(FORMAT_PACKS.filter(pack => pack.parserKind === "ISO_XML")).toHaveLength(1);
  });
});
