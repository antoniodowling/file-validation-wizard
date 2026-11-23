import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import origination from "../demo-files/nacha/manifest.json";
import expanded from "../demo-files/nacha-expanded/manifest.json";
import candidates from "../demo-files/ach-candidates/manifest.json";
import mixed from "../demo-files/mixed-findings/manifest.json";
import { NACHA_ORIGINATION_R2_RULE_IDS } from "../src/parsers/nacha";
import { ORIGINATION_R2_PACK } from "../src/format-packs";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { validateSource } from "../src/validation";

it("preserves the R2 JSON and CSV reports for the retained synthetic fixture kits", () => {
  const fixtures = [
    ...origination.fixtures.map(({ file }) => ["nacha", file] as const),
    ...expanded.fixtures.map(({ file }) => ["nacha-expanded", file] as const),
    ...candidates.filter(({ profileId }) => profileId === ORIGINATION_R2_PACK.id)
      .map(({ name }) => ["ach-candidates", name] as const),
    ...mixed.fixtures.filter(({ profileId }) => profileId === ORIGINATION_R2_PACK.id)
      .map(({ file }) => ["mixed-findings", file] as const),
  ];
  const json = createHash("sha256");
  const csv = createHash("sha256");
  const negativeFindings = new Set<string>();
  const statuses = new Map<string, number>();
  for (const [directory, name] of fixtures) {
    const source = readFileSync(`demo-files/${directory}/${name}`, "utf8");
    const run = validateSource(name, source, ORIGINATION_R2_PACK);
    statuses.set(run.overallStatus, (statuses.get(run.overallStatus) ?? 0) + 1);
    for (const result of run.results) if (result.outcome !== "PASS") negativeFindings.add(result.ruleId);
    const buildRevision = run.provenance!.buildRevision;
    json.update(validationRunToJson(run).replaceAll(buildRevision, "baseline-comparison"));
    csv.update(validationRunToCsv(run).replaceAll(buildRevision, "baseline-comparison"));
  }

  // Descriptor SEC errors are covered by the focused R2 parser tests.
  expect(NACHA_ORIGINATION_R2_RULE_IDS.filter(id => !negativeFindings.has(id))).toEqual(["nacha.description-sec"]);

  // Recorded at 181dd49a67b564f6b8a3468f519370b65ab5892b with the real R2 pack.
  // Normalize the source-dependent build revision. All other export bytes are pinned.
  expect(Object.fromEntries(statuses)).toEqual({ PASS: 106, FAIL: 124, PASS_WITH_WARNINGS: 4, UNSUPPORTED: 3 });
  expect(json.digest("hex"), "JSON report bytes").toBe("32b67b579ddee87db416a550d2b6ba490defcb2b93beaac8067a21178f7b32ec");
  expect(csv.digest("hex"), "CSV report bytes").toBe("f30a2bb5da64455e6c3f06fc3d85cac0e21d293ea04c99d86a8acf6ac8524d86");
});
