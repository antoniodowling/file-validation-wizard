import { describe, expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import type { EdiVersionIdentifiers, FormatPack, IsoVersionIdentifiers } from "../src/types";
import { validateSource } from "../src/validation";
import { ediPack, isoPack, validEdi820, validPain001 } from "./helpers";

function validIsoFor(pack: FormatPack): string {
  const identifiers = pack.identifiers as IsoVersionIdentifiers;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="${identifiers.namespace}">
  <${identifiers.messageContainer}>
    <GrpHdr><MsgId>DEMO-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>
    <PmtInf><PmtInfId>PAYMENT-1</PmtInfId></PmtInf>
  </${identifiers.messageContainer}>
</Document>`;
}

function validEdiFor(pack: FormatPack): string {
  const identifiers = pack.identifiers as EdiVersionIdentifiers;
  return validEdi820
    .replace("*00501*000000001", `*${identifiers.isa12}*000000001`)
    .replaceAll("005010", identifiers.gs08);
}

describe("ISO validation", () => {
  it("passes deterministic structural checks for a matching message", () => {
    const first = validateSource("payment.xml", validPain001, isoPack());
    const second = validateSource("payment.xml", validPain001, isoPack());
    expect(first.overallStatus).toBe("PASS");
    expect(first.results).toEqual(second.results);
    expect(first.results.map((result) => result.ordinal)).toEqual(
      first.results.map((_, index) => index),
    );
  });

  it("returns only the format/version error for a mismatched namespace", () => {
    const source = validPain001
      .replace("pain.001.001.99", "pain.001.001.03")
      .replace("<PmtInf><PmtInfId>PAYMENT-1</PmtInfId></PmtInf>", "");
    const run = validateSource("payment.xml", source, isoPack());
    expect(run.overallStatus).toBe("FAIL");
    expect(run.results).toHaveLength(1);
    expect(run.results.find((result) => result.ruleId === "iso.namespace-version")?.outcome).toBe("ERROR");
    expect(run.results.find((result) => result.ruleId === "iso.namespace-version")?.message).toBe(
      "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded.",
    );
  });

  it("rejects a PAIN.007.001.09 document selected as PAIN.001.001.09", () => {
    const pack = FORMAT_PACKS.find((candidate) => candidate.id === "pain-001-09");
    expect(pack).toBeTruthy();
    if (!pack) return;
    const pain007 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.007.001.09">
  <CstmrPmtRvsl>
    <GrpHdr><MsgId>REVERSAL-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>
  </CstmrPmtRvsl>
</Document>`;
    const run = validateSource("reversal.xml", pain007, pack);
    expect(run.overallStatus).toBe("FAIL");
    expect(run.results).toHaveLength(1);
    expect(run.results[0]?.ruleId).toBe("iso.namespace-version");
    expect(run.results[0]?.outcome).toBe("ERROR");
  });

  it("continues structural checks when the selected namespace matches", () => {
    const source = validPain001.replace("<PmtInf><PmtInfId>PAYMENT-1</PmtInfId></PmtInf>", "");
    const run = validateSource("payment.xml", source, isoPack());
    expect(run.overallStatus).toBe("FAIL");
    expect(run.results.find((result) => result.ruleId === "iso.namespace-version")?.outcome).toBe("PASS");
    expect(run.results.find((result) => result.ruleId === "iso.payment-information")?.outcome).toBe("ERROR");
  });

  it("rejects malformed XML and prohibited entity declarations", () => {
    const malformed = validateSource("bad.xml", "<Document>", isoPack());
    expect(malformed.results.at(-1)?.ruleId).toBe("iso.well-formed");
    expect(malformed.overallStatus).toBe("FAIL");

    const entity = validateSource(
      "entity.xml",
      '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Document/>',
      isoPack(),
    );
    expect(entity.results).toHaveLength(1);
    expect(entity.results[0]?.ruleId).toBe("iso.safe-declarations");
    expect(entity.overallStatus).toBe("FAIL");
  });

  it("returns PASS WITH WARNINGS when valid XML omits its declaration", () => {
    const pack = FORMAT_PACKS.find((candidate) => candidate.id === "pain-001-13");
    expect(pack).toBeTruthy();
    if (!pack) return;
    const source = validIsoFor(pack).replace(/^<\?xml[^>]+>\s*/, "");
    const run = validateSource("payment.xml", source, pack);
    expect(run.overallStatus).toBe("PASS_WITH_WARNINGS");
    expect(run.errorCount).toBe(0);
    expect(run.warningCount).toBe(1);
    expect(run.results.find((result) => result.ruleId === "demo.xml-declaration")?.outcome).toBe("WARNING");
  });
});

describe("EDI 820 validation", () => {
  it("passes envelope, version, control, count, and BPR checks", () => {
    const run = validateSource("remittance.edi", validEdi820, ediPack());
    expect(validEdi820.indexOf("~")).toBe(105);
    expect(run.overallStatus).toBe("PASS");
    expect(run.results.every((result) => result.outcome === "PASS")).toBe(true);
  });

  it("fails version and transaction structure mismatches", () => {
    const source = validEdi820
      .replace("*005010~", "*004010~")
      .replace("BPR*C*1.00*C*ACH~", "")
      .replace("SE*3*0001~", "SE*4*9999~");
    const run = validateSource("remittance.edi", source, ediPack());
    expect(run.overallStatus).toBe("FAIL");
    expect(run.results.find((result) => result.ruleId === "edi.version")?.outcome).toBe("ERROR");
    expect(run.results.find((result) => result.ruleId === "edi.control-numbers")?.outcome).toBe("ERROR");
    expect(run.results.find((result) => result.ruleId === "edi.segment-count")?.outcome).toBe("ERROR");
    expect(run.results.find((result) => result.ruleId === "edi.payment-remittance")?.outcome).toBe("ERROR");
  });
});

describe("demo validation profiles", () => {
  it("passes a matching synthetic fixture for all nine profiles", () => {
    expect(FORMAT_PACKS).toHaveLength(9);
    for (const pack of FORMAT_PACKS) {
      const source = pack.parserKind === "ISO_XML" ? validIsoFor(pack) : validEdiFor(pack);
      expect(validateSource(`fixture${pack.extensions[0]}`, source, pack).overallStatus, pack.id).toBe("PASS");
    }
  });

  it("fails exact-version and cross-format mismatches", () => {
    const pain001 = FORMAT_PACKS.find((pack) => pack.id === "pain-001-13");
    const pain008 = FORMAT_PACKS.find((pack) => pack.id === "pain-008-12");
    const edi = FORMAT_PACKS.find((pack) => pack.id === "edi-820-008030");
    expect(pain001 && pain008 && edi).toBeTruthy();
    if (!pain001 || !pain008 || !edi) return;

    expect(validateSource("wrong-version.xml", validIsoFor(pain001), pain008).overallStatus).toBe("FAIL");
    expect(validateSource("wrong-family.xml", validIsoFor(pain008), pain001).overallStatus).toBe("FAIL");
    expect(validateSource("wrong-version.edi", validEdiFor(edi), FORMAT_PACKS.at(-2)!).overallStatus).toBe("FAIL");
  });
});
