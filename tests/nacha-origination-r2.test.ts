import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FormatPack } from "../src/types";
import { EXPANDED_NACHA_PACK } from "../src/format-packs";
import { parseNacha, NACHA_ORIGINATION_R2_RULE_IDS } from "../src/parsers/nacha";
import { validateSource } from "../src/validation";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { HUNTINGTON_NACHA_BATCH_NUMBER_URL } from "../src/nacha-batch-guidance";
import { originationR2CoverageFor } from "../src/nacha-origination-r2-coverage";
import { expandedNachaCoverageFor } from "../src/nacha-expanded-coverage";
import { buildNacha, field } from "./nacha-builder";
const pack = { ...EXPANDED_NACHA_PACK, id: "nacha-origination-expanded-public-2026-r2", identifiers: { ...EXPANDED_NACHA_PACK.identifiers, profile: "origination-expanded-public-2026-r2" } } as unknown as FormatPack;
const source = (sec = "CCD", code = "22", description = "HCCLAIMPMT", payload: string | null = "TRN*1*TRACE*COMPANY~") => {
  const rows = buildNacha([{ sec, codes: [code], amounts: [code === "23" ? 0n : 12345n], addenda: [payload === null ? 0 : 1], ...(code === "23" ? { service: "220" } : {}) }]);
  rows[1] = field(rows[1]!, 54, 63, description.padEnd(10));
  if (payload !== null) rows[3] = field(rows[3]!, 4, 83, payload.padEnd(80));
  return rows.join("\n");
};
const state = (text: string, id: string) => parseNacha(text, pack).results.find(result => result.ruleId === `nacha.${id}`)?.outcome;
const numberedBatches = (numbers: string[]): string => {
  const rows = buildNacha(numbers.map(() => ({})));
  let batchIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.[0] === "5") rows[i] = field(rows[i]!, 88, 94, numbers[batchIndex]!);
    if (rows[i]?.[0] === "8") {
      rows[i] = field(rows[i]!, 88, 94, numbers[batchIndex]!);
      batchIndex += 1;
    }
  }
  return rows.join("\n");
};
describe("origination r2 declarations", () => {
  it("inherits frozen r1 coverage except for R2's documented zero-first-batch advisory", () => {
    const coverage = originationR2CoverageFor(pack);
    const inherited = expandedNachaCoverageFor(pack);
    expect(coverage.slice(0, -4).filter(rule => rule.id !== "nacha.batch-number"))
      .toEqual(inherited.filter(rule => rule.id !== "nacha.batch-number"));
    const batch = coverage.find(rule => rule.id === "nacha.batch-number");
    expect(batch?.description).toContain("0000000");
    expect(batch?.description).toContain("WARNING");
    expect(batch?.description).toContain("ERROR");
    expect(batch?.reference).toContain(HUNTINGTON_NACHA_BATCH_NUMBER_URL);
    // Coverage uses the highest possible rule severity; a specific zero finding is advisory.
    expect(batch?.severity).toBe("ERROR");
    expect(coverage.map(rule => rule.id).filter(id => id !== "nacha.non-empty-source")).toEqual(NACHA_ORIGINATION_R2_RULE_IDS);
  });
  it("warns on a first zero batch but preserves strict sequencing and mirrored controls", () => {
    const input = numberedBatches(["0000000", "0000001", "0000002"]);
    const run = validateSource("synthetic.ach", input, pack);
    expect(run.overallStatus).toBe("PASS_WITH_WARNINGS");
    expect(run.errorCount).toBe(0);
    expect(run.warningCount).toBe(1);
    const finding = run.results.find(rule => rule.ruleId === "nacha.batch-number");
    expect(finding?.outcome).toBe("WARNING");
    expect(finding?.severity).toBe("WARNING");
    expect(finding?.locator).toBe("Record 2 / Columns 88-94");
    expect(finding?.message).toContain("Huntington");
    expect(finding?.message).toContain("0000001");
    expect(finding?.message).toContain(HUNTINGTON_NACHA_BATCH_NUMBER_URL);
    expect(run.results.find(rule => rule.ruleId === "nacha.batch-mirror")?.outcome).toBe("PASS");
    expect(validationRunToJson(run)).toContain(HUNTINGTON_NACHA_BATCH_NUMBER_URL);
    expect(validationRunToCsv(run)).toContain(HUNTINGTON_NACHA_BATCH_NUMBER_URL);
    expect(state(numberedBatches(["0000001", "0000002"]), "batch-number")).toBe("PASS");
    for (const numbers of [
      ["0000000", "0000000"],
      ["0000000", "0000002", "0000001"],
      ["0000001", "0000000"],
      ["INVALID"],
    ]) expect(state(numberedBatches(numbers), "batch-number"), numbers.join(",")).toBe("ERROR");
    const legacy = parseNacha(numberedBatches(["0000000"]), EXPANDED_NACHA_PACK);
    expect(legacy.results.find(rule => rule.ruleId === "nacha.batch-number")?.outcome).toBe("ERROR");
  });
  it("accepts declared healthcare CCD with a whole TRN and preserves payload padding", () => {
    const text = source();
    expect(text.split("\n")[3]!.slice(3, 83)).toBe("TRN*1*TRACE*COMPANY~".padEnd(80));
    expect(parseNacha(text, pack).results.every(result => result.outcome === "PASS")).toBe(true);
    expect(state(text, "healthcare-trn")).toBe("PASS");
    expect(state(source("CCD", "22", "HCCLAIMPMT", "TRN*1*TRACE*COMPANY*EXTRA~"), "healthcare-trn")).toBe("PASS");
  });
  it("requires live healthcare addenda, while prenotes need neither addenda nor TRN", () => {
    expect(state(source("CCD", "22", "HCCLAIMPMT", null), "healthcare-addenda")).toBe("ERROR");
    const prenote = parseNacha(source("CCD", "23", "HCCLAIMPMT", null), pack);
    expect(prenote.results.every(result => result.outcome === "PASS")).toBe(true);
    expect(prenote.notApplicable).toContain("nacha.healthcare-addenda");
    expect(prenote.notApplicable).toContain("nacha.healthcare-trn");
  });
  it("rejects malformed or extra TRN segments without treating them as a full 835", () => {
    for (const payload of ["TRN*1*TRACE*COMPANY", "TRN*1**COMPANY~", "TRN*1*TRACE*~", "TRN*1* *COMPANY~", "TRN*2*TRACE*COMPANY~", "trn*1*TRACE*COMPANY~", "TRN*1*TRACE*COMPANY~NTE*X~"])
      expect(state(source("CCD", "22", "HCCLAIMPMT", payload), "healthcare-trn"), payload).toBe("ERROR");
  });
  it("checks uppercase standardized fields and admits discretionary uppercase payroll suffixes", () => {
    for (const [sec, code, description] of [["PPD", "22", "payroll"], ["WEB", "27", "purchase"], ["CCD", "22", "hcclaimpmt"], ["CCD", "22", "reversal"]])
      expect(state(source(sec, code, description, null), "description-case")).toBe("ERROR");
    for (const description of ["PAYROLL", "PAYROLL424", "PAYROLLEMP"])
      expect(state(source("PPD", "22", description, null), "description-case")).toBe("PASS");
    for (const description of ["acctverify", "retry pymt", "return fee", "reclaim", "nonsettled", "autoenroll", "redepcheck", "no check"])
      expect(state(source("CCD", "22", description, null), "description-case")).toBe("ERROR");
    expect(state(source("PPD", "22", "PAYROLLemp", null), "description-case")).toBe("ERROR");
    expect(state(source("PPD", "22", "XXPAYROLL", null), "description-case")).toBe("ERROR");
    expect(parseNacha(source("CCD", "22", "Gas bill", null), pack).notApplicable).toContain("nacha.description-case");
  });
  it("checks declared SEC/direction without claiming purpose or TEL authorization", () => {
    for (const [sec, code, description] of [["CCD", "22", "PAYROLL"], ["PPD", "27", "PAYROLL"], ["PPD", "27", "PURCHASE"], ["WEB", "22", "PURCHASE"], ["PPD", "22", "HCCLAIMPMT"]])
      expect(state(source(sec, code, description, null), "description-sec")).toBe("ERROR");
    for (const sec of ["WEB", "TEL"]) expect(state(source(sec, "27", "PURCHASE", null), "description-sec")).toBe("PASS");
  });
  it("suppresses TRN evaluation on unknown transaction/addenda prerequisites", () => {
    const rows = source().split("\n"); rows[3] = field(rows[3]!, 2, 3, "99");
    const result = parseNacha(rows.join("\n"), pack);
    expect(result.results.some(rule => rule.ruleId === "nacha.healthcare-trn")).toBe(false);
    expect(result.notApplicable).not.toContain("nacha.healthcare-trn");
    const unknown = source().split("\n"); unknown[2] = field(unknown[2]!, 2, 3, "99");
    const unknownResult = parseNacha(unknown.join("\n"), pack);
    for (const id of ["healthcare-addenda", "healthcare-trn"]) {
      expect(unknownResult.results.some(rule => rule.ruleId === `nacha.${id}`)).toBe(false);
      expect(unknownResult.notApplicable).not.toContain(`nacha.${id}`);
    }
    const badIndicator = source().split("\n"); badIndicator[2] = field(badIndicator[2]!, 79, 79, "0");
    expect(state(badIndicator.join("\n"), "healthcare-addenda")).toBe("ERROR");
  });
  it("preserves r1 descriptors and source-gated payload/account behavior", () => {
    expect(parseNacha(source("CCD", "22", "HCCLAIMPMT", null), EXPANDED_NACHA_PACK).results.some(rule => rule.ruleId === "nacha.healthcare-addenda")).toBe(false);
    for (const name of ["ctx-edifact-unsupported", "web-loan-unsupported"])
      expect(() => parseNacha(readFileSync(`demo-files/nacha-expanded/${name}.ach`, "utf8"), pack)).toThrow(/source|qualif/i);
  });
});

it("preserves healthcare occurrences while marking unknown prerequisites incomplete", () => {
  const rows = buildNacha([{ sec: "CCD", codes: ["22", "99"], amounts: [1n, 1n], addenda: [1, 1] }]);
  rows[1] = field(rows[1]!, 54, 63, "HCCLAIMPMT");
  rows[3] = field(rows[3]!, 4, 83, "TRN*1*TRACE*COMPANY~".padEnd(80));
  rows[5] = field(rows[5]!, 4, 83, "TRN*1*TRACE*COMPANY~".padEnd(80));
  const output = parseNacha(rows.join("\n"), pack);
  for (const id of ["healthcare-addenda", "healthcare-trn"]) {
    expect(output.results.some(result => result.ruleId === `nacha.${id}` && result.outcome === "PASS")).toBe(true);
    expect(output.incompleteChecks?.some(check => check.ruleId === `nacha.${id}` && check.reason.length > 0)).toBe(true);
    expect(output.notApplicable).not.toContain(`nacha.${id}`);
  }
});
