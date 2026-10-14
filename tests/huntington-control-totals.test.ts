import { describe, expect, it } from "vitest";
import { parseHuntingtonControlTotals } from "../src/parsers/huntington-control-totals";
import { UnsupportedInputError } from "../src/resource-policy";
import type { FormatPack } from "../src/types";
const pack = {} as FormatPack;
export const validTotals = " 010000003" + "SYNTHETIC BANK".padEnd(16) + "000000000001" + "999999999999" + "20261014";
const parse = (value = validTotals) => parseHuntingtonControlTotals(value, pack);
const errors = (value: string) => parse(value).results.filter(result => result.outcome === "ERROR").map(result => result.ruleId);
const field = (from: number, to: number, value: string) => validTotals.slice(0, from - 1) + value + validTotals.slice(to);
describe("standalone Huntington control-total candidate", () => {
  it.each(["", "\n", "\r\n", "\r"])("accepts candidate framing %j without interpreting collection windows", suffix => {
    expect(validTotals).toHaveLength(58); expect(errors(validTotals + suffix)).toEqual([]);
  });
  it("supports exact high cent values without floating-point arithmetic or companion equality", () => {
    expect(errors(field(27, 38, "999999999999"))).toEqual([]);
    expect(errors(field(27, 38, "000000000000"))).toEqual([]);
  });
  it.each(["", validTotals.slice(1), validTotals + " ", validTotals + "\n\n", "\uFEFF" + validTotals])("rejects malformed record boundaries %j", value => {
    expect(errors(value)).toContain("ach-totals.framing"); expect(parse(value).context).toBeNull();
    expect(parse(value).results.some(result => result.ruleId === "ach-totals.credit")).toBe(false);
  });
  it.each([validTotals + validTotals, validTotals + "\n" + validTotals])( "does not invent multi-record support", value => {
    expect(() => parse(value)).toThrow(UnsupportedInputError);
  });
  it("rejects tabs and Unicode with dependent fields suppressed", () => {
    expect(errors(field(11, 26, "\t" + "A".repeat(15)))).toEqual(["ach-totals.ascii"]);
    expect(errors(field(11, 26, "É" + "A".repeat(15)))).toEqual(["ach-totals.ascii"]);
  });
  it("allows leading blank origins and enforces populated uppercase company names", () => {
    expect(errors(field(1, 10, "0123456789"))).toEqual([]);
    expect(errors(field(1, 10, " ".repeat(10)))).toEqual(["ach-totals.origin"]);
    expect(errors(field(11, 26, " ".repeat(16)))).toEqual(["ach-totals.company"]);
    expect(errors(field(11, 26, "Lowercase".padEnd(16)))).toEqual(["ach-totals.company"]);
  });
  it.each(["00000001.000", "-00000000001", "            "])("rejects non-integer amount %j", value => {
    expect(errors(field(27, 38, value))).toEqual(["ach-totals.credit"]);
    expect(errors(field(39, 50, value))).toEqual(["ach-totals.debit"]);
  });
  it.each(["20260229", "20261301", "20260431", "00000101", "20A61014"])("rejects invalid date %s", value => {
    expect(errors(field(51, 58, value))).toEqual(["ach-totals.transmission-date"]);
  });
  it.each(["20240229", "20000229", "21000301", "00990101"])("accepts Gregorian date %s", value => expect(errors(field(51, 58, value))).toEqual([]));
  it("retains exact field locations in the source", () => {
    const failed = parse(field(39, 50, "00000000A001")).results.find(result => result.outcome === "ERROR")!;
    expect(failed.location).toMatchObject({ kind: "located", primary: { span: { start: 38, end: 50 } } });
  });
});
