import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORIGINATION_R2_PACK } from "../src/format-packs";
import { parseNacha, NACHA_ORIGINATION_R2_RULE_IDS } from "../src/parsers/nacha";
import { frameFixedRecords, slice, type RecordRow } from "../src/parsers/fixed-record";
import {
  ARC_R2_DEFINITION, BOC_R2_DEFINITION, CIE_R2_DEFINITION, POP_R2_DEFINITION,
  NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS, NACHA_R2_ADDITIONAL_SEC_REUSED_HOOK_IDS,
  type AdditionalR2CheckId, type AdditionalR2Sec, type R2SecBatch, type R2SecChecks,
} from "../src/parsers/nacha-r2-additional-sec";
import { field } from "./nacha-builder";
import { buildSecNacha, type SecBatchSpec } from "./nacha-r2-sec-builder";

// TEST adapter only. Production profile registration/dispatch is blocked on #76.
const definitions = [CIE_R2_DEFINITION, ARC_R2_DEFINITION, BOC_R2_DEFINITION, POP_R2_DEFINITION];
const checksSecs = ["ARC", "BOC", "POP"] as const;
const allSecs = ["CIE", ...checksSecs] as const;
const directory = "tests/fixtures/nacha-r2-sec";
interface Observation { id: AdditionalR2CheckId; ok: boolean; warning: boolean; row: RecordRow; from: number; to: number; message: string }
function collector() {
  const observations: Observation[] = [];
  const incomplete = new Set<AdditionalR2CheckId>();
  const sink: R2SecChecks = {
    check(id, ok, _field, message, row, from, to, warning = false) { observations.push({ id, ok, warning, row, from, to, message }); },
    incomplete(id, reason) { expect(reason.length).toBeGreaterThan(0); incomplete.add(id); },
  };
  return { observations, incomplete, sink,
    failures: () => observations.filter(check => !check.ok),
    state: (id: AdditionalR2CheckId) => {
      const calls = observations.filter(check => check.id === id);
      return calls.some(check => !check.ok && !check.warning) ? "ERROR" : calls.some(check => !check.ok) ? "WARNING" : incomplete.has(id) ? "INCOMPLETE" : calls.length ? "PASS" : "ABSENT";
    },
  };
}
function batches(source: string): R2SecBatch[] {
  const framed = frameFixedRecords(source, 94);
  expect(framed.framing && !framed.badWidth).toBe(true);
  const result: R2SecBatch[] = [];
  let batch: { header: RecordRow; entries: { entry: RecordRow; addenda: RecordRow[] }[] } | undefined;
  for (const row of framed.rows) {
    if (row.text[0] === "5") batch = { header: row, entries: [] };
    else if (row.text[0] === "6") batch!.entries.push({ entry: row, addenda: [] });
    else if (row.text[0] === "7") batch!.entries.at(-1)!.addenda.push(row);
    else if (row.text[0] === "8") { result.push(batch!); batch = undefined; }
  }
  return result;
}
function run(source: string) {
  const output = collector();
  const selected: string[] = [];
  for (const batch of batches(source)) {
    const definition = definitions.find(item => item.sec === slice(batch.header, 51, 53));
    if (definition) { selected.push(definition.sec); definition.validateBatch(batch, output.sink); }
  }
  return { ...output, selected };
}
const one = (spec: SecBatchSpec) => buildSecNacha([spec]).join("\n");
const mutateEntry = (source: string, from: number, to: number, value: string): string => {
  const rows = source.split("\n"); rows[2] = field(rows[2]!, from, to, value); return rows.join("\n");
};
const mutateAddenda = (from: number, to: number, value: string): string => {
  const rows = buildSecNacha([{ sec: "CIE", addenda: [1] }]); rows[3] = field(rows[3]!, from, to, value); return rows.join("\n");
};

describe("independent SEC definitions pending registry integration", () => {
  it("exports four distinct new IDs and reuses existing IDs without activating the pack", () => {
    expect(new Set(NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS).size).toBe(4);
    for (const id of NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS) expect(NACHA_ORIGINATION_R2_RULE_IDS).not.toContain(id);
    for (const id of NACHA_R2_ADDITIONAL_SEC_REUSED_HOOK_IDS) expect(NACHA_ORIGINATION_R2_RULE_IDS).toContain(id);
    for (const definition of definitions) expect(Object.isFrozen(definition)).toBe(true);
    for (const sec of allSecs) expect(parseNacha(one({ sec }), ORIGINATION_R2_PACK).results.find(rule => rule.ruleId === "nacha.sec-code")?.outcome).toBe("ERROR");
  });
  it.each(allSecs)("refuses misdispatch or malformed envelopes for %s without PASS", sec => {
    const definition = definitions.find(item => item.sec === sec)!;
    const batch = batches(one({ sec }))[0]!;
    for (const invalid of [
      { ...batch, header: { ...batch.header, text: field(batch.header.text, 51, 53, "RCK") } },
      { ...batch, entries: [] },
      { ...batch, entries: [{ entry: { ...batch.entries[0]!.entry, text: "6" }, addenda: [] }] },
    ]) {
      const output = collector(); definition.validateBatch(invalid, output.sink);
      expect(output.observations).toHaveLength(0); expect(output.incomplete.size).toBeGreaterThan(0);
    }
  });
  it.each(readdirSync(directory).filter(name => name.endsWith("-valid.ach")))("evaluates checked-in %s", name => {
    const output = run(readFileSync(`${directory}/${name}`, "utf8"));
    expect(output.selected.length).toBeGreaterThan(0);
    expect(output.failures()).toEqual([]); expect([...output.incomplete]).toEqual([]);
  });
  it.each([
    ["cie", "cie-identification", 55, 76], ["arc", "check-serial", 40, 54],
    ["boc", "check-amount-limit", 30, 39], ["pop", "pop-terminal", 49, 52],
  ] as const)("finds the intended malformed %s field with its exact columns", (name, id, from, to) => {
    const output = run(readFileSync(`${directory}/${name}-invalid.ach`, "utf8"));
    expect(output.failures().map(check => check.id)).toEqual([id]);
    expect(output.failures()[0]).toMatchObject({ from, to, row: { number: 3 }, warning: false });
  });
});

describe("CIE name and biller identification", () => {
  it("uses 15 name columns and 22 ID columns, and accepts full-width alphanumeric IDs", () => {
    const source = one({ sec: "CIE", names: ["N".repeat(15)], identifications: ["0".repeat(21) + "A"] });
    expect(run(source).failures()).toEqual([]);
    expect(run(mutateEntry(source, 40, 54, " ".repeat(15))).state("entry-required")).toBe("ERROR");
    expect(run(mutateEntry(source, 55, 76, " ".repeat(22))).state("cie-identification")).toBe("ERROR");
  });
  it.each(["", "0".repeat(22)])("rejects missing/all-zero identification %j", identification => {
    expect(run(one({ sec: "CIE", identifications: [identification] })).state("cie-identification")).toBe("ERROR");
  });
  it("does not extend R26 to all-zero names, punctuation or space-padded short zero IDs", () => {
    for (const identification of ["000A", "INV-1/2", "0"]) expect(run(one({ sec: "CIE", names: ["0".repeat(15)], identifications: [identification] })).failures()).toEqual([]);
  });
});

describe("check-conversion fields and amount", () => {
  it.each(checksSecs)("keeps the %s receiver name and discretionary data optional", sec => {
    let source = one({ sec, names: [""] }); source = mutateEntry(source, 77, 78, "AB");
    const output = run(source);
    expect(output.failures()).toEqual([]);
    expect(output.state("cie-identification")).toBe("ABSENT");
  });
  it.each(checksSecs)("checks %s serial content without inventing a numeric-only rule", sec => {
    const width = sec === "POP" ? 9 : 15;
    for (const serial of ["000123", "A-123", "1".repeat(width), "0"]) expect(run(one({ sec, serials: [serial] })).failures()).toEqual([]);
    for (const serial of ["", "0".repeat(width)]) expect(run(one({ sec, serials: [serial] })).state("check-serial")).toBe("ERROR");
  });
  it.each(checksSecs)("checks both sides of %s's $25,000 limit in exact cents", sec => {
    for (const amount of [1n, 2_499_999n, 2_500_000n]) expect(run(one({ sec, amounts: [amount] })).state("check-amount-limit")).toBe("PASS");
    for (const amount of [2_500_001n, 9_999_999_999n]) expect(run(one({ sec, amounts: [amount] })).state("check-amount-limit")).toBe("ERROR");
    expect(run(one({ sec, amounts: [0n] })).state("entry-amount")).toBe("ERROR");
    expect(run(one({ sec, codes: ["28"], amounts: [0n] })).failures()).toEqual([]);
    expect(run(one({ sec, codes: ["28"], amounts: [1n] })).state("entry-amount")).toBe("ERROR");
  });
  it.each(checksSecs)("does not report an evaluated %s limit on malformed amount", sec => {
    const output = run(mutateEntry(one({ sec }), 30, 39, "0000000X00"));
    expect(output.state("entry-amount")).toBe("ERROR");
    expect(output.state("check-amount-limit")).toBe("INCOMPLETE");
    expect(output.observations.some(check => check.id === "check-amount-limit")).toBe(false);
  });
  it("isolates POP's three adjacent fields and avoids an invented city/state allowlist", () => {
    const source = one({ sec: "POP", serials: ["S".repeat(9)], terminalCities: ["NYC1"], terminalStates: ["ZZ"] });
    expect(run(source).failures()).toEqual([]);
    for (const [from, to] of [[40, 48], [49, 52], [53, 54]] as const) {
      for (const filler of [" ", "0"]) {
        const output = run(mutateEntry(source, from, to, filler.repeat(to - from + 1)));
        expect(output.failures()).toHaveLength(1); expect(output.failures()[0]).toMatchObject({ from, to });
      }
    }
    expect(run(mutateEntry(source, 49, 52, " NYC")).state("field-padding")).toBe("ERROR");
  });
  it("does not apply the conversion amount ceiling to CIE", () => {
    const output = run(one({ sec: "CIE", amounts: [2_500_001n] }));
    expect(output.failures()).toEqual([]); expect(output.state("check-amount-limit")).toBe("ABSENT");
  });
});

describe("transaction directions, exceptions and unevaluated prerequisites", () => {
  it.each(["22", "23", "32", "33", "52", "53"])("accepts CIE code %s with ordinary or prenote amount", code => {
    expect(run(one({ sec: "CIE", codes: [code], service: "200" })).failures()).toEqual([]);
  });
  it.each(["27", "37", "55"])("accepts a declared monetary CIE reversal %s", code => {
    expect(run(one({ sec: "CIE", codes: [code], description: "XXREVERSAL" })).failures()).toEqual([]);
  });
  it.each(checksSecs)("does not invent a checking-only %s prohibition", sec => {
    for (const code of ["27", "28", "37", "38"]) expect(run(one({ sec, codes: [code] })).failures()).toEqual([]);
    for (const code of ["22", "32"]) expect(run(one({ sec, codes: [code], description: "REVERSAL" })).failures()).toEqual([]);
  });
  it.each(allSecs)("rejects a one-direction non-reversal %s batch in the wrong direction", sec => {
    const code = sec === "CIE" ? "27" : "22";
    for (const service of [sec === "CIE" ? "225" : "220", "200"]) expect(run(one({ sec, codes: [code], service })).state("sec-transaction")).toBe("ERROR");
  });
  it.each(allSecs)("keeps service-class direction conflicts hard errors for %s", sec => {
    expect(run(one({ sec, service: sec === "CIE" ? "225" : "220" })).state("sec-transaction")).toBe("ERROR");
    expect(run(one({ sec, codes: ["22", "27"], service: "220" })).state("sec-transaction")).toBe("ERROR");
  });
  it.each(allSecs)("rejects remittance-only codes in %s, distinct from zero prenotes", sec => {
    for (const code of ["24", "29", "34", "39", "54"]) expect(run(one({ sec, codes: [code] })).state("sec-transaction")).toBe("ERROR");
  });
  it.each(allSecs)("does not pretend a %s prenote is a monetary reversal", sec => {
    expect(run(one({ sec, codes: [sec === "CIE" ? "23" : "28"], description: "REVERSAL" })).state("reversal-transaction")).toBe("ERROR");
  });
  it("fails a lowercase declaration and withholds its dependent direction/reversal checks", () => {
    const output = run(one({ sec: "CIE", codes: ["27"], description: "reversal" }));
    expect(output.state("reversal-marker")).toBe("ERROR");
    expect(output.state("sec-transaction")).toBe("INCOMPLETE");
    expect(output.state("reversal-transaction")).toBe("INCOMPLETE");
  });
  it.each(allSecs)("does not produce new field/amount/direction PASS for unknown %s transaction codes", sec => {
    for (const code of ["99", "42"]) {
      const output = run(mutateEntry(one({ sec }), 2, 3, code));
      expect(output.state("entry-amount")).toBe("INCOMPLETE");
      expect(output.state("sec-transaction")).toBe("INCOMPLETE");
      expect(output.state(sec === "CIE" ? "cie-identification" : "check-serial")).toBe("INCOMPLETE");
      expect(output.state("addenda-count")).toBe("INCOMPLETE");
    }
  });
  it("does not evaluate direction on an unknown service class", () => {
    expect(run(one({ sec: "CIE", service: "999" })).state("sec-transaction")).toBe("INCOMPLETE");
  });
});

describe("bank offset ambiguity", () => {
  it.each(allSecs)("warns on %s mixed directions without inventing an OFFSET exemption", sec => {
    const codes = sec === "CIE" ? ["22", "27"] : ["27", "22"];
    const rows = buildSecNacha([{ sec, codes, amounts: [1n, 3_000_000n] }]);
    rows[3] = field(rows[3]!, 40, 76, " ".repeat(37));
    const output = run(rows.join("\n"));
    expect(output.failures().map(check => [check.id, check.warning])).toEqual([["sec-transaction", true]]);
    expect(output.state(sec === "CIE" ? "cie-identification" : "check-serial")).toBe("INCOMPLETE");
    if (sec !== "CIE") expect(output.state("check-amount-limit")).toBe("INCOMPLETE");
    expect(output.state("addenda-count")).toBe("INCOMPLETE");
    // Evidence from the valid sibling is retained, but aggregate state is incomplete.
    expect(output.observations.some(check => check.ok && check.id === (sec === "CIE" ? "cie-identification" : "check-serial"))).toBe(true);
  });
  it("withholds SEC-specific assumptions when an unknown sibling may conceal an offset", () => {
    const rows = buildSecNacha([{ sec: "POP", codes: ["27", "22"], amounts: [1n, 3_000_000n] }]);
    rows[2] = field(rows[2]!, 2, 3, "99"); rows[3] = field(rows[3]!, 40, 76, " ".repeat(37));
    const output = run(rows.join("\n"));
    expect(output.failures()).toEqual([]);
    for (const id of ["sec-transaction", "check-serial", "check-amount-limit", "pop-terminal"] as const) expect(output.state(id)).toBe("INCOMPLETE");
  });
  it("still detects generic addenda-indicator inconsistency on an ambiguous offset", () => {
    const rows = buildSecNacha([{ sec: "ARC", codes: ["27", "22"] }]); rows[3] = field(rows[3]!, 79, 79, "1");
    expect(run(rows.join("\n")).state("addenda-indicator")).toBe("ERROR");
  });
});

describe("addenda constraints and source coordinates", () => {
  it("allows optional CIE addenda, including an empty optional information field", () => {
    for (const addenda of [0, 1]) expect(run(one({ sec: "CIE", addenda: [addenda], addendaPayloads: [""] })).failures()).toEqual([]);
    expect(run(one({ sec: "CIE", addenda: [2] })).state("addenda-count")).toBe("ERROR");
  });
  it.each(["98", "99", "XX"])("does not validate type-%s as a CIE payment-addenda layout", type => {
    const output = run(mutateAddenda(2, 3, type));
    expect(output.state("addenda-type")).toBe("ERROR");
    expect(output.state("addenda-sequence")).toBe("INCOMPLETE");
    expect(output.state("addenda-link")).toBe("INCOMPLETE");
  });
  it("requires CIE sequence0001 and linkage to the parent entry trace", () => {
    expect(run(mutateAddenda(84, 87, "0002")).state("addenda-sequence")).toBe("ERROR");
    expect(run(mutateAddenda(88, 94, "0000002")).state("addenda-link")).toBe("ERROR");
    expect(run(mutateEntry(one({ sec: "CIE", addenda: [1] }), 88, 94, "000000X")).state("addenda-link")).toBe("INCOMPLETE");
  });
  it.each(checksSecs)("prohibits %s addenda without fake passing addenda-layout checks", sec => {
    const output = run(one({ sec, addenda: [1] }));
    expect(output.state("addenda-count")).toBe("ERROR"); expect(output.state("addenda-indicator")).toBe("ERROR");
    for (const id of ["addenda-type", "addenda-sequence", "addenda-link"] as const) expect(output.state(id)).toBe("ABSENT");
    expect(run(mutateEntry(one({ sec, addenda: [1] }), 79, 79, "0")).state("addenda-count")).toBe("ERROR");
  });
  it.each(allSecs)("rejects inconsistent %s indicators, including nonbinary values", sec => {
    for (const indicator of ["1", "2", " "]) expect(run(mutateEntry(one({ sec }), 79, 79, indicator)).state("addenda-indicator")).toBe("ERROR");
  });
  it.each(["\n", "\r\n", "\r", ""])("preserves exact columns with delimiter %j", delimiter => {
    const records = buildSecNacha([{ sec: "CIE" }, { sec: "POP", terminalStates: [""] }]);
    const source = records.join(delimiter); const failure = run(source).failures()[0]!;
    expect(failure).toMatchObject({ id: "pop-terminal", from: 53, to: 54, row: { number: 6 } });
    expect(source.slice(failure.row.start + failure.from - 1, failure.row.start + failure.to)).toBe("  ");
  });
});

describe("shared checks and existing SEC regression boundaries", () => {
  it("selects the correct independent definition for every target batch in both orders", () => {
    const specs: SecBatchSpec[] = allSecs.map(sec => ({ sec, ...(sec === "CIE" ? {} : { names: [""] }) }));
    for (const order of [specs, [...specs].reverse()]) {
      const output = run(buildSecNacha(order).join("\n"));
      expect(output.selected).toEqual(order.map(spec => spec.sec)); expect(output.failures()).toEqual([]);
      expect(output.observations.filter(check => check.id === "cie-identification")).toHaveLength(1);
      expect(output.observations.filter(check => check.id === "pop-terminal")).toHaveLength(2);
    }
  });
  it("keeps real shared structure, routing, trace and controls valid for the nine-SEC fixture", () => {
    const source = readFileSync(`${directory}/mixed-valid.ach`, "utf8");
    const output = run(source); expect(output.selected).toEqual(["CIE", "ARC", "BOC", "POP"]); expect(output.failures()).toEqual([]);
    // This does NOT assert end-to-end integration: current parser still rejects the four new SECs.
    const shared = parseNacha(source, ORIGINATION_R2_PACK);
    for (const id of ["framing", "ascii", "record-order", "blocking", "service-class", "routing", "trace", "trace-order", "trace-unique", "batch-mirror", "batch-count", "batch-hash", "batch-debit", "batch-credit", "file-batches", "file-blocks", "file-count", "file-hash", "file-debit", "file-credit"])
      expect(shared.results.find(check => check.ruleId === `nacha.${id}`)?.outcome, id).toBe("PASS");
  });
  it.each(["CCD", "PPD", "CTX", "WEB", "TEL"])("leaves %s results and applicability with the existing parser", sec => {
    const source = one({ sec, ...(sec === "CTX" ? { addenda: [1], addendaPayloads: ["ST*813*1~BPS*1~SE*3*1~"] } : {}) });
    const existing = parseNacha(source, ORIGINATION_R2_PACK);
    expect(existing.results.every(check => check.outcome === "PASS")).toBe(true);
    expect(run(source).observations).toEqual([]); expect(run(source).selected).toEqual([]);
    expect(existing.results.some(check => (NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS as readonly string[]).includes(check.ruleId))).toBe(false);
  });
  it.each(["RCK", "IAT", "ADV"])("does not add a %s profile", sec => {
    expect(run(one({ sec })).selected).toEqual([]);
  });
});
