import { describe, expect, it } from "vitest";
import { FORMAT_PACKS, EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { buildNacha, field } from "./nacha-builder";
const ordinary = FORMAT_PACKS.find(p => p.id === "nacha-origination-public-2026")!;
const healthcare = (payload: string) => {
  const rows = buildNacha([{ addenda: [1] }]);
  rows[1] = field(rows[1]!, 54, 63, "HCCLAIMPMT");
  rows[3] = field(rows[3]!, 4, 83, payload.padEnd(80));
  return rows;
};
describe("independent review ACH scope and payload boundaries", () => {
  it.each(["REVERSAL", "REVERSAL42", "42REVERSAL", "reversal42", "42Reversal"])("withholds ordinary verdict for %s", description => {
    const rows = buildNacha(); rows[1] = field(rows[1]!, 54, 63, description.padEnd(10));
    const run = validateSource("synthetic.ach", rows.join("\n"), ordinary);
    expect(run.executionStatus).toBe("UNSUPPORTED"); expect(run.verdict).toBeNull(); expect(run.executionReason).toContain("reversal");
  });
  it("withholds a mixed ordinary/reversal file in either batch order", () => {
    for (const index of [1, 4]) {
      const rows = buildNacha([{}, {}]); rows[index] = field(rows[index]!,54,63,"REVERSAL42");
      expect(validateSource("synthetic.ach", rows.join("\n"), ordinary).verdict).toBeNull();
    }
  });
  it.each([EXPANDED_NACHA_PACK, ORIGINATION_R2_PACK])("retains expanded marker case checks in $id", pack => {
    for (const marker of ["REVERSAL42", "reversal42"]) {
      const rows = buildNacha(); rows[1] = field(rows[1]!,54,63,marker);
      const run = validateSource("synthetic.ach",rows.join("\n"),pack);
      expect(run.results.find(r=>r.ruleId==="nacha.reversal-marker")?.outcome).toBe(marker === "REVERSAL42" ? "PASS" : "ERROR");
    }
  });
  it.each(["~", "\\"])("admits generic TRN terminator %s with optional TRN04", term => {
    for (const extra of ["", "*", "*EXTRA"]) {
      const run = validateSource("synthetic.ach",healthcare(`TRN*1*TRACE*COMPANY${extra}${term}`).join("\n"),ORIGINATION_R2_PACK);
      expect(run.results.find(r=>r.ruleId==="nacha.healthcare-trn")?.outcome).toBe("PASS");
    }
  });
  it.each(["TRN*1*TRACE*COMPANY", "TRN*1*TRACE*COMPANY\\NTE*X~", "TRN*1*TRACE*COMPANY~NTE*X\\", "TRN*1*TR\\ACE*COMPANY~", "TRN*1*TRACE*COM~PANY\\"])("rejects incomplete or embedded TRN segments: %s", payload => {
    const run = validateSource("synthetic.ach",healthcare(payload).join("\n"),ORIGINATION_R2_PACK);
    expect(run.results.find(r=>r.ruleId==="nacha.healthcare-trn")?.outcome).toBe("ERROR");
  });
  it.each(["\n", "\r\n", ""])("locates healthcare payload context with %j framing", separator => {
    const rows = healthcare("TRN*1**COMPANY~"); const source=rows.join(separator);
    const found=validateSource("synthetic.ach",source,ORIGINATION_R2_PACK).results.find(r=>r.ruleId==="nacha.healthcare-trn")!;
    if(found.location?.kind!=="located") throw Error("Missing location");
    expect(found.location.primary.kind).toBe("context");
    expect(found.location.primary.span).toEqual({start:3*(94+separator.length)+3,end:3*(94+separator.length)+83});
    expect(source.slice(found.location.primary.span.start,found.location.primary.span.end)).toBe(rows[3]!.slice(3,83));
    expect(found.locator).toContain("Columns 4-83");
  });
  it.each(["\n", "\r\n", ""])("locates all CTX payload chunks with %j framing", separator => {
    for(const badChunk of [0,1,2]) {
      const rows=buildNacha([{sec:"CTX",addenda:[3]}]);
      const padded=("ST*820*0001~BPR*C*1.00*C*ACH~NTE*"+"X".repeat(155)+"~SE*4*0001~").padEnd(240);
      for(let i=0;i<3;i++) rows[3+i]=field(rows[3+i]!,4,83,padded.slice(i*80,(i+1)*80));
      rows[3+badChunk]=field(rows[3+badChunk]!,4,83,"~!~".padEnd(80,"!"));
      const source=rows.join(separator);
      const found=validateSource("synthetic.ach",source,EXPANDED_NACHA_PACK).results.find(r=>r.ruleId==="nacha.ctx-remittance")!;
      expect(found.outcome).toBe("ERROR");
      if(found.location?.kind!=="located") throw Error("Missing location");
      const targets=[found.location.primary,...found.location.related];expect(targets).toHaveLength(3);
      targets.forEach((t,i)=>{expect(t.kind).toBe("context");expect(t.span).toEqual({start:(3+i)*(94+separator.length)+3,end:(3+i)*(94+separator.length)+83});});
    }
  });
});

it("bounds payload context and retains the first failing entry's payload", () => {
  const rows = buildNacha([{sec:"CTX",codes:["22","22"],addenda:[40,1]}]);
  const source = rows.join("\r\n");
  const finding=validateSource("synthetic.ach",source,EXPANDED_NACHA_PACK).results.find(r=>r.ruleId==="nacha.ctx-remittance")!;
  expect(finding.outcome).toBe("ERROR"); expect(finding.message).toContain("2 violations");
  if(finding.location?.kind!=="located") throw Error("Missing payload context");
  expect(finding.location.related).toHaveLength(32); expect(finding.location.relatedTruncated).toBe(true);
  expect(finding.location.primary.span).toEqual({start:3*96+3,end:3*96+83});
});

it("keeps ordinary descriptions in scope and preserves healthcare prerequisite suppression", () => {
  expect(validateSource("synthetic.ach",buildNacha().join("\n"),ordinary).verdict).toBe("PASS");
  const rows=healthcare("TRN*1*TRACE*COMPANY\\");rows[3]=field(rows[3]!,2,3,"99");
  const run=validateSource("synthetic.ach",rows.join("\n"),ORIGINATION_R2_PACK);
  expect(run.verdict).toBe("FAIL");
  expect(run.checks?.find(c=>c.ruleId==="nacha.healthcare-trn")?.state).toBe("not-evaluated");
});
