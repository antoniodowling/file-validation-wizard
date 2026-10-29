import { describe, expect, it } from "vitest";
import { validateSource } from "../src/validation";
import { parseXml } from "../src/parsers/xml-adapter";
import { isoPack, ediPack, validPain001, validEdi820 } from "./helpers";
import { validateWorkerRequest } from "../src/worker-request";
import { validationRunToCsv, validationRunToJson } from "../src/csv";

describe("review regression boundaries", () => {
  it.each([
    validPain001 + "<other/>",
    validPain001.replace("<CstmrCdtTrfInitn>", '<CstmrCdtTrfInitn xmlns="urn:foreign">'),
    validPain001.replace("<MsgId>TEST-001</MsgId>", "<unbound:MsgId>TEST-001</unbound:MsgId>"),
    validPain001.replace("<GrpHdr><MsgId>TEST-001</MsgId>", '<GrpHdr xmlns:x="urn:foreign" x:MsgId="TEST-001">'),
    validPain001.replace("<MsgId>TEST-001</MsgId>", "<MsgId>A</MsgId><MsgId>B</MsgId>"),
    validPain001.replace("<NbOfTxs>1</NbOfTxs>", "<NbOfTxs>1</NbOfTxs><NbOfTxs>1</NbOfTxs>"),
    validPain001.replace("</GrpHdr>", "</GrpHdr><GrpHdr/>"),
  ])("never passes malformed or ambiguous ISO structure %#", source => {
    expect(validateSource("synthetic.xml", source, isoPack()).overallStatus).toBe("FAIL");
  });
  it("allows inert comment, PI, CDATA and predefined entities", () => {
    const source = validPain001.replace("<MsgId>TEST-001</MsgId>", '<!-- <!DOCTYPE harmless> --><?local inert?><MsgId><![CDATA[<!ENTITY inert>]]>&amp;&#x1F600;</MsgId>');
    expect(validateSource("synthetic.xml", source, isoPack()).overallStatus).toBe("PASS");
  });
  it.each(["<x>&#0;</x>", '<x xmlns:p=""><p:y/></x>', "<x a='1' a='2'/>", "<x>\u0001</x>", "<x/><x/>", "<x><!-- a--b --></x>"])("strict XML syntax rejects %s", source => expect(() => parseXml(source)).toThrow());
  it("preserves lexical UTF-16 spans with normalization and Unicode", () => {
    const source = '<?xml version="1.0"?><x>\r\n😀<y a="&amp;">A&#13;B</y>\r</x>';
    const root = parseXml(source); const child = root.children[0]!;
    expect(source.slice(child.span.start, child.span.end)).toBe('<y a="&amp;">A&#13;B</y>');
    expect(child.text).toBe("A\rB");
    expect(root.text).toBe("\n😀\n");
  });
  it("suppresses dependents and exports provenance", () => {
    const run = validateSource("x.xml", "<Document>", isoPack());
    expect(run.checks?.find(c => c.ruleId === "iso.message-id")?.state).toBe("not-evaluated");
    expect(run.executionStatus).toBe("COMPLETED"); expect(run.verdict).toBe("FAIL");
    expect(validationRunToCsv(run)).toContain("2.1.0");
    expect(JSON.parse(validationRunToJson(run)).provenance.schemaVersion).toBe("2");
  });
  it.each([
    validEdi820.replace("BPR*C*1.00*C*ACH~", "").replace("GE*1*1~", "BPR*C*1.00*C*ACH~GE*1*1~"),
    validEdi820.replace("GE*1*1~", "GE*2*1~"),
    validEdi820.replace("IEA*1*", "IEA*2*"),
    validEdi820.slice(0,-1),
    validEdi820.replace("SE*3*0001~", "GE*1*1~SE*3*0001~"),
  ])("rejects untrustworthy EDI ownership and counts %#", source => expect(validateSource("x.edi", source, ediPack()).overallStatus).toBe("FAIL"));
  it("checks each group and each transaction independently", () => {
    const group = validEdi820.slice(106, validEdi820.indexOf("IEA"));
    const two = validEdi820.replace("IEA*1*", group + "IEA*2*");
    expect(validateSource("x.edi", two, ediPack()).overallStatus).toBe("PASS");
    const wrong = two.replace(group + "IEA", group.replace("GS*RA*SENDER*RECEIVER*20260916*1200*1*X*005010", "GS*RA*SENDER*RECEIVER*20260916*1200*1*X*008030") + "IEA");
    expect(validateSource("x.edi", wrong, ediPack()).overallStatus).toBe("FAIL");
  });
  it("returns no verdict for unsupported XML declarations", () => {
    const run = validateSource("x.xml", validPain001.replace("UTF-8", "UTF-16"), isoPack());
    expect(run.executionStatus).toBe("UNSUPPORTED"); expect(run.verdict).toBeNull();
  });
  it("bounds validation source complexity", () => {
    const bytes = new TextEncoder().encode("<x>".repeat(140) + "</x>".repeat(140)).buffer;
    expect(validateWorkerRequest({type:"validate",packId:"pain-001-09",fileName:"x.xml",bytes})).toEqual({type:"error",code:"RESOURCE_LIMIT"});
  });
});

it("does not turn empty evaluations into PASS", async () => {
  const { deriveOverallStatus } = await import("../src/outcome");
  expect(deriveOverallStatus([])).toBe("INCOMPLETE");
});
it("distinguishes complete unsupported multi-interchanges from malformed nesting", () => {
  const complete = validateSource("x.edi", validEdi820 + validEdi820, ediPack());
  expect(complete.executionStatus).toBe("UNSUPPORTED"); expect(complete.verdict).toBeNull();
  const malformed = validateSource("x.edi", validEdi820 + validEdi820.replace("SE*3*0001~", ""), ediPack());
  expect(malformed.overallStatus).toBe("FAIL");
});
it("does not silently reinterpret XML 1.1 as XML 1.0", () => {
  const run = validateSource("x.xml", validPain001.replace('version="1.0"', 'version="1.1"'), isoPack());
  expect(run.executionStatus).toBe("UNSUPPORTED"); expect(run.verdict).toBeNull();
});
