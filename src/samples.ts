import wirePass from "../demo-files/csv-wire/domestic-pass.csv?raw";
import wireFail from "../demo-files/csv-wire/amount-fail.csv?raw";
import ackPass from "../demo-files/ach-candidates/ack-received-pass.txt?raw";
import bai2Pass from "../demo-files/bai2/balances-pass.bai2?raw";
import bai2Fail from "../demo-files/bai2/account-total-fail.bai2?raw";
import ackFail from "../demo-files/ach-candidates/ack-date-fail.txt?raw";
import returnsPass from "../demo-files/ach-candidates/returns-ccd-pass.ach?raw";
import returnsFail from "../demo-files/ach-candidates/returns-trace-fail.ach?raw";
import totalsPass from "../demo-files/ach-candidates/totals-pass.txt?raw";
import totalsFail from "../demo-files/ach-candidates/totals-date-fail.txt?raw";
import expandedPass from "../demo-files/nacha-expanded/mixed-entry-types-pass.ach?raw";
import expandedFail from "../demo-files/nacha-expanded/prenote-amount-fail.ach?raw";
import nachaPass from "../demo-files/nacha/ccd-pass.ach?raw";
import nachaFail from "../demo-files/nacha/routing-check-digit-fail.ach?raw";
import type { FormatPack, IsoVersionIdentifiers, EdiVersionIdentifiers } from "./types";
/** Synthetic wiring samples, intentionally not represented as conformant payment messages. */
export function syntheticSample(pack: FormatPack, fail: boolean): string {
  if (pack.parserKind === "CSV_WIRE") return fail ? wireFail : wirePass;
  if (pack.parserKind === "BAI2") return fail ? bai2Fail : bai2Pass;
  if (pack.parserKind === "HUNTINGTON_ACK") return fail ? ackFail : ackPass;
  if (pack.parserKind === "NACHA_RETURN_FIXED") return fail ? returnsFail : returnsPass;
  if (pack.parserKind === "ACH_CONTROL_FIXED") return fail ? totalsFail : totalsPass;
  if (["nacha-origination-expanded-public-2026-r1", "nacha-origination-expanded-public-2026-r2"].includes(pack.id)) return fail ? expandedFail : expandedPass;
  if (pack.parserKind === "NACHA_FIXED") return fail ? nachaFail : nachaPass;
  if (pack.parserKind === "ISO_XML") {
    const ids = pack.identifiers as IsoVersionIdentifiers;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Synthetic DEMO structural sample; not a payment instruction -->\n<Document xmlns="${ids.namespace}"><${ids.messageContainer}><GrpHdr><MsgId>${fail ? "" : "SYNTHETIC-DEMO"}</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr><PmtInf><PmtInfId>SAMPLE-1</PmtInfId></PmtInf></${ids.messageContainer}></Document>`;
  }
  const ids = pack.identifiers as EdiVersionIdentifiers;
  // Retain the disputed historical pair only as an UNSUPPORTED wiring sample.
  const isa12 = ids.isa12 ?? "00501";
  return `ISA*00*          *00*          *ZZ*SYNTHETIC      *ZZ*DEMO           *260919*1200*U*${isa12}*000000001*0*T*:~GS*RA*SYNTHETIC*DEMO*20260919*1200*1*X*${ids.gs08}~ST*820*0001~BPR*C*1.00*C*ACH~SE*${fail ? "9" : "3"}*0001~GE*1*1~IEA*1*000000001~`;
}
