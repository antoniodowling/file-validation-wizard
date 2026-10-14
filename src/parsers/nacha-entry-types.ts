/** General ACH code meanings; sources and deliberately gated combinations in docs/ACH_ORIGINATION_EXPANDED.md. */
export interface AchEntryType { direction: "credit" | "debit"; kind: "monetary" | "prenote" | "remittance"; loan: boolean }
const types: Record<string, AchEntryType> = {};
for (const [codes, direction, kind] of [
  [["22", "32", "52"], "credit", "monetary"], [["27", "37", "55"], "debit", "monetary"],
  [["23", "33", "53"], "credit", "prenote"], [["28", "38"], "debit", "prenote"],
  [["24", "34", "54"], "credit", "remittance"], [["29", "39"], "debit", "remittance"],
] as const) for (const code of codes) types[code] = Object.freeze({ direction, kind, loan: code.startsWith("5") });
export const ACH_ENTRY_TYPES: Readonly<Record<string, AchEntryType>> = Object.freeze(types);
