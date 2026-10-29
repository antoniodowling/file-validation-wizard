import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { ACK_PACK, BAI2_PACK, CSV_WIRE_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import type { RunProvenance, ValidationRun } from "../src/types";

// Independent CSV reader: quoted cells, doubled quotes, and embedded line breaks.
function rows(csv: string): string[][] {
  const result: string[][] = []; let row: string[] = []; let value = ""; let quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const ch = csv[i]!;
    if (ch === '"') {
      if (quoted && csv[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && ch === ',') { row.push(value); value = ""; }
    else if (!quoted && ch === '\r' && csv[i + 1] === '\n') {
      row.push(value); result.push(row); row = []; value = ""; i++;
    } else value += ch;
  }
  expect(quoted).toBe(false); expect(row).toEqual([]); expect(value).toBe("");
  return result;
}
const fixture = (path: string) => readFileSync(`demo-files/${path}`, "utf8");
const schema = (run: ValidationRun, version: string): ValidationRun => ({ ...run,
  provenance: { ...run.provenance!, schemaVersion: version as RunProvenance["schemaVersion"] } });
const baseHeaders = ["File Name", "Format", "Version", "Overall Result", "Rule ID", "Rule Result", "Severity", "Field", "Path", "Message", "Export Schema", "Row Kind", "Mode", "Profile ID", "Ruleset Revision", "Coverage Revision", "Build Revision", "Implementation Guide", "Execution Status", "Verdict", "Location", "Coverage and Exclusions"];
const dispositionHeaders = ["Reported File Disposition", "Reported File Qualifier", "Reported Batch Dispositions"];

describe("schema-4 execution evidence exports", () => {
  it.each([
    ["unknown ACK version", ACK_PACK, "ach-candidates/ack-version-unsupported.txt"],
    ["unsupported BAI currency", BAI2_PACK, "bai2/balances-pass.bai2"],
    ["unsupported wire currency", CSV_WIRE_PACK, "csv-wire/cad-unsupported.csv"],
  ] as const)("preserves the actual no-verdict reason: %s", (_name, pack, file) => {
    const source = pack === BAI2_PACK ? fixture(file).replaceAll("USD", "EUR") : fixture(file);
    const run = schema(validateSource("synthetic", source, pack), "4");
    expect(run.executionStatus).toBe("UNSUPPORTED"); expect(run.verdict).toBeNull();
    expect(run.executionReason).toBeTruthy();
    const json = JSON.parse(validationRunToJson(run));
    const [header, ...data] = rows(validationRunToCsv(run));
    expect(header).toEqual([...baseHeaders, ...dispositionHeaders, "Execution Reason"]);
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) {
      expect(row).toHaveLength(26); expect(row[18]).toBe("UNSUPPORTED"); expect(row[19]).toBe("");
      expect(row[25]).toBe(json.executionReason); expect(row.slice(22, 25)).toEqual(["", "", ""]);
    }
    expect(json.verdict).toBeNull(); expect(json.exportSchemaVersion).toBe("4");
  });

  it("retains partial occurrence evidence and an explanatory skipped check row", () => {
    const base = validateSource("synthetic", fixture("bai2/balances-pass.bai2"), BAI2_PACK);
    const reason = 'A batch has an unknown amount, "quoted"\nso reconciliation is incomplete.';
    const run = schema({ ...base, checks: [{ ruleId: "bai2.account-total", state: "not-evaluated", findingOrdinals: [], reason }] }, "4");
    const [, ...data] = rows(validationRunToCsv(run));
    expect(data.filter(row => row[11] === "evaluation-occurrence")).toHaveLength(base.results.length);
    const skipped = data.find(row => row[11] === "check-state")!;
    expect(skipped[9]).toBe(reason); expect(skipped[25]).toBe("");
    const metadata = JSON.parse(data[0]![21]!);
    expect(metadata.checks[0].reason).toBe(reason);
    expect(JSON.parse(validationRunToJson(run)).checks[0].reason).toBe(reason);
  });

  it.each(["=SUM(A1)", "+value", "-value", "@value", "\tvalue", "\rvalue"])("neutralizes formula-sensitive reason %j without changing JSON", text => {
    const base = validateSource("synthetic", fixture("bai2/funds-unsupported.bai2"), BAI2_PACK);
    const reason = `${text}, "quote"\nnext line`;
    const run = schema({ ...base, executionReason: reason, checks: [{ ruleId: "test", state: "not-evaluated", findingOrdinals: [], reason }] }, "4");
    const [, first] = rows(validationRunToCsv(run));
    expect(first![25]).toBe(`'${reason}`); expect(first![9]).toBe(`'${reason}`);
    expect(JSON.parse(validationRunToJson(run)).executionReason).toBe(reason);
  });

  it("preserves a valid REJECTED ACK disposition independently of format PASS", () => {
    const run = schema(validateSource("synthetic", fixture("ach-candidates/ack-rejected-pass.txt"), ACK_PACK), "4");
    expect(run.verdict).toBe("PASS");
    const [, first] = rows(validationRunToCsv(run));
    expect(first![19]).toBe("PASS"); expect(first![22]).toBe("REJECTED");
    expect(first![23]).toBe("ChecksumMismatch"); expect(first![25]).toBe("");
    expect(JSON.parse(first![24]!)).toEqual(run.reportedDisposition!.batches);
  });

  it.each(["2", "3"])("preserves historical schema %s columns and generic skipped messages", version => {
    const base = validateSource("synthetic", fixture("ach-candidates/ack-rejected-pass.txt"), ACK_PACK);
    const run = schema({ ...base, executionReason: "not a historical CSV field", checks: [{ ruleId: "test", state: "not-evaluated", findingOrdinals: [], reason: "new completeness detail" }] }, version);
    const [header, ...data] = rows(validationRunToCsv(run));
    expect(header).toEqual(version === "2" ? baseHeaders : [...baseHeaders, ...dispositionHeaders]);
    expect(data.every(row => row.length === (version === "2" ? 22 : 25))).toBe(true);
    expect(data.find(row => row[11] === "check-state")![9]).toBe("See coverage prerequisites and execution status.");
    if (version === "3") expect(data[0]!.slice(22, 24)).toEqual(["REJECTED", "ChecksumMismatch"]);
    expect(JSON.parse(validationRunToJson(run)).exportSchemaVersion).toBe(version);
  });

  it("includes the reason in the metadata-only fallback row", () => {
    const base = validateSource("synthetic", fixture("bai2/funds-unsupported.bai2"), BAI2_PACK);
    const run = schema({ ...base, results: [], checks: [] }, "4");
    const [, first] = rows(validationRunToCsv(run));
    expect(first![11]).toBe("run-metadata"); expect(first![25]).toBe(run.executionReason);
    expect(first![19]).toBe("");
  });
});
