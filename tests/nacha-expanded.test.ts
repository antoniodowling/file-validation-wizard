import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPANDED_NACHA_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
import { coverageFor, provenanceFor } from "../src/coverage";
import { NACHA_EXPANDED_RULE_IDS } from "../src/parsers/nacha";
import { ctxX12Syntax } from "../src/parsers/ach-remittance";
import { ResourceLimitError } from "../src/resource-policy";
import { field } from "./nacha-builder";
import snapshot from "../docs/coverage/nacha-expanded-public-1.0.0.json";
const pack = EXPANDED_NACHA_PACK;
const fixture = (name: string) => readFileSync(`demo-files/nacha-expanded/${name}.ach`, "utf8");
const run = (source: string) => validateSource("synthetic.ach", source, pack);
const change = (source: string, row: number, from: number, to: number, value: string) => source.split("\n").map((line, i) => i === row ? field(line, from, to, value) : line).join("\n");
const state = (source: string, id: string) => run(source).checks?.find(check => check.ruleId === `nacha.${id}`)?.state;
describe("expanded origination revision", () => {
  it("pins separate coverage with all approvals false and preserves legacy snapshots", () => {
    const { buildRevision, ...actual } = provenanceFor(pack);
    expect([actual]).toEqual(snapshot);
    expect(coverageFor(pack).map(rule => rule.id)).toEqual([...NACHA_EXPANDED_RULE_IDS.slice(0, 42), "nacha.non-empty-source", ...NACHA_EXPANDED_RULE_IDS.slice(42)]);
    expect(Object.values(pack.approval)).toEqual([false, false, false, false, false]);
  });
  it("independently verifies a known entry’s zero amounts and exact count/hash controls from source positions", () => {
    const rows = fixture("ccd-24-pass").trimEnd().split("\n");
    expect(rows[2]?.slice(1, 3)).toBe("24"); expect(rows[2]?.slice(29, 39)).toBe("0000000000");
    // One entry + its mandatory addenda. One receiving DFI prefix = 01000000.
    expect(rows[4]?.slice(4, 10)).toBe("000002"); expect(rows[4]?.slice(10, 20)).toBe("0001000000");
    expect(rows[4]?.slice(20, 44)).toBe("0".repeat(24)); expect(rows[5]?.slice(13, 21)).toBe("00000002");
    expect(rows[2]?.slice(78, 79)).toBe("1"); expect(rows[3]?.slice(87, 94)).toBe(rows[2]?.slice(87, 94));
  });
  it("treats absent optional and unknown prerequisites distinctly", () => {
    const source = fixture("ccd-23-pass");
    expect(state(source, "remittance-required")).toBe("not-applicable"); expect(state(source, "ctx-remittance")).toBe("not-applicable");
    for (const id of ["batch-credit", "batch-debit", "file-credit", "file-debit", "entry-amount", "sec-transaction", "web-credit-originator", "remittance-required"]) expect(state(change(source, 2, 2, 3, "99"), id), id).toBe("not-evaluated");
    for (const id of ["batch-hash", "file-hash"]) expect(state(change(source, 2, 4, 11, "NOTRDFI!"), id)).toBe("not-evaluated");
    const ctx = fixture("ctx-54-pass");
    expect(state(change(ctx, 3, 2, 3, "99"), "ctx-remittance")).toBe("not-evaluated");
    for (const id of ["sec-transaction", "web-credit-originator", "remittance-required", "ctx-remittance"]) expect(state(change(source, 1, 51, 53, "BAD"), id)).toBe("not-evaluated");
    const malformed = source.slice(1); expect(run(malformed).results.map(rule => rule.ruleId)).toEqual(["nacha.framing"]);
  });
  it("preserves a meaningful reference space across multiple fixed-record payload chunks", () => {
    const source = fixture("ctx-cross-record-reference-pass"); const rows = source.trimEnd().split("\n");
    expect(rows[2]?.slice(54, 58)).toBe("0002");
    const first = rows[3]!.slice(3, 83), second = rows[4]!.slice(3, 83);
    expect(first.endsWith("AB ")).toBe(true); expect(second.startsWith("CD~")).toBe(true);
    expect(rows[5]?.slice(4, 10)).toBe("000003"); expect(rows[5]?.slice(10, 20)).toBe("0001000000");
    expect(rows[5]?.slice(20, 44)).toBe("000000000000000000000001");
    expect(rows[6]?.slice(13, 21)).toBe("00000003");
    expect(run(source).overallStatus).toBe("PASS");
    expect(ctxX12Syntax(first.trimEnd() + second.trimEnd(), pack)).toBe(false);
  });
  it("allows uppercase REVERSAL within the field and TEL monetary credits, withholding historical claims", () => {
    expect(run(fixture("tel-22-reversal-pass")).overallStatus).toBe("PASS");
    expect(run(fixture("loan-reversal-marker-fail")).results.some(rule => rule.ruleId === "nacha.reversal-transaction" && rule.outcome === "ERROR")).toBe(true);
    expect(provenanceFor(pack).exclusions.join(" ")).toContain("original-entry matching");
  });
  it("keeps source-gated payloads and account combinations without verdicts", () => {
    for (const name of ["ctx-edifact-unsupported", "web-loan-unsupported"]) {
      const result = run(fixture(name)); expect(result.overallStatus).toBe("UNSUPPORTED"); expect(result.verdict).toBeNull(); expect(result.results).toEqual([]);
    }
  });
  it("enforces BOM/encoding admission through the worker and decoded resource bounds", () => {
    const bytes = new TextEncoder().encode("\uFEFF" + fixture("mixed-entry-types-pass")).buffer;
    const response = validateWorkerRequest({ type: "validate", packId: pack.id, fileName: "synthetic.ach", bytes });
    expect(response.type).toBe("complete"); if (response.type === "complete") expect(response.run.overallStatus).toBe("FAIL");
    expect(validateWorkerRequest({ type: "validate", packId: pack.id, fileName: "bad.ach", bytes: Uint8Array.of(0xff).buffer })).toEqual({ type: "error", code: "INVALID_ENCODING" });
    expect(() => run("x".repeat(8_000_001))).toThrow(ResourceLimitError);
  });
  it("uses any X12 transaction set with BPR/BPS and rejects malformed references/counts, not only 820", () => {
    expect(ctxX12Syntax("ST*813*1~BPS*1~SE*3*1~", pack)).toBe(true);
    for (const source of ["ST*813*1~BPS*1~SE*4*1~", "ST*813*1~BPS*1~SE*3*2~", "ST*813*1~NTE*X~SE*3*1~", "ST*813*1~BPS*1~SE*3*1", "BPR*C~"]) expect(ctxX12Syntax(source, pack)).toBe(false);
    const isa = "ISA*00*          *00*          *ZZ*SYNTHETIC      *ZZ*DEMO           *261014*1200*U*00401*000000001*0*T*:~";
    const body = "GS*RA*SYNTHETIC*DEMO*20261014*1200*1*X*004010~ST*813*0001~BPS*1~SE*3*0001~GE*1*1~IEA*1*000000001~";
    expect(ctxX12Syntax(isa + body, pack)).toBe(true);
    expect(ctxX12Syntax(isa + body.replace("GE*1*1", "GE*2*1"), pack)).toBe(false);
    for (const bad of [
      "ST*820*1~BPR*C~#*BAD~SE*4*1~",
      "ST*820*1~BPR*C~~SE*3*1~",
      "ST*820*1~BPR*C~SE*3*1~ST*820*1~BPR*C~SE*3*1~",
    ]) {
      const envelope = isa + "GS*RA*SYNTHETIC*DEMO*20261014*1200*1*X*004010~" + bad + "GE*" + (bad.includes("SE*3*1~ST") ? "2" : "1") + "*1~IEA*1*000000001~";
      expect(ctxX12Syntax(bad, pack)).toBe(false); expect(ctxX12Syntax(envelope, pack)).toBe(false);
    }
  });
});
