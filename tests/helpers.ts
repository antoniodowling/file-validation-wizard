import type { FormatPack, ValidationRule } from "../src/types";

const approvals = Object.freeze({
  product: true,
  sc: true,
  ft: true,
  rulesApproved: true,
  fixturesApproved: true,
});

const passRule: ValidationRule = Object.freeze({
  id: "test.approved-rule",
  description: "The approved test rule passed.",
  field: "Approved test rule",
  defaultLocator: "test",
  evaluate: () => ({ outcome: "PASS" as const }),
});

export function isoPack(overrides: Partial<FormatPack> = {}): FormatPack {
  return {
    id: "pain-001-test",
    family: "PAIN.001",
    label: "ISO 20022 PAIN.001 test pack",
    version: "pain.001.001.99",
    parserKind: "ISO_XML",
    extensions: [".xml"],
    guideUrl: "https://example.invalid/pain-001",
    enabled: true,
    mode: "PRODUCTION",
    identifiers: {
      kind: "ISO_XML",
      namespace: "urn:iso:std:iso:20022:tech:xsd:pain.001.001.99",
      messageContainer: "CstmrCdtTrfInitn",
    },
    approval: approvals,
    rules: [passRule],
    ...overrides,
  };
}

export function ediPack(overrides: Partial<FormatPack> = {}): FormatPack {
  return {
    id: "edi-820-test",
    family: "EDI 820",
    label: "ASC X12 EDI 820 test pack",
    version: "005010",
    parserKind: "EDI_X12",
    extensions: [".edi", ".x12", ".820", ".txt"],
    guideUrl: "https://example.invalid/edi-820",
    enabled: true,
    mode: "PRODUCTION",
    identifiers: {
      kind: "EDI_X12",
      isa12: "00501",
      gs08: "005010",
      st03: "005010",
    },
    approval: approvals,
    rules: [passRule],
    ...overrides,
  };
}

export const validPain001 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.99">
  <CstmrCdtTrfInitn>
    <GrpHdr><MsgId>TEST-001</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>
    <PmtInf><PmtInfId>PAYMENT-1</PmtInfId></PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

export const validEdi820 = [
  "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260916*1200*U*00501*000000001*0*T*:~",
  "GS*RA*SENDER*RECEIVER*20260916*1200*1*X*005010~",
  "ST*820*0001*005010~",
  "BPR*C*1.00*C*ACH~",
  "SE*3*0001~",
  "GE*1*1~",
  "IEA*1*000000001~",
].join("");
