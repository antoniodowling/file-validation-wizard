import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BAI2_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";

const run = (source: string) => validateSource("synthetic-signs.bai2", source, BAI2_PACK);
// Independent fixture oracle: explicit status + summary + detail, no production helpers.
const document = (status = "-20", summary = "+30", detail = "+5", control?: string, code = "010") => {
  const sum = BigInt(status || "0") + BigInt(summary || "0") + BigInt(detail || "0");
  const total = control ?? String(sum);
  return ["01,SYNTHETIC,SYNTHETIC,261029,1200,1,,,2/", "02,,SYNTHETIC,1,261028,,USD,2/",
    `03,123456,USD,${code},${status},0,,100,${summary},0,/`, `16,206,${detail}/`,
    `49,${total},3/`, `98,${total},1,5/`, `99,${total},1,7/`].join("\n");
};
const state = (report: ReturnType<typeof run>, rule: string) => report.checks?.find(c => c.ruleId === `bai2.${rule}`)?.state;

describe("BAI Version 2 amount class signs (October 2005, printed page 25)", () => {
  for (const kind of ["status", "summary", "detail"] as const) {
    for (const token of ["7", "+7", "-7", "0", "+0", "-0"]) {
      const accepted = kind === "status" || !token.startsWith("-");
      it(`${kind} ${token}: ${accepted ? "accept" : "reject"} lexical sign`, () => {
        const source = document(kind === "status" ? token : "-20", kind === "summary" ? token : "30", kind === "detail" ? token : "5");
        const report = run(source);
        expect(report.overallStatus).toBe(accepted ? "PASS" : "FAIL");
        expect(state(report, "account-total")).toBe(accepted ? "passed" : "not-evaluated");
        expect(state(report, "group-total")).toBe("passed");
        expect(state(report, "file-total")).toBe("passed");
        if (!accepted) {
          const result = report.results.find(r => r.ruleId === "bai2.amount" && r.outcome === "ERROR");
          expect(result).toBeDefined();
          if (result?.location?.kind === "located") expect(source.slice(result.location.primary.span.start, result.location.primary.span.end)).toBe(token);
        }
      });
    }
  }
  for (const record of ["49", "98", "99"]) for (const token of ["7", "+7", "-7", "0", "+0", "-0"]) {
    it(`${record} control ${token}: accepts signed syntax and reconciles exactly`, () => {
      const total = String(BigInt(token));
      const source = document(total, "0", "0").replace(`${record},${total},`, `${record},${token},`);
      expect(run(source).overallStatus).toBe("PASS");
    });
  }
  // These are explicit source-derived classes, not generated from the implementation registry.
  it.each(["010", "015", "040", "045", "060"])("status code %s allows a negative value", code => {
    expect(run(document("-20", "30", "5", undefined, code)).overallStatus).toBe("PASS");
  });
  it.each(["100", "180", "182", "240", "241", "353", "383", "400"])("selected non-status 03 code %s rejects a negative value", code => {
    const report = run(document("-20", "30", "5", undefined, code));
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
  });
  it("rejects the recorded negative-detail probe despite adjusted controls", () => {
    const source = readFileSync("demo-files/bai2/balances-pass.bai2", "utf8").replace("16,206,50", "16,206,-50").replaceAll(",370,", ",270,");
    const report = run(source);
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
  });
  it.each(["", "+", "-", "1.0", "x", "++1"])("malformed required control %j suppresses only actual dependencies", token => {
    const source = document("20", "30", "5").replace("49,55,", `49,${token},`);
    const report = run(source);
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
    expect(state(report, "group-total")).toBe("not-evaluated");
    expect(state(report, "file-total")).toBe("passed");
  });
  it.each(["49", "98", "99"])("signs remain invalid on %s counts", record => {
    const source = document("20", "30", "5").replace(new RegExp(`(${record},55,)([0-9]+)`), "$1+$2");
    const report = run(source);
    expect(report.overallStatus).toBe("FAIL");
    expect(report.results.some(r => r.ruleId === "bai2.trailer-fields" && r.outcome === "ERROR")).toBe(true);
  });
  it("retains exact arithmetic above 2^53 and catches a one-unit mismatch", () => {
    const source = document("-900719925474099312345", "+900719925474099312350", "+5");
    expect(run(source).overallStatus).toBe("PASS");
    expect(run(source.replace("49,10,", "49,11,")).overallStatus).toBe("FAIL");
  });
  it.each(["", "+", "-"])("counts digits independently of %j sign at the local 40-digit limit", sign => {
    const amount = sign + "9".repeat(40);
    expect(run(document(amount, "0", "0")).overallStatus).toBe("PASS");
    const report = run(document(sign + "9".repeat(41), "0", "0"));
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
  });
  it("keeps omitted optional amounts valid", () => expect(run(document("", "", "")).overallStatus).toBe("PASS"));
  it("locates and sums a signed amount carried on 88 exactly once", () => {
    const source = document().replace("100,+30,0,/", "100,/\n88,+30,0,/").replace("49,15,3/", "49,15,4/").replace("98,15,1,5/", "98,15,1,6/").replace("99,15,1,7/", "99,15,1,8/");
    expect(run(source).overallStatus).toBe("PASS");
    const invalid = source.replace("88,+30", "88,-30");
    const report = run(invalid);
    expect(report.overallStatus).toBe("FAIL");
    const result = report.results.find(r => r.ruleId === "bai2.amount" && r.outcome === "ERROR");
    if (result?.location?.kind === "located") expect(invalid.slice(result.location.primary.span.start, result.location.primary.span.end)).toBe("-30");
    else throw new Error("Expected located amount failure");
  });
  it("does not claim a class-aware amount pass for a code at the wrong level", () => {
    const report = run(document("-20", "30", "5", undefined, "206"));
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
    expect(state(report, "amount")).toBe("not-evaluated");
    expect(report.results.filter(r => r.ruleId === "bai2.amount" && r.locator?.includes("Field 5"))).toEqual([]);
  });
  it.each(["summary", "detail"])("preserves the digit limit on positive %s amounts", kind => {
    for (const sign of ["", "+"]) {
      const amount = sign + "9".repeat(40);
      const source = document("0", kind === "summary" ? amount : "0", kind === "detail" ? amount : "0");
      expect(run(source).overallStatus).toBe("PASS");
      expect(run(source.replace(amount, sign + "9".repeat(41))).overallStatus).toBe("FAIL");
    }
  });
  it.each(["1.2", "abc", "--1", "+-1"])("does not reconcile an uninterpretable data amount %j", token => {
    const source = document("20", "30", "5").replace("100,30", `100,${token}`);
    const report = run(source);
    expect(report.overallStatus).toBe("FAIL");
    expect(state(report, "account-total")).toBe("not-evaluated");
    expect(state(report, "group-total")).toBe("passed");
  });
  it("reconciles signed multi-account/group totals from independent explicit arithmetic", () => {
    // Group one: (-100 + 30 + 5) + (20 + 30 + 5) = -10.
    // Group two: -40 + 30 + 5 = -5. File: -10 + -5 = -15.
    const one = document("-100", "+30", "+5").split("\n");
    const two = document("+20", "+30", "+5").split("\n");
    const three = document("-40", "+30", "+5").split("\n");
    const source = [one[0], one[1], ...one.slice(2, 5), ...two.slice(2, 5), "98,-10,2,8/",
      three[1], ...three.slice(2, 5), "98,-5,1,5/", "99,-15,2,15/"].join("\n");
    expect(run(source).overallStatus).toBe("PASS");
    expect(run(source.replace("99,-15", "99,-14")).overallStatus).toBe("FAIL");
  });
  it("does not reconcile group/file totals when the group control is invalid", () => {
    const report = run(document("20", "30", "5").replace("98,55", "98,abc"));
    expect(state(report, "account-total")).toBe("passed");
    expect(state(report, "group-total")).toBe("not-evaluated");
    expect(state(report, "file-total")).toBe("not-evaluated");
  });
  it.each(["49", "98", "99"])("rejects negative counts on %s", record => {
    const report = run(document("20", "30", "5").replace(new RegExp(`(${record},55,)([0-9]+)`), "$1-$2"));
    expect(report.overallStatus).toBe("FAIL");
    expect(report.results.some(r => r.ruleId === "bai2.trailer-fields" && r.outcome === "ERROR")).toBe(true);
  });
  for (const reverse of [false, true]) for (const damaged of ["data", "account", "group"]) {
    it(`preserves incomplete ${damaged} totals with valid siblings (reverse=${reverse})`, () => {
      const good = document("20", "30", "5").split("\n").slice(1, -1);
      const bad = [...good];
      if (damaged === "data") bad[2] = "16,206,-5/";
      else if (damaged === "account") bad[3] = "49,abc,3/";
      else bad[4] = "98,abc,1,5/";
      const source = ["01,SYNTHETIC,SYNTHETIC,261029,1200,1,,,2/", ...(reverse ? [...bad, ...good] : [...good, ...bad]), "99,110,2,12/"].join("\n");
      const report = run(source);
      expect(report.overallStatus).toBe("FAIL");
      const affected = damaged === "data" ? ["account-total"] : damaged === "account" ? ["account-total", "group-total"] : ["group-total", "file-total"];
      for (const id of affected) expect(state(report, id)).toBe("not-evaluated");
      const otherGood = source.replaceAll("16,206,5/", "16,206,6/");
      if (damaged !== "group") expect(state(run(otherGood), "account-total")).toBe("failed");
    });
  }
});
