import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAI2_PACK } from "../src/format-packs";
import { BAI2_DETAIL_CODES, BAI2_SUMMARY_CODES } from "../src/bai2-codes";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { ResourceLimitError } from "../src/resource-policy";
import { parseBai2 } from "../src/parsers/bai2";
import { provenanceFor } from "../src/coverage";
import coverageSnapshot from "../docs/coverage/bai2-candidate-1.0.0.json";

const fixture = (name: string): string => readFileSync(`demo-files/bai2/${name}`, "utf8");
const pass = (): string => fixture("balances-pass.bai2");
const run = (source: string) => validateSource("synthetic.bai2", source, BAI2_PACK);
const fails = (source: string, id: string) => {
  const report = run(source);
  expect(report.overallStatus).toBe("FAIL");
  expect(report.results.some(r => r.ruleId === `bai2.${id}` && r.outcome === "ERROR")).toBe(true);
  return report;
};

describe("Huntington BAI2 candidate", () => {
  const manifest = JSON.parse(fixture("manifest.json"));
  for (const entry of manifest.fixtures) it(`validates frozen fixture ${entry.file}`, () => {
    const source = fixture(entry.file);
    expect(createHash("sha256").update(source).digest("hex")).toBe(entry.sha256);
    const report = run(source);
    expect(report.overallStatus, report.executionReason ?? JSON.stringify(report.results.filter(r => r.outcome !== "PASS"))).toBe(entry.expected);
    for (const id of entry.rules) expect(report.results.some(r => r.ruleId === id && r.outcome === "ERROR")).toBe(true);
    expect(report.provenance?.schemaVersion).toBe("3");
    expect(report.provenance?.mode).toBe("CANDIDATE");
    expect(report.checks?.length).toBe(report.provenance?.coverage.length);
    for (const result of report.results) {
      expect(report.provenance?.coverage.some(rule => rule.id === result.ruleId)).toBe(true);
      if (result.location?.kind === "located") {
        for (const target of [result.location.primary, ...result.location.related]) {
          expect(target.span.start).toBeGreaterThanOrEqual(0);
          expect(target.span.end).toBeGreaterThan(target.span.start);
          expect(target.span.end).toBeLessThanOrEqual(source.length);
        }
      }
    }
    if (entry.expected === "UNSUPPORTED") {
      expect(report.verdict).toBeNull(); expect(report.results).toEqual([]);
      expect(report.checks?.every(check => check.state === "not-evaluated")).toBe(true);
    }
  });

  it("reconciles the guide's four account totals without netting debit/credit", () => {
    const report = run(fixture("huntington-guide-sample.txt"));
    expect(report.overallStatus).toBe("PASS");
    expect(report.results.filter(r => r.ruleId === "bai2.account-total")).toHaveLength(4);
    expect(report.results.filter(r => r.ruleId === "bai2.account-count")).toHaveLength(4);
    expect(report.results.filter(r => r.ruleId === "bai2.file-count")[0]?.outcome).toBe("PASS");
  });

  it.each(["\n", "\r\n", "\r"])("preserves separator %j with and without a final separator", separator => {
    const source = pass().trimEnd().replaceAll("\n", separator);
    expect(run(source).overallStatus).toBe("PASS");
    expect(run(source + separator).overallStatus).toBe("PASS");
    fails(source + separator + separator, "framing");
  });

  it("assembles field-boundary continuations after every logical record, including trailers", () => {
    // Independent, hand-counted document: 12 physical records; account 4 and group 8.
    const source = ["01,SYNTHETIC,", "88,SYNTHETIC,261014,1200,1,,,2/"].join("/\n") + "\n" + [
      "02,,SYNTHETIC,1,", "88,261013,,USD,2/", "03,123456,USD,010,", "88,100,0,",
      "49,100,", "88,4/", "98,100,1,", "88,8/", "99,100,1,", "88,12/",
    ].map(line => line.endsWith("/") ? line : line + "/").join("\n");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it("supports chained 88 summary continuation and opaque transaction text", () => {
    const source = pass().replace("88,100,50,0,,400,10,0,/", "88,100,50,0,/\n88,400,10,0,/")
      .replace("SYNTHETIC debit/", "SYNTHETIC debit/\n88,more / text, commas <img src=SYNTHETIC>/\n88,even more text/")
      .replace("49,370,5/", "49,370,8/").replace("98,370,1,7/", "98,370,1,10/").replace("99,370,1,9/", "99,370,1,12/");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it("supports a 16 prefix carried into 88 before its text field", () => {
    const source = pass().replace("16,206,50,,", "16,206,50,/\n88,,").replace("49,370,5/", "49,370,6/")
      .replace("98,370,1,7/", "98,370,1,8/").replace("99,370,1,9/", "99,370,1,10/");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it("locates malformed amount fields on the original continuation line", () => {
    const source = pass().replace("88,100,50,", "88,100,5.0,");
    const report = fails(source, "amount");
    const location = report.results.find(r => r.ruleId === "bai2.amount" && r.outcome === "ERROR")?.location;
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") expect(source.slice(location.primary.span.start, location.primary.span.end)).toBe("5.0");
    expect(report.checks?.find(c => c.ruleId === "bai2.account-total")?.state).toBe("not-evaluated");
  });

  it("keeps exact arithmetic above Number.MAX_SAFE_INTEGER", () => {
    const source = fixture("multi-group-pass.bai2");
    expect(run(source).overallStatus).toBe("PASS");
    fails(source.replace("900719925474099312615", "900719925474099312616"), "account-total");
  });

  it("admits omitted optional summaries/details without inventing required fields", () => {
    const source = "01,SYNTHETIC,SYNTHETIC,261014,0000,XYZ,,,2/\n02,,SYNTHETIC,1,261013/\n03,123456,USD/\n49,0,2/\n98,0,1,4/\n99,0,1,6/";
    const report = run(source);
    expect(report.overallStatus).toBe("PASS");
    expect(run(source.replace("03,123456,USD/", "03,123456/")).overallStatus).toBe("PASS");
    for (const id of ["summary-code", "summary-fields", "detail-code"]) expect(report.checks?.find(c => c.ruleId === `bai2.${id}`)?.state).toBe("not-applicable");
  });
  it("assembles an account currency carried to a continuation", () => {
    const source = pass().replace("03,123456789,USD,", "03,123456789,/\n88,USD,")
      .replace("49,370,5/", "49,370,6/").replace("98,370,1,7/", "98,370,1,8/").replace("99,370,1,9/", "99,370,1,10/");
    expect(run(source).overallStatus).toBe("PASS");
  });

  it.each(["2401", "2360", "2500", "120", "12:00"])("rejects invalid time %s", text => { fails(pass().replace("2400", text), "file-header"); });
  it.each(["260230", "261332", "260000"])("rejects invalid date %s", text => { fails(pass().replace("261014", text), "file-header"); });
  it("rejects malformed fields and nesting and suppresses dependent checks", () => {
    fails(pass().replace("USD,2/", "USD,2,extra/"), "layout");
    fails(pass().replace("USD,2/", "USD,2/\n16,206,1/"), "hierarchy");
    fails("88,100/\n" + pass(), "continuation");
    fails(pass() + "01,extra/", "hierarchy");
    fails(pass().replace("99,370,1,9/\n", ""), "hierarchy");
    fails(pass().replace("010,100,0,", "010,100,1,"), "summary-fields");
    const report = fails(pass().replace("49,370,5/", "49,370,abc/"), "trailer-fields");
    expect(report.checks?.find(c => c.ruleId === "bai2.account-count")?.state).toBe("not-evaluated");
  });
  it.each(["", "\n", "\t"])("fails malformed source %j", text => expect(run(text).overallStatus).toBe("FAIL"));

  it.each([
    (s: string) => s.replace("1,,,2/", "1,,,3/"),
    (s: string) => s.replace("1,,,2/", "1,80,1,2/"),
    (s: string) => s.replace("03,", "04,"),
    (s: string) => s.replace("015,150,0,/", "015,150,0,S/"),
  ])("gives no verdict for unqualified layout %j", mutate => {
    const report = run(mutate(pass())); expect(report.overallStatus).toBe("UNSUPPORTED"); expect(report.verdict).toBeNull();
  });
  it("does not guess a scalar split continuation", () => {
    expect(run(pass().replace("015,150,0,/", "015,15/\n88,0,0,/" )).overallStatus).toBe("UNSUPPORTED");
  });

  it("freezes the common/table code union and checks levels", () => {
    expect(BAI2_SUMMARY_CODES.has("040")).toBe(true); expect(BAI2_SUMMARY_CODES.has("060")).toBe(true);
    expect(BAI2_DETAIL_CODES.has("136")).toBe(true); expect(BAI2_DETAIL_CODES.has("728")).toBe(true);
    fails(pass().replace("010,100,", "206,100,"), "summary-code");
  });
  it("enforces profile and allocation bounds", () => {
    expect(() => parseBai2(pass(), { ...BAI2_PACK, id: "other" })).toThrow();
    expect(() => run("01," + ",".repeat(100001) + "/")).toThrow(ResourceLimitError);
    expect(() => run("01," + "A".repeat(1000001) + "/")).toThrow(ResourceLimitError);
    expect(() => run("88,x/\n".repeat(100001))).not.toThrow(); // Stops on invalid ownership immediately.
  });

  it("worker retains a BOM for rejection and rejects invalid UTF-8 before parsing", () => {
    const request = (bytes: Uint8Array) => validateWorkerRequest({ type: "validate", packId: BAI2_PACK.id, fileName: "synthetic.bai2", bytes: bytes.buffer as ArrayBuffer, includeExplorer: true, snapshotId: 7 });
    const response = request(new TextEncoder().encode(pass()));
    expect(response.type).toBe("complete");
    if (response.type === "complete") { expect(response.run.overallStatus).toBe("PASS"); expect(response.source).toBe(pass()); }
    const bom = request(new TextEncoder().encode("\uFEFF" + pass()));
    if (bom.type === "complete") expect(bom.run.overallStatus).toBe("FAIL"); else throw new Error("Expected completed BOM rejection");
    expect(request(new Uint8Array([0xff]))).toEqual({ type: "error", code: "INVALID_ENCODING" });
  });
  it("exports version-bound coverage, unsupported state and formula-neutralized filenames", () => {
    const report = validateSource("=SYNTHETIC.bai2", pass(), BAI2_PACK);
    expect(validationRunToCsv(report)).toContain("'=SYNTHETIC.bai2");
    const json = JSON.parse(validationRunToJson(report));
    expect(json.exportSchemaVersion).toBe("3"); expect(json.provenance.rulesetRevision).toBe("huntington-bai2-candidate-1.0.0");
    expect(json.provenance.exclusions.join(" ")).toContain("CSV conversion");
    expect(JSON.parse(validationRunToJson(run(fixture("funds-unsupported.bai2")))).verdict).toBeNull();
  });
  it("binds the new coverage snapshot without rewriting historical revisions", () => {
    const { buildRevision, ...snapshot } = provenanceFor(BAI2_PACK);
    expect([snapshot]).toEqual(coverageSnapshot);
  });
});
