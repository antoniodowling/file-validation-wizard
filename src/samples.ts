import type { FormatPack, IsoVersionIdentifiers, EdiVersionIdentifiers } from "./types";
/** Synthetic wiring samples, intentionally not represented as conformant payment messages. */
export function syntheticSample(pack: FormatPack, fail: boolean): string {
  if (pack.parserKind === "ISO_XML") {
    const ids = pack.identifiers as IsoVersionIdentifiers;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Synthetic DEMO structural sample; not a payment instruction -->\n<Document xmlns="${ids.namespace}"><${ids.messageContainer}><GrpHdr><MsgId>${fail ? "" : "SYNTHETIC-DEMO"}</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr><PmtInf><PmtInfId>SAMPLE-1</PmtInfId></PmtInf></${ids.messageContainer}></Document>`;
  }
  const ids = pack.identifiers as EdiVersionIdentifiers;
  return `ISA*00*          *00*          *ZZ*SYNTHETIC      *ZZ*DEMO           *260919*1200*U*${ids.isa12}*000000001*0*T*:~GS*RA*SYNTHETIC*DEMO*20260919*1200*1*X*${ids.gs08}~ST*820*0001~BPR*C*1.00*C*ACH~SE*${fail ? "9" : "3"}*0001~GE*1*1~IEA*1*000000001~`;
}
