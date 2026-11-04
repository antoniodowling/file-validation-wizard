import { describe, expect, it } from "vitest";
import { FORMAT_CATALOG } from "../src/format-catalog";
import { FORMAT_PACKS } from "../src/format-packs";
import { syntheticSample } from "../src/samples";
import { validateSource } from "../src/validation";
import { validationRunToCsv, validationRunToJson } from "../src/csv";

// The baseline intentionally normalizes only the build revision: the refactor
// changes the bundle revision but must preserve all runtime evidence and exports.
describe("format-pack refactor baseline", () => {
  it("preserves the ordered catalog and profile metadata", () => {
    expect(FORMAT_CATALOG).toMatchSnapshot();
    expect(FORMAT_PACKS.map(({ rules, ...pack }) => ({ ...pack, rules: rules.map(({ evaluate, ...rule }) => rule) }))).toMatchSnapshot();
  });

  for (const pack of FORMAT_PACKS) {
    for (const fail of [false, true]) {
      it(`${pack.id}: ${fail ? "failing" : "passing"} synthetic sample`, () => {
        const run = validateSource("synthetic.txt", syntheticSample(pack, fail), pack);
        const normalized = { ...run, provenance: { ...run.provenance!, buildRevision: "<build-revision>" } };
        expect({ run: normalized, json: validationRunToJson(normalized), csv: validationRunToCsv(normalized) }).toMatchSnapshot();
      });
    }
  }
});
