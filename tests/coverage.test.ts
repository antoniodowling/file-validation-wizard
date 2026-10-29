import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { FORMAT_PACKS, formatPackReleaseErrors } from "../src/format-packs";
import { provenanceFor } from "../src/coverage";
import { syntheticSample } from "../src/samples";
import { validateSource } from "../src/validation";
import { isoPack } from "./helpers";
import snapshots from "../docs/coverage/ruleset-2.1.0.json";
import fixtures from "./fixtures/synthetic-provenance-2.1.0.json";
it("keeps each published versioned coverage snapshot equivalent to runtime", () => {
  expect(FORMAT_PACKS.filter(pack => pack.mode === "DEMO").map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; })).toEqual(snapshots);
});
it("never passes a sample with promised checks left unevaluated", () => {
  for (const pack of FORMAT_PACKS) {
    const run = validateSource("synthetic", syntheticSample(pack, false), pack);
    expect(run.checks?.length).toBe(run.provenance?.coverage.length);
    expect(run.checks?.every(check => check.state === "passed" || check.state === "not-applicable")).toBe(true);
  }
});
it("pins synthetic evidence and rejects production approval without exact revisions", () => {
  for (const fixture of fixtures) expect(createHash("sha256").update(readFileSync(`${process.cwd()}/${fixture.path}`)).digest("hex")).toBe(fixture.sha256);
  const { releaseEvidence, ...unbound } = isoPack();
  expect(formatPackReleaseErrors(unbound)).toContain("revision-bound specification/ruleset/fixture/acceptance evidence");
});

it("keeps EDI on its historical revision while advancing ISO", () => {
  for (const pack of FORMAT_PACKS.filter(p => p.mode === "DEMO")) {
    expect(provenanceFor(pack).rulesetRevision).toBe(pack.parserKind === "ISO_XML" ? "2.1.0" : "2.0.0");
  }
});
