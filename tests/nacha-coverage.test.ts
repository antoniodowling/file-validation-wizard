import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { FormatPack, ValidationRule } from "../src/types";
import { coverageFor, provenanceFor, RULESET_REVISION, EXCLUSIONS } from "../src/coverage";
import { NACHA_RULE_IDS } from "../src/parsers/nacha";
import { NACHA_EXCLUSIONS, NACHA_RULESET_REVISION } from "../src/nacha-coverage";
import { FORMAT_PACKS } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import nachaSnapshots from "../docs/coverage/nacha-public-1.0.0.json";
import snapshots from "../docs/coverage/ruleset-2.0.0.json";

const nonEmpty: ValidationRule = {
  id: "nacha.non-empty-source", description: "The selected file contains data.", field: "File content", defaultLocator: "file",
  evaluate: context => ({ outcome: context.source.trim() ? "PASS" : "ERROR" }),
};
// Fixture profile isolates coverage from registration/release approval policy.
const pack = {
  id: "nacha-origination-public-2026", family: "NACHA", label: "NACHA public-source candidate",
  version: "origination-public-2026", parserKind: "NACHA_FIXED", mode: "CANDIDATE",
  extensions: [".ach"], guideUrl: null, enabled: true,
  identifiers: { kind: "NACHA_FIXED", profile: "origination-public-2026", secCodes: ["CCD", "PPD", "CTX", "WEB", "TEL"] },
  approval: { product: false, sc: false, ft: false, rulesApproved: false, fixturesApproved: false }, rules: [nonEmpty],
} as unknown as FormatPack;

it("declares precisely the 42 parser checks and configured source check, without EDI/ISO coverage", () => {
  const coverage = coverageFor(pack);
  expect(NACHA_RULE_IDS).toHaveLength(42);
  expect(coverage.map(rule => rule.id)).toEqual([...NACHA_RULE_IDS, nonEmpty.id]);
  expect(coverage).toHaveLength(43);
  for (const rule of coverage) {
    expect(rule.id.startsWith("nacha.")).toBe(true);
    expect(rule.description).not.toBe(rule.id);
    expect(rule.description.length).toBeGreaterThan(20);
    expect(rule.reference).toContain("docs/NACHA_SOURCE_REVIEW.md");
    expect(rule.reference).toContain("revision 02/2024");
    expect(rule.evidence).toContain("synthetic local evidence");
  }
});
it("deduplicates parser and configured rule IDs", () => {
  const duplicate = { ...nonEmpty, id: NACHA_RULE_IDS[0]! };
  expect(coverageFor({ ...pack, rules: [nonEmpty, nonEmpty, duplicate] }).map(rule => rule.id))
    .toEqual([...NACHA_RULE_IDS, nonEmpty.id]);
});
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
it("keeps candidate/public-source provenance and negative claims distinct from legacy revision", () => {
  const provenance = provenanceFor(pack);
  expect(provenance.mode).toBe("CANDIDATE");
  expect(provenance.rulesetRevision).toBe(NACHA_RULESET_REVISION);
  expect(provenance.coverageRevision).toBe(`${pack.id}@nacha-public-1.0.0`);
  expect(provenance.implementationGuideRevision).toContain("Public sources reviewed 2026-10-14");
  expect(provenance.implementationGuideRevision).toContain("full current Operating Rules comparison deferred");
  expect(provenance.exclusions).toEqual(NACHA_EXCLUSIONS);
  const exclusions = provenance.exclusions.join(" ");
  for (const boundary of ["No production approval", "authorization", "routing-directory membership", "holiday calendar", "transmission cutoff", "MAC authentication", "remittance content", "cross-file"]) {
    expect(exclusions).toContain(boundary);
  }
  expect(Object.isFrozen(provenance)).toBe(true);
  expect(RULESET_REVISION).toBe("2.0.0");
  expect(EXCLUSIONS[0]).toContain("DEMO checks only");
});
it("preserves frozen legacy provenance snapshots verbatim", () => {
  const legacy = FORMAT_PACKS.filter(profile => profile.parserKind !== "NACHA_FIXED");
  expect(legacy.map(profile => { const { buildRevision, ...snapshot } = provenanceFor(profile); return snapshot; }))
    .toEqual(snapshots);
});

it("pins registered NACHA coverage and schema-2 candidate exports with authoritative field locations", () => {
  const registered = FORMAT_PACKS.find(profile => profile.parserKind === "NACHA_FIXED")!;
  const { buildRevision, ...snapshot } = provenanceFor(registered);
  expect([snapshot]).toEqual(nachaSnapshots);
  const source = readFileSync("demo-files/nacha/routing-check-digit-fail.ach", "utf8");
  const run = validateSource("synthetic.ach", source, registered);
  const routing = run.results.find(result => result.ruleId === "nacha.routing")!;
  expect(routing.location?.kind).toBe("located");
  if (routing.location?.kind === "located") {
    expect(source.slice(routing.location.primary.span.start, routing.location.primary.span.end)).toHaveLength(9);
  }
  const json = JSON.parse(validationRunToJson(run));
  expect(json.exportSchemaVersion).toBe("2");
  expect(json.provenance.mode).toBe("CANDIDATE");
  expect(json.provenance.rulesetRevision).toBe(NACHA_RULESET_REVISION);
  expect(json.results.find((result: {ruleId: string}) => result.ruleId === "nacha.routing").location).toEqual(routing.location);
  const csv = validationRunToCsv(run);
  expect(csv).toContain('"CANDIDATE"');
  expect(csv).toContain(NACHA_RULESET_REVISION);
  expect(csv).toContain('""kind"":""located""');
});
it("distinguishes optional absent checks from checks suppressed by malformed prerequisites", () => {
  const registered = FORMAT_PACKS.find(profile => profile.parserKind === "NACHA_FIXED")!;
  const pass = validateSource("synthetic.ach", readFileSync("demo-files/nacha/sparse-no-addenda-pass.ach", "utf8"), registered);
  expect(pass.checks?.find(check => check.ruleId === "nacha.addenda-type")?.state).toBe("not-applicable");
  expect(pass.checks?.find(check => check.ruleId === "nacha.web-credit-originator")?.state).toBe("not-applicable");
  expect(pass.checks?.some(check => check.state === "not-evaluated")).toBe(false);
  const fail = validateSource("malformed.ach", "1", registered);
  expect(fail.checks?.find(check => check.ruleId === "nacha.file-credit")?.state).toBe("not-evaluated");
  expect(fail.checks?.find(check => check.ruleId === "nacha.addenda-type")?.state).toBe("not-evaluated");
});
