import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { FORMAT_PACKS, formatPackReleaseErrors } from "../src/format-packs";
import { provenanceFor } from "../src/coverage";
import { syntheticSample } from "../src/samples";
import { validateSource } from "../src/validation";
import { isoPack } from "./helpers";
import snapshots from "../docs/coverage/ruleset-2.0.0.json";
import ediSnapshots from "../docs/coverage/edi-ruleset-2.1.0.json";
import fixtures from "./fixtures/synthetic-provenance.json";
import updatedFixtures from "./fixtures/edi-2.1.0-provenance.json";
it("keeps each published versioned coverage snapshot equivalent to runtime", () => {
  expect(FORMAT_PACKS.filter(pack => pack.parserKind === "ISO_XML").map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; })).toEqual(snapshots.filter(pack => pack.profileId.startsWith("pain-")));
  expect(FORMAT_PACKS.filter(pack => pack.parserKind === "EDI_X12").map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; })).toEqual(ediSnapshots);
});
it("never passes a sample with promised checks left unevaluated", () => {
  for (const pack of FORMAT_PACKS) {
    const run = validateSource("synthetic", syntheticSample(pack, false), pack);
    expect(run.checks?.length).toBe(run.provenance?.coverage.length);
    if (pack.id === "edi-820-008030") {
      expect(run.executionStatus).toBe("UNSUPPORTED");
      expect(run.verdict).toBeNull();
      expect(run.checks?.find(check => check.ruleId === "edi.version")?.state).toBe("not-evaluated");
    } else {
      expect(run.checks?.every(check => check.state === "passed" || check.state === "not-applicable")).toBe(true);
    }
  }
});
it("pins synthetic evidence and rejects production approval without exact revisions", () => {
  for (const fixture of fixtures) {
    const updated = updatedFixtures.find(entry => entry.path === fixture.path);
    if (updated) expect(updated.previousSha256).toBe(fixture.sha256);
    expect(createHash("sha256").update(readFileSync(`${process.cwd()}/${fixture.path}`)).digest("hex")).toBe(updated?.sha256 ?? fixture.sha256);
  }
  const { releaseEvidence, ...unbound } = isoPack();
  expect(formatPackReleaseErrors(unbound)).toContain("revision-bound specification/ruleset/fixture/acceptance evidence");
});
