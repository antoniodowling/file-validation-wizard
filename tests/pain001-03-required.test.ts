import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { validateSource } from "../src/validation";

const pack = FORMAT_PACKS.find(item => item.id === "pain-001-03")!;
const baseline = readFileSync("tests/fixtures/pain001-03-schema-valid.xml", "utf8");
const run = (source: string) => validateSource("synthetic-v03.xml", source, pack);
const removeElement = (source: string, name: string): string => {
  const output = source.replace(new RegExp("\\s*<" + name + ">[\\s\\S]*?<\\/" + name + ">"), "");
  if (output === source) throw new Error("Fixture lacks " + name);
  return output;
};
const check = (source: string, id: string) => run(source).results.find(result => result.ruleId === id);

describe("PAIN.001.001.03 required-content rules", () => {
  it("passes the original-XSD-positive fixture with all 21 checks and no demo checks", () => {
    const actual = run(baseline);
    expect(actual.overallStatus).toBe("PASS");
    expect(actual.results).toHaveLength(21);
    expect(actual.results.every(item => item.outcome === "PASS")).toBe(true);
    expect(actual.results.some(item => item.ruleId.startsWith("demo."))).toBe(false);
  });

  it.each([
    ["CreDtTm", "iso.creation-date-time"],
    ["InitgPty", "iso.initiating-party"],
  ])("rejects absent group-header %s and locates its parent context", (element, id) => {
    const source = removeElement(baseline, element);
    expect(check(source, id)?.outcome).toBe("ERROR");
    const location = check(source, id)?.location;
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.primary.kind).toBe("context");
      expect(source.slice(location.primary.span.start, location.primary.span.end)).toContain("<GrpHdr>");
    }
  });

  it.each([
    ["PmtInfId", "iso.payment-information-id"],
    ["PmtMtd", "iso.payment-method"],
    ["ReqdExctnDt", "iso.requested-execution-date"],
    ["Dbtr", "iso.debtor"],
    ["DbtrAcct", "iso.debtor-account"],
    ["DbtrAgt", "iso.debtor-agent"],
    ["CdtTrfTxInf", "iso.credit-transfer-transactions"],
  ])("rejects absent payment-information %s", (element, id) => {
    expect(check(removeElement(baseline, element), id)?.outcome).toBe("ERROR");
  });

  it("rejects an otherwise well-formed empty PmtInf, without claiming transaction completeness", () => {
    const source = baseline.replace(/<PmtInf>[\s\S]*?<\/PmtInf>/, "<PmtInf/>");
    const actual = run(source);
    expect(actual.overallStatus).toBe("FAIL");
    for (const id of ["iso.payment-information-id", "iso.payment-method",
      "iso.requested-execution-date", "iso.debtor", "iso.debtor-account",
      "iso.debtor-agent", "iso.credit-transfer-transactions"]) {
      expect(actual.results.find(item => item.ruleId === id)?.outcome, id).toBe("ERROR");
    }
    expect(actual.checks.find(c => c.ruleId === "iso.transaction-count-reconciliation")?.state)
      .toBe("not-evaluated");
  });

  it("requires debtor-account identification choice and debtor-agent institution", () => {
    expect(check(baseline.replace(/<DbtrAcct>[\s\S]*?<\/DbtrAcct>/, "<DbtrAcct/>"),
      "iso.debtor-account")?.outcome).toBe("ERROR");
    expect(check(baseline.replace(/<DbtrAgt>[\s\S]*?<\/DbtrAgt>/, "<DbtrAgt/>"),
      "iso.debtor-agent")?.outcome).toBe("ERROR");
  });

  it.each([
    ["transaction identification", "<EndToEndId>E2E-001</EndToEndId>", "", "iso.credit-transfer-identification"],
    ["transaction amount", '<InstdAmt Ccy="USD">1.00</InstdAmt>', "", "iso.credit-transfer-amount"],
    ["transaction currency", ' Ccy="USD"', "", "iso.credit-transfer-amount"],
    ["overlong EndToEndId", "E2E-001", "X".repeat(36), "iso.credit-transfer-identification"],
    ["invalid payment method", "<PmtMtd>TRF</PmtMtd>", "<PmtMtd>INVALID</PmtMtd>", "iso.payment-method"],
  ])("rejects invalid %s", (_name, from, to, id) => {
    expect(check(baseline.replace(from, to), id)?.outcome).toBe("ERROR");
  });

  it("reconciles transactions rather than merely testing that NbOfTxs contains digits", () => {
    const wrong = baseline.replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>2</NbOfTxs>");
    expect(check(wrong, "iso.transaction-count-type")?.outcome).toBe("PASS");
    expect(check(wrong, "iso.transaction-count-reconciliation")?.outcome).toBe("ERROR");
    const leadingZero = run(baseline.replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>0001</NbOfTxs>"));
    expect(leadingZero.overallStatus).toBe("PASS");
    expect(leadingZero.results.find(item => item.ruleId === "iso.transaction-count-reconciliation")?.outcome)
      .toBe("PASS");
  });

  it("counts across multiple PmtInf blocks", () => {
    const block = baseline.match(/<PmtInf>[\s\S]*?<\/PmtInf>/)?.[0]!;
    const source = baseline.replace(block, block + block)
      .replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>2</NbOfTxs>");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it("does not claim a dependent PASS when one block lacks a transaction", () => {
    const block = baseline.match(/<PmtInf>[\s\S]*?<\/PmtInf>/)?.[0]!;
    const source = baseline.replace(block, block + removeElement(block, "CdtTrfTxInf"))
      .replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>2</NbOfTxs>");
    const actual = run(source);
    expect(actual.results.find(item => item.ruleId === "iso.credit-transfer-transactions")?.outcome).toBe("ERROR");
    for (const id of ["iso.credit-transfer-identification", "iso.credit-transfer-amount",
      "iso.transaction-count-reconciliation"]) {
      expect(actual.checks.find(c => c.ruleId === id)?.state).toBe("not-evaluated");
    }
  });

  it("does not invent required creditor fields or optional control sums", () => {
    const source = removeElement(removeElement(baseline, "Cdtr"), "CdtrAcct");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it("rejects a different namespace pretending to supply a required field", () => {
    const source = baseline.replace("<CreDtTm>", '<CreDtTm xmlns="urn:foreign">');
    expect(check(source, "iso.creation-date-time")?.outcome).toBe("ERROR");
  });

  it("diagnoses empty XML without the unreachable demo.non-empty-source rule", () => {
    const actual = run("   ");
    expect(actual.overallStatus).toBe("FAIL");
    expect(actual.results.some(item => item.ruleId.startsWith("demo."))).toBe(false);
    expect(actual.results.find(item => item.ruleId === "iso.well-formed")?.message)
      .toBe("The selected XML file is empty.");
  });
});
