import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { coverageFor, provenanceFor, RULESET_REVISION, EXCLUSIONS } from "../src/coverage";
import { NACHA_ORIGINATION_R2_EXCLUSIONS, NACHA_ORIGINATION_R2_REVISION } from "../src/nacha-origination-r2-coverage";
import { FORMAT_PACKS, ORIGINATION_R2_PACK as pack } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { r2Snapshot } from "./current-coverage";
import { demoSnapshots as snapshots } from "./current-coverage";

it("records prerequisites, conditional applicability and actual warning/error semantics", () => {
  const rules = new Map(coverageFor(pack).map(rule => [rule.id, rule]));
  expect(rules.get("nacha.ascii")?.prerequisite).toBe("nacha.framing passed");
  expect(rules.get("nacha.blocking")?.prerequisite).not.toContain("record-order passed");
  expect(rules.get("nacha.batch-count")?.prerequisite).toContain("record-order passed");
  expect(rules.get("nacha.addenda-type")?.applicability).toContain("absent addenda are not applicable");
  expect(rules.get("nacha.addenda-indicator")?.applicability).toContain("without addenda");
  expect(rules.get("nacha.web-credit-originator")?.applicability).toContain("WEB debits are not applicable");
  expect(rules.get("nacha.effective-weekend")?.severity).toBe("WARNING");
  expect(rules.get("nacha.effective-weekend")?.prerequisite).toContain("valid date");
  expect(rules.get("nacha.settlement-date")?.severity).toBe("ERROR");
  expect(rules.get("nacha.settlement-date")?.description).toContain("Invalid syntax/range is ERROR");
  expect(rules.get("nacha.settlement-date")?.description).toContain("populated operator field generates WARNING");
  expect(rules.get("nacha.batch-debit")?.prerequisite).toContain("amounts numeric and transaction directions supported");
  expect(rules.get("nacha.file-credit")?.applicability).toContain("otherwise not evaluated");
});
it("keeps the R2 public-source provenance and scope exclusions", () => {
  const provenance = provenanceFor(pack);
  expect(provenance.mode).toBe("CANDIDATE");
  expect(provenance.rulesetRevision).toBe(NACHA_ORIGINATION_R2_REVISION);
  expect(provenance.coverageRevision).toBe(`${pack.id}@nacha-origination-public-2026-r2.2/report-4`);
  expect(provenance.implementationGuideRevision).toContain("excerpts reviewed 2026-10-14");
  expect(provenance.implementationGuideRevision).toContain("full Rules qualification deferred");
  expect(provenance.exclusions).toEqual(NACHA_ORIGINATION_R2_EXCLUSIONS);
  const exclusions = provenance.exclusions.join(" ");
  for (const boundary of ["production approval", "authorization", "routing-directory membership", "UN/EDIFACT", "MAC authentication", "complete X12", "cross-file"]) {
    expect(exclusions).toContain(boundary);
  }
  expect(Object.isFrozen(provenance)).toBe(true);
  expect(RULESET_REVISION).toBe("2.0.0");
  expect(EXCLUSIONS[0]).toContain("DEMO checks only");
});
it("preserves corrected ISO provenance while EDI uses its separate current snapshot", () => {
  const legacy = FORMAT_PACKS.filter(profile => profile.parserKind === "ISO_XML");
  expect(legacy.map(profile => { const { buildRevision, ...snapshot } = provenanceFor(profile); return snapshot; }))
    .toEqual(snapshots.filter(profile => profile.profileId.startsWith("pain-")));
});

it("pins registered NACHA coverage and schema-4 candidate exports with authoritative field locations", () => {
  const { buildRevision, ...snapshot } = provenanceFor(pack);
  expect(snapshot).toEqual(r2Snapshot);
  const source = readFileSync("demo-files/nacha/routing-check-digit-fail.ach", "utf8");
  const run = validateSource("synthetic.ach", source, pack);
  const routing = run.results.find(result => result.ruleId === "nacha.routing")!;
  expect(routing.location?.kind).toBe("located");
  if (routing.location?.kind === "located") {
    expect(source.slice(routing.location.primary.span.start, routing.location.primary.span.end)).toHaveLength(9);
  }
  const json = JSON.parse(validationRunToJson(run));
  expect(json.exportSchemaVersion).toBe("4");
  expect(json.provenance.mode).toBe("CANDIDATE");
  expect(json.provenance.rulesetRevision).toBe(NACHA_ORIGINATION_R2_REVISION);
  expect(json.results.find((result: {ruleId: string}) => result.ruleId === "nacha.routing").location).toEqual(routing.location);
  const csv = validationRunToCsv(run);
  expect(csv).toContain('"CANDIDATE"');
  expect(csv).toContain(NACHA_ORIGINATION_R2_REVISION);
  expect(csv).toContain('""kind"":""located""');
});
it("distinguishes optional absent checks from checks suppressed by malformed prerequisites", () => {
  const pass = validateSource("synthetic.ach", readFileSync("demo-files/nacha/sparse-no-addenda-pass.ach", "utf8"), pack);
  expect(pass.checks?.find(check => check.ruleId === "nacha.addenda-type")?.state).toBe("not-applicable");
  expect(pass.checks?.find(check => check.ruleId === "nacha.web-credit-originator")?.state).toBe("not-applicable");
  expect(pass.checks?.some(check => check.state === "not-evaluated")).toBe(false);
  const fail = validateSource("malformed.ach", "1", pack);
  expect(fail.checks?.find(check => check.ruleId === "nacha.file-credit")?.state).toBe("not-evaluated");
  expect(fail.checks?.find(check => check.ruleId === "nacha.addenda-type")?.state).toBe("not-evaluated");
});
