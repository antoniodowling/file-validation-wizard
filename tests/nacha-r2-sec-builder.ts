// Synthetic SEC expansion fixtures. No source accounts or personal data.
// Layout and arithmetic are independent of the validator under test.
export interface SecBatchSpec {
  sec?: string;
  codes?: string[];
  amounts?: bigint[];
  addenda?: number[];
  service?: string;
  description?: string;
  serials?: string[];
  names?: string[];
  identifications?: string[];
  terminalCities?: string[];
  terminalStates?: string[];
  addendaPayloads?: string[];
}

const CREDIT_CODES = new Set(["22", "23", "24", "32", "33", "34", "42", "43", "44", "52", "53", "54"]);
const DEBIT_CODES = new Set(["27", "28", "29", "37", "38", "39", "47", "48", "49", "55"]);
const ZERO_CODES = new Set(["23", "24", "28", "29", "33", "34", "38", "39", "43", "44", "48", "49", "53", "54"]);
const numeric = (value: bigint | number, width: number): string => {
  const text = String(value);
  if (!/^\d+$/.test(text) || text.length > width) throw new Error("Synthetic numeric field exceeds its width");
  return text.padStart(width, "0");
};
const alpha = (value: string, width: number): string => {
  if (value.length > width) throw new Error("Synthetic alphanumeric field exceeds its width");
  return value.padEnd(width, " ");
};

/** Return complete 94-column records, including independently reconciled controls. */
export function buildSecNacha(specs: SecBatchSpec[] = [{ sec: "CIE" }]): string[] {
  const rows = ["101 021000021" + alpha("SYNTHETIC", 10) + "2611171200A094101" + alpha("SYNTHETIC DEST", 23) + alpha("SYNTHETIC ORIGIN", 23) + " ".repeat(8)];
  let fileCount = 0;
  let fileHash = 0n;
  let fileDebit = 0n;
  let fileCredit = 0n;
  let trace = 0;
  for (const [index, spec] of specs.entries()) {
    const sec = spec.sec ?? "CIE";
    const codes = spec.codes ?? [["ARC", "BOC", "POP", "TEL"].includes(sec) ? "27" : "22"];
    for (const code of codes) if (!CREDIT_CODES.has(code) && !DEBIT_CODES.has(code)) throw new Error("Mutate unknown transaction codes after fixture controls have been built");
    const service = spec.service ?? (codes.every(code => CREDIT_CODES.has(code)) ? "220" : codes.every(code => DEBIT_CODES.has(code)) ? "225" : "200");
    const batchNumber = numeric(index + 1, 7);
    const company = "SYNTHETIC1";
    const odfi = "02100002";
    rows.push("5" + service + alpha("SYNTHETIC CO", 16) + " ".repeat(20) + company + sec + alpha(spec.description ?? "PAYMENT", 10) + " ".repeat(6) + "261117" + "   " + "1" + odfi + batchNumber);
    let count = 0;
    let hash = 0n;
    let debit = 0n;
    let credit = 0n;
    for (const [entryIndex, code] of codes.entries()) {
      const amount = spec.amounts?.[entryIndex] ?? (ZERO_CODES.has(code) ? 0n : 12345n);
      const addenda = spec.addenda?.[entryIndex] ?? 0;
      const name = spec.names?.[entryIndex] ?? (sec === "CIE" ? "SYNTH CUSTOMER" : "SYNTHETIC NAME");
      const identification = spec.identifications?.[entryIndex] ?? "SYNTHETIC ID";
      const serial = spec.serials?.[entryIndex] ?? "123456";
      let detail: string;
      if (sec === "CIE") detail = alpha(name, 15) + alpha(identification, 22);
      else if (sec === "POP") detail = alpha(serial, 9) + alpha(spec.terminalCities?.[entryIndex] ?? "NYC", 4) + alpha(spec.terminalStates?.[entryIndex] ?? "NY", 2) + alpha(name, 22);
      else if (sec === "ARC" || sec === "BOC") detail = alpha(serial, 15) + alpha(name, 22);
      else if (sec === "CTX") detail = alpha(identification, 15) + numeric(addenda, 4) + alpha(name, 16) + "  ";
      else detail = alpha(identification, 15) + alpha(name, 22);
      trace++;
      const traceNumber = odfi + numeric(trace, 7);
      rows.push("6" + code + "02100002" + "1" + alpha("000123456789", 17) + numeric(amount, 10) + detail + "  " + (addenda > 0 ? "1" : "0") + traceNumber);
      count++;
      hash = (hash + 2100002n) % 10000000000n;
      if (CREDIT_CODES.has(code)) credit += amount;
      else debit += amount;
      for (let addendaIndex = 1; addendaIndex <= addenda; addendaIndex++) {
        rows.push("705" + alpha(spec.addendaPayloads?.[entryIndex] ?? (sec === "CIE" ? "N1*BT*SYNTH CUSTOMER\\" : "SYNTHETIC REMITTANCE"), 80) + numeric(addendaIndex, 4) + numeric(trace, 7));
        count++;
      }
    }
    rows.push("8" + service + numeric(count, 6) + numeric(hash, 10) + numeric(debit, 12) + numeric(credit, 12) + company + " ".repeat(25) + odfi + batchNumber);
    fileCount += count;
    fileHash = (fileHash + hash) % 10000000000n;
    fileDebit += debit;
    fileCredit += credit;
  }
  rows.push("9" + numeric(specs.length, 6) + numeric(Math.ceil((rows.length + 1) / 10), 6) + numeric(fileCount, 8) + numeric(fileHash, 10) + numeric(fileDebit, 12) + numeric(fileCredit, 12) + " ".repeat(39));
  while (rows.length % 10 !== 0) rows.push("9".repeat(94));
  if (rows.some(row => row.length !== 94)) throw new Error("Synthetic record width mismatch");
  return rows;
}
