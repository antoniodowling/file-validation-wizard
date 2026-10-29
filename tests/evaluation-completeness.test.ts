import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORMAT_PACKS, EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK, CSV_WIRE_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { parseNacha } from "../src/parsers/nacha";
import { parseCsvWire } from "../src/parsers/csv-wire";
import { buildNacha, field } from "./nacha-builder";
const ordinary = FORMAT_PACKS.find(p => p.id === "nacha-origination-public-2026")!;
const ach = (rows: string[], pack = ordinary) => validateSource("synthetic.ach", rows.join("\n"), pack);
const state = (run: ReturnType<typeof validateSource>, id: string) => run.checks?.find(c => c.ruleId === id)?.state;
const wireFixture = (intl = false) => readFileSync(`demo-files/csv-wire/${intl ? "international-usd-pass.csv" : "domestic-pass.csv"}`, "utf8").trim();
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14T23:59:00Z")); });
afterEach(() => vi.useRealTimers());

describe("rule completeness across independently scoped entities", () => {
  it.each([ordinary, EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK])("withholds partial batch amount PASS in $id in both orders", pack => {
    for (const rowIndex of [2, 5]) {
      const rows = buildNacha([{}, {}]); rows[rowIndex] = field(rows[rowIndex]!, 30, 39, "NOTAMOUNT!");
      const run = ach(rows, pack); expect(run.verdict).toBe("FAIL");
      for (const id of ["batch-debit", "batch-credit"]) {
        expect(state(run, `nacha.${id}`)).toBe("not-evaluated");
        expect(run.results.some(r => r.ruleId === `nacha.${id}` && r.outcome === "PASS")).toBe(true);
      }
    }
  });
  it.each([EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK])("withholds partial batch hash PASS in $id", pack => {
    for (const rowIndex of [2, 5]) {
      const rows = buildNacha([{}, {}]); rows[rowIndex] = field(rows[rowIndex]!, 4, 11, "X2100002");
      const run = ach(rows, pack); expect(run.verdict).toBe("FAIL");
      expect(state(run,"nacha.batch-hash")).toBe("not-evaluated");
    }
  });
  it("preserves a real batch control failure alongside an unassessed batch", () => {
    const rows = buildNacha([{}, {}]); rows[3] = field(rows[3]!, 33, 44, "000000000001"); rows[5] = field(rows[5]!,30,39,"NOTAMOUNT!");
    const run=ach(rows); expect(state(run,"nacha.batch-credit")).toBe("failed");
    expect(run.results.some(r=>r.ruleId==="nacha.batch-credit"&&r.outcome==="ERROR")).toBe(true);
  });
  it("separates unknown entry-type prerequisites from optional absence", () => {
    const rows = buildNacha([{sec:"WEB",codes:["22","22"]}]);rows[3]=field(rows[3]!,2,3,"99");
    const run=ach(rows,EXPANDED_NACHA_PACK);
    for(const id of ["entry-amount","sec-transaction","web-credit-originator"]) expect(state(run,`nacha.${id}`)).toBe("not-evaluated");
    expect(state(ach(buildNacha(),EXPANDED_NACHA_PACK),"nacha.web-credit-originator")).toBe("not-applicable");
  });
  it("retains evaluated healthcare occurrences while exposing incomplete scope", () => {
    for (const badEntry of [2,4]) {
      const rows=buildNacha([{addenda:[1,1],codes:["22","22"]}]);rows[1]=field(rows[1]!,54,63,"HCCLAIMPMT");
      for(const i of [3,5]) rows[i]=field(rows[i]!,4,83,"TRN*1*TRACE*COMPANY~".padEnd(80));
      rows[badEntry]=field(rows[badEntry]!,2,3,"99");
      const run=ach(rows,ORIGINATION_R2_PACK);
      for(const id of ["healthcare-addenda","healthcare-trn"]) {
        expect(state(run,`nacha.${id}`)).toBe("not-evaluated");
        expect(run.results.some(r=>r.ruleId===`nacha.${id}`&&r.outcome==="PASS")).toBe(true);
      }
    }
  });
  it("marks a valid weekend check incomplete when another effective date is malformed", () => {
    const rows=buildNacha([{},{}]);rows[4]=field(rows[4]!,70,75,"261332");
    expect(state(ach(rows),"nacha.effective-weekend")).toBe("not-evaluated");
  });
  it.each([false,true])("marks CSV dependent checks incomplete after wrong-width row, INT=%s", intl => {
    const good=wireFixture(intl), bad=wireFixture(!intl)+',""';
    for(const rows of [[good,bad],[bad,good]]) {
      const source=rows.join("\n");const run=validateSource("synthetic.csv",source,CSV_WIRE_PACK);
      expect(run.verdict).toBe("FAIL");expect(state(run,"wire.layout")).toBe("failed");
      expect(state(run,"wire.amount")).toBe("not-evaluated");
      expect(run.results.some(r=>r.ruleId==="wire.amount"&&r.outcome==="PASS")).toBe(true);
      expect(state(run,"wire.characters")).toBe("passed");
    }
  });
  it("does not mark unknown CSV optional fields not applicable", () => {
    const source=wireFixture()+',""';const parsed=parseCsvWire(source,CSV_WIRE_PACK);
    expect(parsed.notApplicable).not.toContain("wire.fx");
    expect(state(validateSource("synthetic.csv",source,CSV_WIRE_PACK),"wire.fx")).toBe("not-evaluated");
    expect(state(validateSource("synthetic.csv",wireFixture(),CSV_WIRE_PACK),"wire.fx")).toBe("not-applicable");
  });
  it("preserves real CSV failure with another skipped row", () => {
    const fields=wireFixture().split(",");fields[2]='"bad-amount"';
    const run=validateSource("synthetic.csv",fields.join(",")+"\n"+wireFixture()+',""',CSV_WIRE_PACK);
    expect(state(run,"wire.amount")).toBe("failed");expect(run.verdict).toBe("FAIL");
  });
  it("bounds incompleteness metadata by rule count rather than entity count", () => {
    const rows=buildNacha(Array.from({length:100},()=>({})));
    for(let i=2;i<302;i+=3) if(rows[i]?.startsWith("6")) rows[i]=field(rows[i]!,30,39,"NOTAMOUNT!");
    const parsed=parseNacha(rows.join("\n"),ordinary);
    expect(parsed.incompleteChecks?.length).toBeGreaterThan(0);
    expect(new Set(parsed.incompleteChecks?.map(c=>c.ruleId)).size).toBe(parsed.incompleteChecks?.length);
    expect(parsed.incompleteChecks!.length).toBeLessThan(10);
  });
});

it("reports CTX prerequisite incompleteness without deleting a real successful payload check", () => {
  for (const badIndex of [3, 5]) {
    const rows=buildNacha([{sec:"CTX",codes:["22","22"],addenda:[1,1]}]);
    for(const i of [3,5]) rows[i]=field(rows[i]!,4,83,"ST*820*1~BPR*C*1.00*C*ACH~SE*3*1~".padEnd(80));
    rows[badIndex]=field(rows[badIndex]!,2,3,"99");
    const run=ach(rows,EXPANDED_NACHA_PACK);
    expect(state(run,"nacha.ctx-remittance")).toBe("not-evaluated");
    expect(run.checks?.find(c=>c.ruleId==="nacha.ctx-remittance")?.reason).toBeTruthy();
    expect(run.results.some(r=>r.ruleId==="nacha.ctx-remittance"&&r.outcome==="PASS")).toBe(true);
    expect(run.verdict).toBe("FAIL");
  }
});

it("has bounded CSV incompleteness for many malformed rows and no false optional absence", () => {
  const bad=wireFixture()+',""';
  const parsed=parseCsvWire(Array(100).fill(bad).join("\n"),CSV_WIRE_PACK);
  expect(parsed.incompleteChecks).toHaveLength(12);
  expect(new Set(parsed.incompleteChecks?.map(c=>c.ruleId)).size).toBe(12);
  expect(parsed.notApplicable).toEqual([]);
  expect(parsed.results.filter(r=>r.ruleId==="wire.layout")).toHaveLength(1);
});

// A known non-WEB SEC makes the WEB-only field inapplicable even when direction is unknown.
it.each([EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK])("keeps non-WEB unknown codes inapplicable in $id", pack => {
  for (const sec of ["CCD", "PPD", "CTX"]) {
    for (const codes of [["99", "22"], ["22", "99"]]) {
      const run = ach(buildNacha([{sec, codes}]), pack);
      expect(state(run, "nacha.web-credit-originator")).toBe("not-applicable");
      expect(state(run, "nacha.entry-amount")).toBe("not-evaluated");
      expect(run.verdict).toBe("FAIL");
    }
  }
});
