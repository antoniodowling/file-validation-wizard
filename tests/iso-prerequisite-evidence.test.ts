import { expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
it.each(FORMAT_PACKS.filter(p => p.parserKind === "ISO_XML"))("retains performed prerequisites for $id namespace mismatch", pack => {
  const run = validateSource("synthetic.xml", '<Document xmlns="urn:wrong"/>', pack);
  expect(run.verdict).toBe("FAIL");
  expect(run.results.map(r => [r.ruleId, r.outcome])).toEqual([
    ["iso.safe-declarations", "PASS"], ["iso.well-formed", "PASS"],
    ["iso.document-root", "PASS"], ["iso.namespace-version", "ERROR"]]);
  expect(run.results.map(r => r.ordinal)).toEqual([0, 1, 2, 3]);
  for (const ruleId of ["iso.safe-declarations", "iso.well-formed", "iso.document-root"]) {
    expect(run.checks?.find(c => c.ruleId === ruleId)?.state).toBe("passed");
  }
  for (const ruleId of ["iso.message-container", "iso.group-header", "iso.transaction-count-type", "demo.xml-declaration"]) {
    expect(run.checks?.find(c => c.ruleId === ruleId)?.state).toBe("not-evaluated");
  }
  expect(JSON.parse(validationRunToJson(run)).checks).toEqual(run.checks);
  expect(validationRunToCsv(run)).toContain('"iso.well-formed","PASS"');
});
