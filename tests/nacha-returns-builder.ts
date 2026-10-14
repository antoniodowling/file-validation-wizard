// Synthetic source only: no customer records, accounts or identities.
export { field } from "./nacha-builder";
const n = (v: bigint | number, w: number): string => String(v).padStart(w,"0");
const a = (v: string, w: number): string => v.padEnd(w," ");
export interface ReturnSpec { sec?: string; transaction?: string; reason?: string; amount?: bigint; correction?: string; entries?: number }
export function buildReturns(spec: ReturnSpec = {}): string[] {
  const sec = spec.sec ?? "CCD", noc = sec === "COR", code = spec.transaction ?? "26";
  const credit = ["21","31","51"].includes(code); const service = credit ? "220" : "225";
  const count = spec.entries ?? 1; const amount = spec.amount ?? (noc ? 0n : 12345n);
  const company = "SYNTHETIC1", odfi = "02100002";
  const rows = ["101 021000021" + a("SYNTHETIC",10) + "2610141200A094101" + a("SYNTHETIC DEST",23) + a("SYNTHETIC ORIGIN",23) + "        "];
  rows.push("5"+service+a("SYNTHETIC CO",16)+" ".repeat(20)+company+sec+a(noc ? "CORRECTION" : "RETURN",10)+"      "+"261014"+"   "+"1"+odfi+"0000001");
  for(let i=1;i<=count;i++) {
    const trace = odfi+n(i,7);
    rows.push("6"+code+"021000021"+a("SYNTHETIC",17)+n(amount,10)+a("SYNTHETIC ID",15)+(sec === "CTX" ? "0001"+a("SYNTHETIC NAME",16)+"  " : a("SYNTHETIC NAME",22))+"  1"+trace);
    rows.push("7"+(noc?"98":"99")+(spec.reason ?? (noc?"C01":"R02"))+"021000020000099"+"      "+odfi+(noc ? a(spec.correction ?? "SYNTHETIC NEW",29)+" ".repeat(15) : " ".repeat(44))+trace);
  }
  const debit=credit?0n:amount*BigInt(count), cr=credit?amount*BigInt(count):0n;
  const hash=2100002n*BigInt(count)%10000000000n;
  rows.push("8"+service+n(2*count,6)+n(hash,10)+n(debit,12)+n(cr,12)+company+" ".repeat(25)+odfi+"0000001");
  rows.push("9"+"000001"+n(Math.ceil((rows.length+1)/10),6)+n(2*count,8)+n(hash,10)+n(debit,12)+n(cr,12)+" ".repeat(39));
  while(rows.length%10) rows.push("9".repeat(94));
  if(rows.some(r=>r.length!==94)) throw new Error("Synthetic record width");
  return rows;
}
