import { describe, expect, it } from "vitest";
import { EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK } from "../src/format-packs";
import { parseNacha } from "../src/parsers/nacha";
import { easternValidationDate, federalReserveHoliday } from "../src/parsers/nacha-calendar";
import { buildNacha, field } from "./nacha-builder";

const asOf = new Date("2026-10-14T12:00:00Z");
const fixture = (effectiveDate: string, reference = asOf) => {
  const rows = buildNacha();
  rows[1] = field(rows[1]!, 70, 75, effectiveDate);
  return parseNacha(rows.join("\n"), ORIGINATION_R2_PACK, reference);
};
const finding = (effectiveDate: string, id: string, reference = asOf) =>
  fixture(effectiveDate, reference).results.find(result => result.ruleId === `nacha.${id}`);

describe("Federal Reserve ACH holiday dates (not federal-office closures)", () => {
  it.each([
    ["2026-01-01", "New Year's Day"],
    ["2026-01-19", "Martin Luther King Jr. Day"],
    ["2026-02-16", "Washington's Birthday"],
    ["2026-05-25", "Memorial Day"],
    ["2026-06-19", "Juneteenth"],
    ["2026-09-07", "Labor Day"],
    ["2026-10-12", "Columbus Day"],
    ["2026-11-11", "Veterans Day"],
    ["2026-11-26", "Thanksgiving Day"],
    ["2026-12-25", "Christmas Day"],
    ["2027-07-05", "Independence Day"], // July 4 on Sunday
    ["2022-06-20", "Juneteenth"], // June 19 on Sunday
    ["2023-01-02", "New Year's Day"], // January 1 on Sunday
    ["2022-12-26", "Christmas Day"], // December 25 on Sunday
  ])("recognizes %s as %s", (date, expected) => {
    expect(federalReserveHoliday(new Date(`${date}T00:00:00Z`))).toBe(expected);
  });

  it.each([
    "2026-07-03", // July 4 falls on Saturday; Friday is open
    "2027-06-18", // Juneteenth falls on Saturday; Friday is open
    "2027-12-31", // January 1, 2028 falls on Saturday; Friday is open
    "2021-06-18", // June 19, 2021 falls on Saturday; Friday is open
    "2020-06-19", // Juneteenth was not a Federal Reserve holiday until 2021
    "2026-07-04", // Weekend warning only, not a duplicate holiday warning
    "2027-06-19", // Weekend warning only
    "2026-10-14", // Ordinary Wednesday
  ])("does not generate a holiday finding for %s", date => {
    expect(federalReserveHoliday(new Date(`${date}T00:00:00Z`))).toBeNull();
  });
});

describe("NACHA origination R2 effective-date advisories", () => {
  it("emits a holiday warning with date, holiday, batch and exact field location", () => {
    const result = finding("261126", "effective-holiday");
    expect(result?.outcome).toBe("WARNING");
    expect(result?.message).toContain("Thanksgiving Day");
    expect(result?.message).toContain("261126");
    expect(result?.message).toContain("Batch 0000001");
    expect(result?.message).toBe("Batch 0000001: Effective Entry Date 261126 falls on a Federal Reserve holiday (Thanksgiving Day). Confirm the intended settlement date with your bank.");
    expect(result?.locator).toBe("Record 2 / Columns 70-75");
    expect(finding("261126", "effective-past")?.outcome).toBe("PASS");
  });

  it("does not duplicate the existing weekend warning for a weekend holiday", () => {
    const weekend = finding("260704", "effective-weekend");
    expect(weekend?.outcome).toBe("WARNING");
    expect(weekend?.message).toBe("Batch 0000001: Effective Entry Date 260704 falls on a weekend. Confirm or update the intended settlement date.");
    expect(weekend?.locator).toBe("Record 2 / Columns 70-75");
    expect(finding("260704", "effective-holiday")?.outcome).toBe("PASS");
    expect(finding("270705", "effective-holiday")?.outcome).toBe("WARNING");
    expect(finding("260703", "effective-holiday")?.outcome).toBe("PASS");
  });

  it("compares calendar dates, not time of day, with New York determining today", () => {
    expect(easternValidationDate(new Date("2026-11-18T04:59:59Z"))).toBe("2026-11-17");
    expect(easternValidationDate(new Date("2026-11-18T05:00:00Z"))).toBe("2026-11-18");
    expect(finding("261117", "effective-past", new Date("2026-11-18T04:59:59Z"))?.outcome).toBe("PASS");
    const past = finding("261117", "effective-past", new Date("2026-11-18T05:00:00Z"));
    expect(past?.outcome).toBe("WARNING");
    expect(past?.message).toContain("2026-11-18");
    expect(past?.message).toContain("261117");
    expect(past?.message).toBe("Batch 0000001: Effective Entry Date 261117 is in the past (as of 2026-11-18). Confirm or update the intended settlement date.");
    expect(finding("261119", "effective-past", new Date("2026-11-18T05:00:00Z"))?.outcome).toBe("PASS");
    expect(easternValidationDate(new Date("2026-07-04T03:59:59Z"))).toBe("2026-07-03");
    expect(easternValidationDate(new Date("2026-07-04T04:00:00Z"))).toBe("2026-07-04");
  });

  it("keeps invalid dates ERROR and marks dependent warnings not evaluated", () => {
    const output = fixture("260230");
    const invalidDate = output.results.find(r => r.ruleId === "nacha.effective-date");
    expect(invalidDate?.outcome).toBe("ERROR");
    expect(invalidDate?.message).toBe("Effective entry date must be a real calendar date in YYMMDD format.");
    for (const id of ["effective-weekend", "effective-holiday", "effective-past"]) {
      expect(output.results.some(r => r.ruleId === `nacha.${id}`)).toBe(false);
      expect(output.incompleteChecks?.map(c => c.ruleId)).toContain(`nacha.${id}`);
    }
  });

  it("aggregates multiple dated batches and reports the first batch", () => {
    const rows = buildNacha([{}, {}]);
    rows[1] = field(rows[1]!, 70, 75, "261126");
    rows[4] = field(rows[4]!, 70, 75, "261126");
    const output = parseNacha(rows.join("\n"), ORIGINATION_R2_PACK, asOf);
    const holiday = output.results.find(r => r.ruleId === "nacha.effective-holiday");
    expect(holiday?.outcome).toBe("WARNING");
    expect(holiday?.message).toContain("2 violations; first location shown");
    expect(holiday?.locator).toBe("Record 2 / Columns 70-75");
  });

  it("does not change the historical expanded-r1 profile", () => {
    const rows = buildNacha();
    rows[1] = field(rows[1]!, 70, 75, "261126");
    const output = parseNacha(rows.join("\n"), EXPANDED_NACHA_PACK, new Date("2026-11-27T18:00:00Z"));
    expect(output.results.some(r => ["nacha.effective-holiday", "nacha.effective-past"].includes(r.ruleId))).toBe(false);
    rows[1] = field(rows[1]!, 70, 75, "260704");
    const legacyWeekend = parseNacha(rows.join("\n"), EXPANDED_NACHA_PACK, new Date("2026-07-04T18:00:00Z"));
    expect(legacyWeekend.results.find(r => r.ruleId === "nacha.effective-weekend")?.message).toBe("The effective entry date falls on a weekend. Confirm ACH processing dates and handling with the ODFI; this check does not determine a cutoff or holiday calendar.");
    rows[1] = field(rows[1]!, 70, 75, "260230");
    const invalid = parseNacha(rows.join("\n"), EXPANDED_NACHA_PACK, new Date("2026-11-27T18:00:00Z"));
    expect(invalid.results.find(r => r.ruleId === "nacha.effective-date")?.message).toBe("Effective entry date must be a real calendar date in YYMMDD format.");
  });
});
