export interface RecordRow { text: string; start: number; number: number }
export interface Totals { count: bigint; hash: bigint; debit: bigint; credit: bigint }
export const totals = (): Totals => ({ count: 0n, hash: 0n, debit: 0n, credit: 0n });
export const slice = (row: RecordRow, from: number, to: number): string => row.text.slice(from - 1, to);
export const digits = (value: string): boolean => /^\d+$/.test(value);
export const number = (value: string): bigint | null => digits(value) ? BigInt(value) : null;
export const HASH_MOD = 10_000_000_000n;
export function date(value: string): Date | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  const parsed = new Date(Date.UTC(2000 + yy, mm - 1, dd));
  return parsed.getUTCFullYear() === 2000 + yy && parsed.getUTCMonth() === mm - 1 && parsed.getUTCDate() === dd ? parsed : null;
}
export function routingPrefix(value: string): boolean {
  const prefix = Number(value.slice(0, 2));
  return /^\d{8}$/.test(value) && value !== "00000000" &&
    ((prefix >= 0 && prefix <= 12) || (prefix >= 21 && prefix <= 32) || (prefix >= 61 && prefix <= 72) || prefix === 80);
}
export function routing(value: string): boolean {
  if (!/^\d{9}$/.test(value) || !routingPrefix(value.slice(0, 8))) return false;
  return [...value].reduce((sum, digit, index) => sum + Number(digit) * ([3, 7, 1][index % 3] ?? 0), 0) % 10 === 0;
}

/** Fixed-record boundaries retain offsets and stop at the first malformed boundary. */
export function frameFixedRecords(source: string, width: number): { rows: RecordRow[]; framing: boolean; badWidth: RecordRow | undefined } {
  const rows: RecordRow[] = [];
  const firstDelimiter = /\r\n|\r|\n/.exec(source);
  let framing = source.length > 0;
  let badWidth: RecordRow | undefined;
  if (firstDelimiter) {
    const delimiter = firstDelimiter[0];
    const separators = /\r\n|\r|\n/g;
    let start = 0;
    let match: RegExpExecArray | null;
    // Validate each boundary before retaining a row. Delimiter-heavy malformed
    // input must not allocate arrays proportional to every newline in the file.
    while ((match = separators.exec(source)) !== null) {
      const row = { text: source.slice(start, match.index), start, number: rows.length + 1 };
      if (match[0] !== delimiter || row.text.length !== width) {
        framing = false;
        badWidth = row;
        break;
      }
      rows.push(row);
      start = match.index + match[0].length;
    }
    if (framing && start < source.length) {
      const row = { text: source.slice(start), start, number: rows.length + 1 };
      if (row.text.length !== width) { framing = false; badWidth = row; }
      else rows.push(row);
    }
  } else {
    framing = framing && source.length % width === 0;
    if (framing) {
      for (let start = 0; start < source.length; start += width) rows.push({ text: source.slice(start, start + width), start, number: rows.length + 1 });
    }
  }
  return { rows, framing, badWidth };
}
