import { describe, expect, it } from "vitest";
import { parseNachaReturns, NACHA_RETURNS_RULE_IDS } from "../src/parsers/nacha-returns";
import { nachaReturnsCoverageFor } from "../src/nacha-returns-coverage";
import { UnsupportedInputError } from "../src/resource-policy";
import type { FormatPack } from "../src/types";
import { buildReturns, field } from "./nacha-returns-builder";
const pack = { id:"nacha-returns-network-public-2026-r1",version:"2026-r1",rules:[] } as unknown as FormatPack;
const parse = (rows = buildReturns()) => parseNachaReturns(rows.join("\n"),pack);
const errors = (rows: string[]) => parse(rows).results.filter(r=>r.outcome === "ERROR").map(r=>r.ruleId);
const changed = (index:number,from:number,to:number,value:string,rows=buildReturns()) => { rows[index] = field(rows[index]!,from,to,value); return rows; };
describe("ordinary network Returns candidate",()=>{
  it.each(["CCD","PPD","CTX","WEB","TEL"])("accepts synthetic %s ordinary return",sec=>expect(errors(buildReturns({sec}))).toEqual([]));
  it.each(["21","26","31","36","51","56"])("accepts explicit family %s without economic label reversal",transaction=>expect(errors(buildReturns({transaction}))).toEqual([]));
  it("accepts zero-dollar return and zero-dollar COR",()=>{expect(errors(buildReturns({amount:0n}))).toEqual([]); expect(errors(buildReturns({sec:"COR"}))).toEqual([]);});
  it.each(["\n","\r\n","\r",""])("supports fixed-record framing %j",separator=>expect(parseNachaReturns(buildReturns().join(separator)+separator,pack).results.some(r=>r.outcome==="ERROR")).toBe(false));
  it.each(["\ufeff", "\t"])("rejects leading BOM/control %j",prefix=>expect(parseNachaReturns(prefix+buildReturns().join("\n"),pack).context).toBeNull());
  it("stops downstream checks on mixed framing and invalid width",()=>{
    const bad=buildReturns().join("\n").replace("\n","\r\n");
    expect(parseNachaReturns(bad,pack).results.map(r=>r.ruleId)).toEqual(["nacha-returns.framing"]);
    expect(parse(changed(2,13,13,"é")).results.map(r=>r.ruleId)).toEqual(["nacha-returns.framing","nacha-returns.ascii"]);
  });
  it.each([
    [0,2,3,"02","file-header"], [0,24,29,"260231","creation-date"], [0,30,33,"2460","creation-time"],
    [1,2,4,"280","service-class"], [1,5,20,"0000000000000000","batch-required"], [1,70,75,"260231","effective-date"],
    [1,76,78,"367","settlement-date"], [1,79,79,"9","originator-status"], [1,80,87,"00000000","odfi"], [1,88,94,"0000000","batch-number"],
    [2,2,3,"22","transaction-code"], [2,4,12,"021000022","routing"], [2,30,39,"00000X1234","entry-amount"],
    [2,79,79,"0","addenda-indicator"], [2,80,87,"00000000","trace"],
    [3,2,3,"05","addenda-type"], [3,4,6,"R99","reason-code"], [3,7,21,"               ","original-trace"],
    [3,28,35,"00000000","original-rdfi"], [3,80,94,"021000020000099","addenda-link"],
    [4,5,10,"000001","batch-count"], [4,11,20,"0000000000","batch-hash"], [4,74,79,"XXXXXX","reserved"],
    [5,2,7,"000002","file-batches"], [5,8,13,"000002","file-blocks"], [5,14,21,"00000001","file-count"],
    [5,22,31,"0000000000","file-hash"], [5,32,43,"000000000001","file-debit"], [5,44,55,"000000000001","file-credit"],
  ] as const)("finds malformed %s:%s %s",(index,from,to,value,id)=>expect(errors(changed(index,from,to,value))).toContain(`nacha-returns.${id}`));
  it("rejects a forward/addenda mixture and broken envelopes",()=>{ const rows=buildReturns();rows.splice(3,0,"705"+" ".repeat(91));expect(errors(rows)).toContain("nacha-returns.addenda-count"); const out=buildReturns();out[3]="5"+" ".repeat(93);expect(parse(out).context).toBeNull(); });
  it("requires exactly one mandatory addenda and numeric CTX count",()=>{ const rows=buildReturns();rows.splice(3,1);expect(errors(rows)).toContain("nacha-returns.addenda-count");expect(errors(changed(2,55,58,"X000",buildReturns({sec:"CTX"})))).toContain("nacha-returns.addenda-count"); });
  it("checks direction against service and reconciles explicit return families",()=>{expect(errors(changed(1,2,4,"220"))).toContain("nacha-returns.sec-transaction"); const out=parse();expect(out.results.some(r=>r.ruleId==="nacha-returns.batch-debit"&&r.outcome==="PASS")).toBe(true);expect(out.notApplicable).not.toContain("nacha-returns.batch-debit");});
  it("suppresses routing hash reconciliation when operand nonnumeric",()=>{const out=parse(changed(2,4,11,"X2100002"));expect(out.results.some(r=>["nacha-returns.batch-hash","nacha-returns.file-hash"].includes(r.ruleId))).toBe(false);});
  it("keeps unknown-code conditional checks not evaluated",()=>{const out=parse(buildReturns({reason:"R99"}));expect(out.notApplicable).not.toEqual(expect.arrayContaining(["nacha-returns.death-date","nacha-returns.reason-applicability"]));});
  it("does not promote partially unknown batch operands to PASS",()=>{
    const first=buildReturns(), second=buildReturns({sec:"COR"});
    first[2]=field(first[2]!,30,39,"X000012345");
    second[1]=field(second[1]!,88,94,"0000002"); second[4]=field(second[4]!,88,94,"0000002");
    second[2]=field(second[2]!,80,94,"021000020000002"); second[3]=field(second[3]!,80,94,"021000020000002");
    let fc=first[5]!;fc=field(fc,2,7,"000002");fc=field(fc,14,21,"00000004");fc=field(fc,22,31,"0004200004");
    const out=parse([first[0]!,...first.slice(1,5),...second.slice(1,5),fc]);
    expect(out.results.some(r=>r.ruleId==="nacha-returns.batch-debit"&&r.outcome==="PASS")).toBe(false);
    expect(out.results.filter(r=>r.outcome==="ERROR").map(r=>r.ruleId)).toEqual(["nacha-returns.entry-amount"]);
  });
  it("checks control numeric syntax and suppresses file amount arithmetic with unknown batch value",()=>{ const out=parse(changed(4,21,32,"X00000012345"));expect(out.results.some(r=>r.ruleId==="nacha-returns.control-amount-syntax"&&r.outcome==="ERROR")).toBe(true);expect(out.results.some(r=>r.ruleId==="nacha-returns.file-debit")).toBe(false); });
  it("bounds repeated errors and preserves exact locations",()=>{const rows=buildReturns({entries:20});for(let i=3;i<43;i+=2) rows[i]=field(rows[i]!,80,94,"               ");const out=parse(rows);expect(out.results.length).toBeLessThanOrEqual(NACHA_RETURNS_RULE_IDS.length);const finding=out.results.find(r=>r.ruleId==="nacha-returns.addenda-link")!;expect(finding.message).toContain("20 violations");expect(finding.location?.kind).toBe("located");if(finding.location?.kind==="located") expect(rows.join("\n").slice(finding.location.primary.span.start,finding.location.primary.span.end)).toBe("               ");});
  it("checks trace order and uniqueness",()=>{const rows=buildReturns({entries:2});rows[4]=field(rows[4]!,80,94,"021000020000001");rows[5]=field(rows[5]!,80,94,"021000020000001");expect(errors(rows)).toEqual(expect.arrayContaining(["nacha-returns.trace-order","nacha-returns.trace-unique"]));});
  it("rejects an altered return batch directional total",()=>expect(errors(changed(4,21,32,"000000000001"))).toContain("nacha-returns.batch-debit"));
  it("preserves BigInt cents and hashes across many large entries",()=>expect(errors(buildReturns({entries:99,amount:9999999999n}))).toEqual([]));
  it("validates optional death date only R14/R15",()=>{expect(errors(changed(3,22,27,"260231",buildReturns({reason:"R15"})))).toContain("nacha-returns.death-date");expect(errors(changed(3,22,27,"261001",buildReturns({reason:"R15"})))).toEqual([]);expect(errors(changed(3,22,27,"261001"))).toContain("nacha-returns.death-date");});
  it("requires R17 information and does not invent a legacy R11 check-truncation requirement",()=>{expect(errors(buildReturns({reason:"R17"}))).toContain("nacha-returns.return-information");expect(errors(changed(3,36,79,"QUESTIONABLE".padEnd(44," "),buildReturns({reason:"R17"})))).toEqual([]);expect(errors(buildReturns({reason:"R11",sec:"PPD"}))).toEqual([]);});
  it.each([ ["R01","21","CCD"], ["R05","26","PPD"], ["R31","26","TEL"], ["R23","26","CCD"], ["R33","26","CCD"] ])("rejects assigned reason %s incompatible with %s/%s",(reason,transaction,sec)=>expect(errors(buildReturns({reason,transaction,sec}))).toContain("nacha-returns.reason-applicability"));
  it.each(["R61","R62","R67","R68","R69","R70","R71","R72","R73","R74","R75","R76","R77"])("gates specialized %s without verdict",reason=>expect(()=>parse(buildReturns({reason}))).toThrow(UnsupportedInputError));
});
describe("ordinary administrative COR",()=>{
  const corrections: Record<string,string> = {C01:"NEW ACCOUNT".padEnd(29," "),C02:"021000021".padEnd(29," "),C03:"021000021   "+"NEW ACCOUNT".padEnd(17," "),C05:"27".padEnd(29," "),C06:"NEW ACCOUNT".padEnd(17," ")+"   27"+" ".repeat(7),C07:"021000021"+"NEW ACCOUNT".padEnd(17," ")+"27 ",C09:"NEW ID".padEnd(29," "),C13:"ADDENDA FORMAT ERROR".padEnd(29," ")};
  it.each(Object.keys(corrections))("accepts code-specific %s correction",reason=>expect(errors(buildReturns({sec:"COR",reason,correction:corrections[reason]!}))).toEqual([]));
  it.each(Object.keys(corrections))("rejects blank %s correction",reason=>expect(errors(buildReturns({sec:"COR",reason,correction:" ".repeat(29)}))).toContain("nacha-returns.corrected-data"));
  it("validates correction routing checksum, transaction and separator positions",()=>{ for(const [reason,correction] of [["C02","021000022".padEnd(29," ")],["C05","99".padEnd(29," ")],["C06","NEW ACCOUNT".padEnd(17," ")+"XXX27"+" ".repeat(7)]]) expect(errors(buildReturns({sec:"COR",reason:reason!,correction:correction!}))).toContain("nacha-returns.corrected-data"); });
  it("admits retained numeric CTX count without a preservation/coherence claim",()=>expect(errors(changed(2,55,58,"0009",buildReturns({sec:"CTX"})))).toEqual([]));
  it("requires zero amount and blank reserved fields",()=>{expect(errors(buildReturns({sec:"COR",amount:1n}))).toContain("nacha-returns.entry-amount");expect(errors(changed(3,65,79,"X".repeat(15),buildReturns({sec:"COR"})))).toContain("nacha-returns.reserved");});
  it("reconciles COR batch amounts to zero",()=>expect(errors(changed(4,21,32,"000000000001",buildReturns({sec:"COR"})))).toContain("nacha-returns.batch-debit"));
  it.each(["C08","C14","C61","C62","C63","C64","C65","C66","C67","C68","C69"])("gates unqualified %s",reason=>expect(()=>parse(buildReturns({sec:"COR",reason}))).toThrow(UnsupportedInputError));
  it("does not invent retired C04 or continuous code range",()=>expect(errors(buildReturns({sec:"COR",reason:"C04"}))).toContain("nacha-returns.reason-code"));
  it("coverage includes parser and configured rules without duplicates",()=>{const coverage=nachaReturnsCoverageFor(pack);expect(coverage.map(c=>c.id)).toEqual(NACHA_RETURNS_RULE_IDS);expect(coverage.every(c=>c.reference&&c.prerequisite&&c.evidence)).toBe(true);});
});
