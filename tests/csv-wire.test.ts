import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CSV_WIRE_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
import { locateFindings } from "../src/finding-locations";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { provenanceFor } from "../src/coverage";
import { ResourceLimitError } from "../src/resource-policy";
import manifest from "../demo-files/csv-wire/manifest.json";
import { wireSnapshots as snapshot } from "./current-coverage";

const fixture = (file: string): string => readFileSync(`demo-files/csv-wire/${file}`, "utf8");
const quote = (fields: readonly string[]): string => fields.map(v => `"${v.replaceAll('"', '""')}"`).join(",");
const fields = (intl = false): string[] => fixture(intl ? "international-usd-pass.csv" : "domestic-pass.csv").trim().split(",").map(v => JSON.parse(v) as string);
const source = (n: number, value: string, intl = false): string => { const f = fields(intl); f[n - 1] = value; return quote(f); };
const run = (text: string) => validateSource("synthetic.csv", text, CSV_WIRE_PACK);
const errors = (text: string) => run(text).results.filter(r => r.outcome === "ERROR").map(r => r.ruleId);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14T23:59:00Z")); });
afterEach(() => vi.useRealTimers());

describe("CSV Wire guide candidate", () => {
  it.each(manifest.fixtures)("pins and evaluates $file", entry => {
    const text = fixture(entry.file);
    expect(createHash("sha256").update(text).digest("hex")).toBe(entry.sha256);
    const result = run(text);
    expect(result.overallStatus).toBe(entry.expected);
    expect(errors(text)).toEqual(expect.arrayContaining(entry.rules));
    if (entry.expected === "PASS") expect(result.checks?.every(c => ["passed", "not-applicable"].includes(c.state))).toBe(true);
    if (entry.expected === "UNSUPPORTED") {
      expect(result.verdict).toBeNull(); expect(result.results).toEqual([]);
      expect(result.checks?.every(c => c.state === "not-evaluated")).toBe(true);
    }
  });
  it("pins the functional guide extraction used in report provenance", () => {
    const digest = createHash("sha256").update(readFileSync("docs/sources/csv-wire-guide-extract.json")).digest("hex");
    expect(digest).toBe("6fe82ba05375d5deb999713ed82b33b89347c6cbebbb3f8eae274d342c2a17cb");
    expect(provenanceFor(CSV_WIRE_PACK).implementationGuideRevision).toContain(digest);
  });
  it("freezes separate schema-3 coverage without changing historical profiles", () => {
    const { buildRevision, ...current } = provenanceFor(CSV_WIRE_PACK);
    expect([current]).toEqual(snapshot); expect(current.schemaVersion).toBe("4");
    expect(Object.values(CSV_WIRE_PACK.approval).some(Boolean)).toBe(false);
  });
  it("records a real date and admits exactly 30 UTC calendar days ahead", () => {
    expect(run(source(2, "20261113")).overallStatus).toBe("PASS");
    expect(errors(source(2, "20261114"))).toEqual(["wire.date"]);
    expect(run(source(2, "20261113", true)).overallStatus).toBe("PASS");
    expect(errors(source(2, "20261114", true))).toEqual(["wire.date"]);
    for (const value of ["20260229", "20261301", "00000101", "2026-10-14"]) expect(errors(source(2, value))).toContain("wire.date");
    expect(run(source(2, "20240229")).overallStatus).toBe("PASS");
    expect(run(source(2, "20200101")).results.find(r => r.ruleId === "wire.date")?.message).toContain("2026-10-14");
  });
  it.each(["-1.00", "+1.00", "1,000.00", "1", ".50", "1.", "1.000", "9999999999999999.99", "1234567890123456789.0"])("rejects domestic amount %s", value => {
    expect(errors(source(3, value))).toContain("wire.amount");
  });
  it.each(["0.00", "0001.20", "999999999999999.99", "1.2"])("admits exact candidate decimal %s", value => {
    expect(run(source(3, value)).overallStatus).toBe("PASS");
  });
  it("validates both international amounts and optional rate without floating-point conversion", () => {
    expect(run(source(3, "123.123", true)).overallStatus).toBe("PASS");
    expect(errors(source(3, "123.1234", true))).toContain("wire.amount");
    expect(errors(source(7, "", true))).toContain("wire.amount");
    expect(run(source(8, "1.12345678", true)).overallStatus).toBe("PASS");
    expect(errors(source(8, "1.123456789", true))).toContain("wire.fx");
  });
  it("enforces the FX N10 cap even when leading fractional zeros hide significant digits", () => {
    for (const value of ["0.00000001", "12345678.9", "00000000.1"]) expect(run(source(8, value, true)).overallStatus).toBe("PASS");
    for (const value of ["0.000000001", "012345678.9", "0.00000000000000000000000000000001"]) expect(errors(source(8, value, true))).toContain("wire.fx");
  });
  it("checks conditions, code pairs and the beneficiary BIC country", () => {
    const f = fields(); f[8] = "SYNTHETIC"; f[10] = "SYNTHETIC CITY"; f[12] = "US";
    expect(run(quote(f)).overallStatus).toBe("PASS");
    expect(errors(source(27, "ABA"))).toContain("wire.bank");
    expect(errors(source(28, "044000024"))).toContain("wire.bank");
    f[26] = "ABA"; f[27] = "044000024"; f[45] = "ABA"; f[46] = "021000021";
    expect(run(quote(f)).overallStatus).toBe("PASS");
    expect(errors(source(20, "ROYCCAT2", true))).toContain("wire.bank");
    expect(errors(source(24, "US", true))).toContain("wire.bank");
    expect(errors(source(16, "000000000"))).toContain("wire.bank");
    expect(errors(source(13, "us"))).toContain("wire.country");
    expect(run(source(17, "GB", true)).overallStatus).toBe("UNSUPPORTED");
  });
  it("maps an aggregated error to the exact quoted field on the second original CRLF row", () => {
    const first = fixture("domestic-pass.csv").trimEnd();
    const bad = source(3, "3e2"); const text = `${first}\r\n${bad}\r\n${bad}`;
    const result = run(text); const error = result.results.find(r => r.ruleId === "wire.amount")!;
    expect(error.message).toContain("2 violations");
    expect(error.message).not.toContain("3e2");
    const location = locateFindings(text, CSV_WIRE_PACK, result).find(l => l.ordinal === error.ordinal)?.location;
    expect(location?.kind).toBe("located");
    if (location?.kind === "located") {
      expect(location.primary.kind).toBe("exact");
      expect(location.primary.span.start).toBe(first.length + 2 + bad.indexOf('"3e2"'));
      expect(text.slice(location.primary.span.start, location.primary.span.end)).toBe('"3e2"');
    }
  });
  it.each(["", "\n", '"USWIRE";', '"USWIRE"\r', '"USWIRE"x', fixture("domestic-pass.csv") + "\n", fixture("domestic-pass.csv").trim() + ","])("stops malformed framing with dependent checks unevaluated", text => {
    const result = run(text); expect(result.overallStatus).toBe("FAIL");
    expect(result.results.some(r => r.ruleId === "wire.amount")).toBe(false);
    expect(result.checks?.find(c => c.ruleId === "wire.amount")?.state).toBe("not-evaluated");
  });
  it("does not normalize whitespace or discard extra fields", () => {
    expect(errors(source(7, "OTHER "))).toContain("wire.account-type");
    expect(errors(quote([...fields(), "extra"]))).toContain("wire.layout");
    expect(errors(source(6, " "))).toContain("wire.required");
    expect(errors(source(6, "SYNTHETIC\tNAME"))).toEqual(["wire.characters"]);
  });
  it("keeps worker decoding and resource errors distinct from completed FAIL/UNSUPPORTED", () => {
    const request = (bytes: Uint8Array) => validateWorkerRequest({ type: "validate", packId: CSV_WIRE_PACK.id, fileName: "synthetic.csv", bytes: bytes.buffer as ArrayBuffer, includeExplorer: true });
    expect(request(new Uint8Array([0xff]))).toEqual({ type: "error", code: "INVALID_ENCODING" });
    const bom = request(new TextEncoder().encode("\ufeff" + fixture("domestic-pass.csv")));
    expect(bom.type === "complete" && bom.run.overallStatus).toBe("FAIL");
    const complete = request(new TextEncoder().encode(fixture("international-usd-pass.csv")));
    expect(complete.type === "complete" && complete.run.overallStatus).toBe("PASS");
    expect(() => run(source(33, "X".repeat(1_000_001)))).toThrow(ResourceLimitError);
    expect(request(new TextEncoder().encode(source(33, "X".repeat(1_000_001))))).toEqual({ type: "error", code: "RESOURCE_LIMIT" });
    expect(() => run((quote(fields()) + "\n").repeat(1900))).toThrow(ResourceLimitError);
  });
  it("exports schema, coverage, reference date and safe cells for completed and unsupported runs", () => {
    const result = validateSource("=SYNTHETIC.csv", source(3, "3e2"), CSV_WIRE_PACK);
    const json = JSON.parse(validationRunToJson(result)); const csv = validationRunToCsv(result);
    expect(json.exportSchemaVersion).toBe("4"); expect(json.provenance.profileId).toBe(CSV_WIRE_PACK.id);
    expect(csv).toContain('"\'=SYNTHETIC.csv"'); expect(csv).toContain("wire.amount"); expect(csv).toContain("2026-10-14");
    expect(csv).not.toContain("99999999999");
    const unsupported = run(fixture("cad-unsupported.csv"));
    expect(JSON.parse(validationRunToJson(unsupported)).verdict).toBeNull();
    expect(validationRunToCsv(unsupported)).toContain("not-evaluated");
  });
});
