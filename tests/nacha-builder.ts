// Synthetic fixtures only; no account or identity data from real files.
export function field(record: string, start: number, end: number, value: string): string {
  if (value.length !== end - start + 1) throw new Error("Fixture field width mismatch");
  return record.slice(0, start - 1) + value + record.slice(end);
}
const n = (value: bigint | number, width: number): string => String(value).padStart(width, "0");
const a = (value: string, width: number): string => value.padEnd(width, " ");
export interface BatchSpec { sec?: string; codes?: string[]; amounts?: bigint[]; addenda?: number[]; service?: string }
export function buildNacha(specs: BatchSpec[] = [{}]): string[] {
  const header = "101 021000021" + a("SYNTHETIC", 10) + "2610141200A094101" + a("SYNTHETIC DEST", 23) + a("SYNTHETIC ORIGIN", 23) + "        ";
  const rows = [header];
  let fileCount = 0; let fileHash = 0n; let fileDebit = 0n; let fileCredit = 0n; let trace = 0;
  for (const [index, spec] of specs.entries()) {
    const sec = spec.sec ?? "CCD"; const codes = spec.codes ?? [sec === "TEL" ? "27" : "22"];
    const service = spec.service ?? (codes.every((c) => ["22", "32", "52"].includes(c)) ? "220" : codes.every((c) => ["27", "37"].includes(c)) ? "225" : "200");
    const bn = n(index + 1, 7); const company = "SYNTHETIC1"; const odfi = "02100002";
    rows.push("5" + service + a("SYNTHETIC CO", 16) + " ".repeat(20) + company + sec + a("PAYMENT", 10) + "      " + "261014" + "   " + "1" + odfi + bn);
    let count = 0; let hash = 0n; let debit = 0n; let credit = 0n;
    for (const [entryIndex, code] of codes.entries()) {
      const amount = spec.amounts?.[entryIndex] ?? 12345n; const adds = spec.addenda?.[entryIndex] ?? 0; trace++;
      const traceNumber = odfi + n(trace, 7);
      rows.push("6" + code + "02100002" + "1" + a("SYNTHETIC", 17) + n(amount, 10) + a("SYNTHETIC ID", 15) + (sec === "CTX" ? n(adds, 4) + a("SYNTHETIC NAME", 16) + "  " : a("SYNTHETIC NAME", 22)) + "  " + (adds ? "1" : "0") + traceNumber);
      count++; hash = (hash + 2100002n) % 10000000000n;
      if (["22", "32", "52"].includes(code)) credit += amount; else debit += amount;
      for (let j = 1; j <= adds; j++) { rows.push("705" + a("SYNTHETIC REMITTANCE", 80) + n(j, 4) + n(trace, 7)); count++; }
    }
    rows.push("8" + service + n(count, 6) + n(hash, 10) + n(debit, 12) + n(credit, 12) + company + " ".repeat(25) + odfi + bn);
    fileCount += count; fileHash = (fileHash + hash) % 10000000000n; fileDebit += debit; fileCredit += credit;
  }
  rows.push("9" + n(specs.length, 6) + n(Math.ceil((rows.length + 1) / 10), 6) + n(fileCount, 8) + n(fileHash, 10) + n(fileDebit, 12) + n(fileCredit, 12) + " ".repeat(39));
  while (rows.length % 10) rows.push("9".repeat(94));
  if (!rows.every((row) => row.length === 94)) throw new Error("Fixture record width mismatch");
  return rows;
}
