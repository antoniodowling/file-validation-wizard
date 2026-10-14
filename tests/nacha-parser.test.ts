import { describe, expect, it } from "vitest";
import type { FindingLocation, FormatPack } from "../src/types";
import { NACHA_RULE_IDS, parseNacha } from "../src/parsers/nacha";
import { buildNacha, field } from "./nacha-builder";
const pack = { identifiers: { kind: "NACHA_FIXED", profile: "origination-public-2026", secCodes: ["CCD", "PPD", "CTX", "WEB", "TEL"] } } as unknown as FormatPack;
const parse = (rows: string[] | string) => parseNacha(typeof rows === "string" ? rows : rows.join("\n"), pack);
const errors = (rows: string[] | string) => parse(rows).results.filter((r) => r.outcome === "ERROR");
const bad = (rows: string[], record: number, from: number, to: number, value: string) => rows.map((row, i) => i === record ? field(row, from, to, value) : row);
const fails = (rows: string[] | string, id: string) => expect(errors(rows).map((r) => r.ruleId)).toContain(`nacha.${id}`);
describe("NACHA ordinary origination parser", () => {
  it.each(["CCD", "PPD", "CTX", "WEB", "TEL"])("accepts %s and mixed SEC batches", (sec) => {
    expect(errors(buildNacha([{ sec, addenda: [sec === "CTX" ? 2 : sec === "TEL" ? 0 : 1] }]))).toEqual([]);
  });
  it("accepts every supported ordinary account code and both balancing modes", () => {
    expect(errors(buildNacha([{ codes: ["22", "27", "32", "37", "52"], amounts: [1n, 2n, 3n, 4n, 5n] }]))).toEqual([]);
    expect(errors(buildNacha([{ codes: ["22", "27"], amounts: [125n, 125n] }, { sec: "CTX", addenda: [4] }, { sec: "WEB" }, { sec: "TEL" }]))).toEqual([]);
  });
  it.each(["\n", "\r\n", "\r", ""])("preserves complete records using %j framing", (delimiter) => {
    const source = buildNacha().join(delimiter) + delimiter;
    expect(errors(source)).toEqual([]); expect(parse(source).context?.source).toBe(source);
  });
  it("rejects malformed, blank, mixed and concatenated-with-newline framing without totals", () => {
    const rows = buildNacha();
    for (const source of ["", rows.join("\n") + "\n\n", rows.join("\n").replace("\n", "\r\n"), rows.join("" ) + "\n", rows.map((row, i) => i === 2 ? row.slice(0, 93) : row).join("\n")]) {
      fails(source, "framing"); expect(parse(source).results.some((r) => r.ruleId === "nacha.file-credit")).toBe(false);
    }
  });
  it("rejects a large delimiter-heavy malformed upload before record validation", () => {
    const output = parse("\n".repeat(1_000_000));
    expect(output.context).toBeNull();
    expect(output.results.map(result => [result.ruleId, result.outcome])).toEqual([["nacha.framing", "ERROR"]]);
  });
  it("rejects non-ASCII and controls", () => { for (const value of ["é", "\t", "\0"]) fails(bad(buildNacha(), 2, 13, 13, value), "ascii"); });
  it("rejects invalid sequence before totals", () => {
    const rows = buildNacha(); [rows[1], rows[2]] = [rows[2]!, rows[1]!];
    fails(rows, "record-order"); expect(parse(rows).results.some((r) => r.ruleId === "nacha.batch-hash")).toBe(false);
    const orphan = buildNacha(); orphan[1] = "705" + " ".repeat(80) + "00010000001"; fails(orphan, "record-order");
  });
  it("checks header constants, calendar dates, optional time and required values", () => {
    fails(bad(buildNacha(), 0, 35, 37, "093"), "file-header");
    for (const value of ["260230", "260000", "261332"]) fails(bad(buildNacha(), 0, 24, 29, value), "creation-date");
    expect(errors(bad(buildNacha(), 0, 24, 29, "240229"))).toEqual([]);
    fails(bad(buildNacha(), 0, 30, 33, "2460"), "creation-time");
    expect(errors(bad(buildNacha(), 0, 30, 33, "    "))).toEqual([]);
    fails(bad(buildNacha(), 1, 70, 75, "260231"), "effective-date");
    fails(bad(buildNacha(), 1, 5, 20, " ".repeat(16)), "batch-required");
    fails(bad(buildNacha(), 1, 54, 63, "REVERSAL  "), "batch-required");
  });
  it("reports weekends and operator settlement dates as warnings", () => {
    expect(parse(bad(buildNacha(), 1, 70, 75, "261017")).results.find((r) => r.ruleId === "nacha.effective-weekend")?.outcome).toBe("WARNING");
    expect(parse(bad(buildNacha(), 1, 76, 78, "287")).results.find((r) => r.ruleId === "nacha.settlement-date")?.outcome).toBe("WARNING");
  });
  it("validates destination routing while accepting assigned origin identifiers", () => {
    for (const value of [" 000000000", " 021000020", "X021000021"]) fails(bad(buildNacha(), 0, 4, 13, value), "file-header");
    expect(errors(bad(buildNacha(), 0, 14, 23, "COMPANY123"))).toEqual([]);
  });
  it("rejects invalid Julian settlement dates and upgrades an earlier warning", () => {
    for (const value of ["ABC", "000", "999"]) fails(bad(buildNacha(), 1, 76, 78, value), "settlement-date");
    let rows = bad(buildNacha([{}, {}]), 1, 76, 78, "287"); rows = bad(rows, 4, 76, 78, "ABC");
    const finding = parse(rows).results.find((r) => r.ruleId === "nacha.settlement-date");
    expect(finding?.outcome).toBe("ERROR"); expect(finding?.locator).toBe("Record 5 / Columns 76-78");
  });
  it("withholds amount controls when detail amounts or direction cannot be interpreted", () => {
    for (const rows of [bad(buildNacha(), 2, 30, 39, "NOTAMOUNT!"), bad(buildNacha(), 2, 2, 3, "99")]) {
      const ids = parse(rows).results.map((r) => r.ruleId);
      for (const id of ["batch-debit", "batch-credit", "file-debit", "file-credit"]) expect(ids).not.toContain(`nacha.${id}`);
      expect(ids).toContain("nacha.batch-count");
    }
  });
  it("validates routing prefix, nonzero routing and check digit", () => {
    for (const value of ["021000020", "000000000", "991234560"]) fails(bad(buildNacha(), 2, 4, 12, value), "routing");
    fails(bad(buildNacha(), 1, 80, 87, "00000000"), "odfi");
  });
  it("rejects prenotes, remittance-only, loan reversals and zero amounts", () => {
    for (const code of ["23", "24", "28", "29", "33", "34", "38", "39", "53", "54", "55", "99"]) fails(bad(buildNacha(), 2, 2, 3, code), "transaction-code");
    fails(bad(buildNacha(), 2, 30, 39, "0000000000"), "entry-amount");
    fails(bad(buildNacha(), 2, 30, 39, "0000001.00"), "entry-amount");
  });
  it("enforces direction and allows WEB credits with originator name", () => {
    fails(bad(buildNacha([{ sec: "TEL" }]), 2, 2, 3, "22"), "sec-transaction");
    fails(bad(buildNacha(), 1, 2, 4, "225"), "sec-transaction");
    fails(bad(buildNacha([{ sec: "WEB" }]), 2, 40, 54, " ".repeat(15)), "web-credit-originator");
    expect(errors(buildNacha([{ sec: "WEB" }]))).toEqual([]);
  });
  it("checks required account/name and CTX reserved positions", () => {
    fails(bad(buildNacha(), 2, 13, 29, " ".repeat(17)), "entry-required");
    fails(bad(buildNacha([{ sec: "CTX" }]), 2, 59, 74, " ".repeat(16)), "entry-required");
    fails(bad(buildNacha([{ sec: "CTX" }]), 2, 75, 76, "XX"), "reserved");
  });
  it("checks trace prefix, ascending gaps and file uniqueness", () => {
    fails(bad(buildNacha(), 2, 80, 87, "01100001"), "trace");
    const rows = buildNacha([{ codes: ["22", "22"] }]);
    expect(errors(bad(rows, 3, 88, 94, "0000009"))).toEqual([]);
    fails(bad(rows, 3, 88, 94, "0000001"), "trace-order");
    fails(bad(rows, 3, 88, 94, "0000001"), "trace-unique");
    const two = buildNacha([{}, {}]); fails(bad(two, 5, 88, 94, "0000001"), "trace-unique");
  });
  it("checks addenda type/count/indicator/link/sequences and TEL prohibition", () => {
    const rows = buildNacha([{ addenda: [1] }]);
    for (const value of ["98", "99"]) fails(bad(rows, 3, 2, 3, value), "addenda-type");
    fails(bad(rows, 3, 84, 87, "0002"), "addenda-sequence");
    fails(bad(rows, 3, 88, 94, "0000002"), "addenda-link");
    fails(bad(rows, 2, 79, 79, "0"), "addenda-indicator");
    fails(buildNacha([{ addenda: [2] }]), "addenda-count");
    fails(buildNacha([{ sec: "TEL", addenda: [1] }]), "addenda-count");
    fails(bad(buildNacha([{ sec: "CTX", addenda: [2] }]), 2, 55, 58, "0001"), "addenda-count");
  });
  it("accepts CTX maximum and rejects 10,000 addenda", () => {
    expect(errors(buildNacha([{ sec: "CTX", addenda: [9999] }]))).toEqual([]);
    const rows = buildNacha([{ sec: "CTX", addenda: [9999] }]);
    rows.splice(10002, 0, "705" + " ".repeat(80) + "00000000001");
    fails(rows, "addenda-count");
  });
  it("checks all control sums and identifiers independently", () => {
    const rows = buildNacha();
    for (const [from, to, value, id] of [[5,10,"000002","batch-count"],[11,20,"0000000000","batch-hash"],[21,32,"000000000001","batch-debit"],[33,44,"000000000000","batch-credit"],[45,54,"SYNTHETIC2","batch-mirror"]] as const) fails(bad(rows, 3, from, to, value), id);
    for (const [from, to, value, id] of [[2,7,"000002","file-batches"],[8,13,"000002","file-blocks"],[14,21,"00000002","file-count"],[22,31,"0000000000","file-hash"],[32,43,"000000000001","file-debit"],[44,55,"000000000000","file-credit"]] as const) fails(bad(rows, 4, from, to, value), id);
    fails(rows.slice(0, -1), "blocking");
  });
  it("uses exact integer cents for large amounts and hashes modulo ten digits", () => {
    expect(errors(buildNacha([{ codes: Array(99).fill("22"), amounts: Array(99).fill(9999999999n) }]))).toEqual([]);
    // Overflow remains an exact integer mismatch rather than rounding or crashing.
    const rows = buildNacha([{ codes: Array(4800).fill("22"), amounts: Array(4800).fill(1n) }]).map((row) => row[0] === "6" ? field(row, 30, 39, "9999999999") : row);
    expect(() => parse(rows)).not.toThrow(); fails(rows, "batch-credit"); fails(rows, "file-credit");
    expect(errors(buildNacha([{ codes: Array(4800).fill("22"), amounts: Array(4800).fill(1n) }]))).toEqual([]);
  });
  it("bounds repeated findings and never includes private field values", () => {
    const rows = buildNacha([{ codes: Array(2000).fill("22") }]).map((row) => row[0] === "6" ? field(row, 4, 12, "000000000") : row);
    const output = parse(rows); expect(output.results.length).toBeLessThanOrEqual(NACHA_RULE_IDS.length);
    expect(output.results.find((r) => r.ruleId === "nacha.routing")?.message).toContain("2000 violations");
    expect(JSON.stringify(output.results)).not.toContain("SYNTHETIC NAME");
  });
  it("emits source offsets preserving CRLF and unique known rule IDs", () => {
    const source = bad(buildNacha(), 2, 4, 12, "000000000").join("\r\n");
    const result = parse(source).results.find((r) => r.ruleId === "nacha.routing") as { location: FindingLocation } | undefined;
    expect(result?.location.kind).toBe("located");
    if (result?.location.kind === "located") expect(result.location.primary.span).toEqual({ start: 195, end: 204 });
    expect(new Set(NACHA_RULE_IDS).size).toBe(NACHA_RULE_IDS.length);
    expect(parse(source).results.every((r) => NACHA_RULE_IDS.includes(r.ruleId))).toBe(true);
  });
});
