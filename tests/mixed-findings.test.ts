import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import manifest from "../demo-files/mixed-findings/manifest.json";
import { findEnabledFormatPack } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
import { locateFindings } from "../src/finding-locations";
import { validationRunToCsv, validationRunToJson } from "../src/csv";

it.each(manifest.fixtures)("preserves mixed ERROR/WARNING findings with overall FAIL for $file", fixture => {
  const bytes = readFileSync(`demo-files/mixed-findings/${fixture.file}`);
  const source = bytes.toString("utf8");
  expect(bytes.byteLength).toBe(fixture.bytes);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.sha256);
  expect(createHash("sha256").update(readFileSync(fixture.derivedFrom)).digest("hex")).toBe(fixture.derivedFromSha256);
  const pack = findEnabledFormatPack(fixture.profileId)!;
  expect(pack).toBeDefined();
  const run = validateSource(fixture.file, source, pack);
  expect(run.executionStatus).toBe("COMPLETED");
  expect(run.overallStatus).toBe("FAIL"); expect(run.verdict).toBe("FAIL");
  expect(run.errorCount).toBe(1); expect(run.warningCount).toBe(1);
  expect(run.results.filter(r => r.outcome === "ERROR").map(r => r.ruleId)).toEqual(fixture.errorRuleIds);
  expect(run.results.filter(r => r.outcome === "WARNING").map(r => r.ruleId)).toEqual(fixture.warningRuleIds);
  expect(run.results.some(r => r.outcome === "PASS")).toBe(true);
  const locations = locateFindings(source, pack, run);
  expect(locations).toHaveLength(2);
  for (const location of locations) {
    expect(location.location.kind).toBe("located");
    if (location.location.kind === "located") {
      expect(location.location.primary.span.start).toBeGreaterThanOrEqual(0);
      expect(location.location.primary.span.end).toBeLessThanOrEqual(source.length);
    }
  }
  const response = validateWorkerRequest({ type: "validate", packId: pack.id, fileName: fixture.file, bytes: new TextEncoder().encode(source).buffer, includeExplorer: true });
  expect(response.type).toBe("complete");
  if (response.type === "complete") {
    expect(response.run).toEqual(run); expect(response.source).toBe(source);
  }
  const report = JSON.parse(validationRunToJson(run));
  expect(report.overallStatus).toBe("FAIL"); expect(report.errorCount).toBe(1); expect(report.warningCount).toBe(1);
  expect(report.results.filter((r: { outcome: string }) => r.outcome === "ERROR").map((r: { ruleId: string }) => r.ruleId)).toEqual(fixture.errorRuleIds);
  expect(report.results.filter((r: { outcome: string }) => r.outcome === "WARNING").map((r: { ruleId: string }) => r.ruleId)).toEqual(fixture.warningRuleIds);
  const csv = validationRunToCsv(run).split("\r\n");
  for (const id of fixture.errorRuleIds) expect(csv.some(row => row.includes(`"${id}","ERROR","ERROR"`))).toBe(true);
  for (const id of fixture.warningRuleIds) expect(csv.some(row => row.includes(`"${id}","WARNING","WARNING"`))).toBe(true);
});
