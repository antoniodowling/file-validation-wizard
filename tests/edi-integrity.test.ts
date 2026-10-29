import { describe, expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { parseEdi } from "../src/parsers/edi";
import { scanEdiSegments } from "../src/parsers/edi-source";
import { validateSource } from "../src/validation";
import { validEdi820 } from "./helpers";
const pack = (version = "005010") => FORMAT_PACKS.find(p => p.id === `edi-820-${version}`)!;
const run = (source: string, version = "005010") => validateSource("synthetic.edi", source, pack(version));
const envelope = (isa: string, gs: string) => validEdi820.replace("*00501*", `*${isa}*`).replaceAll("005010", gs);
describe("independent EDI version and delimiter regression matrix", () => {
  for (const isa of ["00501", "00803"]) it(`contains unqualified ${isa}/008030`, () => {
    const result = run(envelope(isa, "008030"), "008030");
    expect(result.overallStatus).toBe("UNSUPPORTED");
    expect(result.verdict).toBeNull();
    expect(result.executionReason).toMatch(/008030.*qualif/i);
    expect(result.checks?.find(check => check.ruleId === "edi.version")?.state).toBe("not-evaluated");
    expect(result.results.some(r => r.ruleId === "edi.version" && r.outcome === "PASS")).toBe(false);
  });
  for (const term of ["~", "\n", "\r"]) {
    const source = validEdi820.replaceAll("~", term);
    for (const suffix of ["", "  "]) it(`accepts 005010 ${JSON.stringify(term)} suffix ${JSON.stringify(suffix)}`, () => {
      const result = run(source + suffix);
      expect(result.overallStatus).toBe("PASS");
      for (const id of ["edi.fixed-header", "edi.final-termination", "edi.group-count", "edi.segment-count", "edi.control-numbers"]) {
        expect(result.results.filter(r => r.ruleId === id).every(r => r.outcome === "PASS")).toBe(true);
      }
      const last = scanEdiSegments(source + suffix, "*", term).at(-1)!;
      expect(source.slice(last.span.start, last.span.end)).toBe("IEA*1*000000001");
    });
    it(`rejects missing final ${JSON.stringify(term)}`, () => {
      const result = run(source.slice(0, -1) + "  ");
      expect(result.overallStatus).toBe("FAIL");
      expect(result.results.find(r => r.ruleId === "edi.final-termination")?.outcome).toBe("ERROR");
    });
    it(`preserves group controls with ${JSON.stringify(term)}`, () => {
      const group = source.slice(source.indexOf("GS*"), source.indexOf("IEA*"));
      const multiple = source.replace("IEA*1*", `${group}IEA*2*`);
      expect(run(multiple).overallStatus).toBe("PASS");
      expect(run(multiple.replace("IEA*2*", "IEA*1*")).overallStatus).toBe("FAIL");
    });
  }
  for (const term of ["~", "\n", "\r"]) it(`preserves multiple transactions and their control errors with ${JSON.stringify(term)}`, () => {
    const tx = "ST*820*0002~BPR*C*1.00*C*ACH~SE*3*0002~";
    const source = validEdi820.replace("GE*1*1~", tx + "GE*2*1~").replaceAll("~", term);
    expect(run(source).overallStatus).toBe("PASS");
    expect(run(source.replace("SE*3*0002", "SE*3*9999")).overallStatus).toBe("FAIL");
  });
  it("does not mask a malformed second 008030 interchange behind unsupported", () => {
    const source = envelope("00501", "008030");
    expect(run(source + source.replace("SE*3*", "SE*9*"), "008030").overallStatus).toBe("FAIL");
  });
  for (const gs of ["003070", "004010"]) it(`contains older ${gs} groups in a 00501 envelope without calling them source-invalid`, () => {
    const result = run(envelope("00501", gs));
    expect(result.overallStatus).toBe("UNSUPPORTED");
    expect(result.verdict).toBeNull();
    expect(result.executionReason).toMatch(/older functional-group/i);
    expect(run(envelope("00501", gs).replace("SE*3*", "SE*9*")).overallStatus).toBe("FAIL");
  });
  it("keeps 004010 tilde support", () => expect(run(envelope("00401", "004010"), "004010").overallStatus).toBe("PASS"));
  it("does not qualify 004010 newline", () => expect(run(envelope("00401", "004010").replaceAll("~", "\n"), "004010").overallStatus).toBe("UNSUPPORTED"));
  it("does not infer CRLF qualification", () => expect(run(validEdi820.replaceAll("~", "\r\n")).overallStatus).toBe("UNSUPPORTED"));
  it("retains structural failures for 008030", () => {
    const source = envelope("00501", "008030");
    expect(run(source.replace("ISA", "BAD"), "008030").overallStatus).toBe("FAIL");
    expect(run(source.slice(0, -1), "008030").overallStatus).toBe("FAIL");
    expect(run(source.replace("SE*3*", "SE*9*"), "008030").overallStatus).toBe("FAIL");
  });
  it("rejects colliding delimiters", () => expect(run(validEdi820.slice(0, 104) + "*" + validEdi820.slice(105)).overallStatus).toBe("FAIL"));
  it("distinguishes complete versus malformed second interchanges", () => {
    expect(run(validEdi820 + validEdi820).overallStatus).toBe("UNSUPPORTED");
    expect(run(validEdi820 + validEdi820.replace("GS*", "XX*")).overallStatus).toBe("FAIL");
  });
  it("keeps CTX version bypass and transport separate", () => {
    expect(parseEdi(envelope("00501", "008030"), pack("008030"), true).context).not.toBeNull();
    expect(parseEdi(validEdi820.replaceAll("~", "\n"), pack(), true).context).toBeNull();
  });
});
