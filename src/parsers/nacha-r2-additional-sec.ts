import { ACH_ENTRY_TYPES } from "./nacha-entry-types";
import { number, slice, type RecordRow } from "./fixed-record";

/**
 * Executable rule definitions for #75; NOT an SEC registry or an active parser.
 * PR #76 owns registry/dispatch and must call these hooks after shared framing
 * and record-order checks. Until then the selectable R2 pack is unchanged.
 * Requirements, sources and deliberate exclusions: docs/NACHA_R2_SEC_RULE_REGISTER.md.
 */
export type AdditionalR2Sec = "CIE" | "ARC" | "BOC" | "POP";
export const NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS = Object.freeze([
  "nacha.cie-identification", "nacha.check-serial", "nacha.check-amount-limit", "nacha.pop-terminal",
] as const);
export const NACHA_R2_ADDITIONAL_SEC_REUSED_HOOK_IDS = Object.freeze([
  "nacha.entry-required", "nacha.field-padding", "nacha.entry-amount", "nacha.sec-transaction",
  "nacha.reversal-marker", "nacha.reversal-transaction", "nacha.addenda-indicator",
  "nacha.addenda-count", "nacha.addenda-type", "nacha.addenda-sequence", "nacha.addenda-link",
] as const);
type FullRuleId = typeof NACHA_R2_ADDITIONAL_SEC_NEW_RULE_IDS[number] | typeof NACHA_R2_ADDITIONAL_SEC_REUSED_HOOK_IDS[number];
export type AdditionalR2CheckId = FullRuleId extends `nacha.${infer Id}` ? Id : never;

/** Matches the existing parser's bounded aggregation callbacks and bare IDs. */
export interface R2SecChecks {
  check(id: AdditionalR2CheckId, ok: boolean, field: string, message: string, row: RecordRow, from: number, to: number, warning?: boolean): void;
  incomplete(id: AdditionalR2CheckId, reason: string): void;
}
export interface R2SecEntry {
  readonly entry: RecordRow;
  readonly addenda: readonly RecordRow[];
}
export interface R2SecBatch {
  readonly header: RecordRow;
  readonly entries: readonly R2SecEntry[];
}
export interface AdditionalR2SecDefinition {
  readonly sec: AdditionalR2Sec;
  readonly maximumAddenda: 0 | 1;
  readonly nameColumns: readonly [number, number];
  readonly nameRequired: boolean;
  readonly identificationColumns: readonly [number, number];
  readonly validateBatch: (batch: R2SecBatch, checks: R2SecChecks) => void;
}

const MAX_CHECK_CENTS = 2_500_000n;
// R26 says all spaces or all zeros. Do not impose a digits-only identifier rule
// or silently strip permitted internal/padding spaces to invent another rule.
const populatedNotAllZero = (value: string): boolean => value.trim().length > 0 && !/^0+$/.test(value);
const entryIsFramed = ({ entry, addenda }: R2SecEntry): boolean =>
  entry.text.length === 94 && entry.text[0] === "6" && addenda.every(row => row.text.length === 94 && row.text[0] === "7");

function applicableIds(sec: AdditionalR2Sec): readonly AdditionalR2CheckId[] {
  const reused = NACHA_R2_ADDITIONAL_SEC_REUSED_HOOK_IDS.map(id => id.slice(6) as AdditionalR2CheckId);
  return [...reused, ...(sec === "CIE" ? ["cie-identification"] as const : ["check-serial", "check-amount-limit"] as const), ...(sec === "POP" ? ["pop-terminal"] as const : [])];
}

function validateBatch(sec: AdditionalR2Sec, batch: R2SecBatch, checks: R2SecChecks): void {
  const { header, entries } = batch;
  const { check, incomplete } = checks;
  // A misrouted/malformed envelope never creates a PASS in a profile hook.
  if (header.text.length !== 94 || header.text[0] !== "5" || slice(header, 51, 53) !== sec || !entries.length || !entries.every(entryIsFramed)) {
    for (const id of applicableIds(sec)) incomplete(id, "The SEC hook requires a matching, framed, nonempty batch and adjacent entry/addenda groups from the shared parser.");
    return;
  }
  const service = slice(header, 2, 4);
  const serviceKnown = ["200", "220", "225"].includes(service);
  const description = slice(header, 54, 63);
  const declaresReversal = description.toUpperCase().includes("REVERSAL");
  const reversal = description.includes("REVERSAL");
  if (declaresReversal) check("reversal-marker", reversal, "Reversal description", "Use uppercase REVERSAL within the batch Company Entry Description (columns 54–63).", header, 54, 63);
  // Bank submission files can contain same-batch balancing offsets. A file
  // cannot identify their role reliably; mixed service-200 direction conflicts
  // are warnings, never an inferred exemption or a fabricated passing check.
  let hasCredit = false, hasDebit = false, unknownType = false;
  for (const { entry } of entries) {
    const type = ACH_ENTRY_TYPES[slice(entry, 2, 3)];
    hasCredit ||= type?.direction === "credit";
    hasDebit ||= type?.direction === "debit";
    unknownType ||= !type;
  }
  const possibleOffset = service === "200" && hasCredit && hasDebit;

  for (const { entry, addenda } of entries) {
    const code = slice(entry, 2, 3);
    const type = ACH_ENTRY_TYPES[code];
    const ordinaryDirection = sec === "CIE" ? "credit" : "debit";
    const uncertainProfile = !type || (!declaresReversal && (possibleOffset || (service === "200" && unknownType)) && type.direction !== ordinaryDirection);
    const uncertainReason = !type
      ? "The transaction code does not establish an ordinary entry layout for this SEC hook."
      : "This opposite-direction entry may be an ODFI balancing offset; its SEC-specific field requirements cannot be established from the file alone.";
    const specific = (id: AdditionalR2CheckId, ok: boolean, field: string, message: string, from: number, to: number): void => {
      if (uncertainProfile) incomplete(id, uncertainReason);
      else check(id, ok, field, message, entry, from, to);
    };
    const required = (from: number, to: number, field: string): void =>
      check("entry-required", slice(entry, from, to).trim().length > 0, field, `Populate ${field.toLowerCase()} in ${sec} Entry Detail columns ${from}–${to}.`, entry, from, to);
    required(13, 29, "Receiving account");
    if (sec === "CIE") {
      if (uncertainProfile) incomplete("entry-required", uncertainReason);
      else required(40, 54, "Individual name");
      specific("cie-identification", populatedNotAllZero(slice(entry, 55, 76)), "CIE individual identification", "Populate CIE columns 55–76 with the payer identifier used by the biller; the field cannot be all spaces or all zeros. The name belongs in columns 40–54.", 55, 76);
    } else {
      const end = sec === "POP" ? 48 : 54;
      specific("check-serial", populatedNotAllZero(slice(entry, 40, end)), "Check serial number", `Populate ${sec} columns 40–${end} with the source check serial number; the field cannot be all spaces or all zeros. Alphanumeric serials and leading zeros are permitted.`, 40, end);
      if (sec === "POP") {
        for (const [from, to, label] of [[49, 52, "city"], [53, 54, "state"]] as const)
          specific("pop-terminal", populatedNotAllZero(slice(entry, from, to)), `POP terminal ${label}`, `Populate POP terminal ${label} in columns ${from}–${to}; the field cannot be all spaces or all zeros.`, from, to);
      }
    }
    const fields: readonly (readonly [number, number])[] = sec === "POP"
      ? [[13, 29], [40, 48], [49, 52], [53, 54], [55, 76], [77, 78]]
      : [[13, 29], [40, 54], [55, 76], [77, 78]];
    for (const [from, to] of fields) {
      if (uncertainProfile && from !== 13) { incomplete("field-padding", uncertainReason); continue; }
      const value = slice(entry, from, to);
      check("field-padding", !value.trim() || !value.startsWith(" "), "Alphanumeric field padding", `Left justify the nonblank ${sec} field at columns ${from}–${to} and pad unused columns with spaces.`, entry, from, to);
    }

    const amount = number(slice(entry, 30, 39));
    if (type) {
      check("entry-amount", amount !== null && (type.kind === "monetary" ? amount > 0n : amount === 0n), "Entry amount", "Use ten numeric amount columns in integer cents; monetary entries require a positive amount and prenotes require zero.", entry, 30, 39);
    } else incomplete("entry-amount", "The transaction type is not recognized by the shared R2 transaction-code definitions.");
    if (sec !== "CIE") {
      if (uncertainProfile) incomplete("check-amount-limit", uncertainReason);
      else if (amount === null) incomplete("check-amount-limit", "The check amount is not numeric, so the $25,000 upper bound was not evaluated.");
      else specific("check-amount-limit", amount <= MAX_CHECK_CENTS, "Check-conversion amount", `${sec} amount in columns 30–39 must not exceed $25,000.00 (2,500,000 cents). Exactly $25,000.00 is permitted.`, 30, 39);
    }

    if (!type || !serviceKnown || (declaresReversal && !reversal)) {
      incomplete("sec-transaction", "SEC/direction evaluation requires a recognized transaction type, service class and correctly cased reversal declaration.");
    } else {
      const matchesService = service === "200" || (service === "220" ? type.direction === "credit" : type.direction === "debit");
      if (!matchesService) {
        check("sec-transaction", false, "SEC and service class transaction", `Transaction direction must match batch service class ${service}: 220 permits credits and 225 permits debits. Correct entry columns 2–3 or the batch service class.`, entry, 2, 3);
      } else if (type.kind === "remittance") {
        check("sec-transaction", false, "SEC and service class transaction", `${sec} does not permit zero-dollar remittance transaction codes. Use an applicable prenote code for prenotification, or the SEC appropriate to the actual payment.`, entry, 2, 3);
      } else {
        const directionAllowed = type.direction === ordinaryDirection || (reversal && type.kind === "monetary");
        if (!directionAllowed && service === "200" && unknownType) {
          incomplete("sec-transaction", "An unknown transaction type prevents determining whether the service-200 batch contains balancing entries.");
        } else {
          check("sec-transaction", directionAllowed, "SEC and service class transaction", possibleOffset && !reversal
            ? `${sec} normally requires ${ordinaryDirection} entries. This mixed service-200 batch contains the opposite direction without REVERSAL; confirm the entry is an ODFI-required balancing offset, or correct its SEC or reversal declaration.`
            : `${sec} requires ${ordinaryDirection} entries except monetary reversals declared with REVERSAL in batch columns 54–63. Correct the transaction code or the batch declaration.`, entry, 2, 3, !directionAllowed && possibleOffset && !reversal);
        }
      }
    }
    if (declaresReversal || code === "55") {
      if (!type || (declaresReversal && !reversal)) incomplete("reversal-transaction", "Reversal eligibility requires an interpretable transaction type and correctly cased declaration.");
      else check("reversal-transaction", reversal && type.kind === "monetary", "Reversal entry type", "Declared reversals must be monetary entries; loan debit code 55 also requires REVERSAL in the batch description. Prenotes cannot reverse a monetary entry.", entry, 2, 3);
    }

    const indicator = slice(entry, 79, 79);
    const max = sec === "CIE" ? 1 : 0;
    if (uncertainProfile) {
      if (indicator !== (addenda.length ? "1" : "0")) check("addenda-indicator", false, "Addenda indicator", "Set entry column 79 to 0 without addenda or 1 when addenda are present.", entry, 79, 79);
      for (const id of ["addenda-count", "addenda-indicator"] as const) incomplete(id, uncertainReason);
      if (addenda.length) for (const id of ["addenda-type", "addenda-sequence", "addenda-link"] as const) incomplete(id, uncertainReason);
      continue;
    }
    check("addenda-count", addenda.length <= max, "Addenda count", sec === "CIE" ? "A CIE entry permits at most one type-05 addenda record; remove extra addenda or use the appropriate payment format." : `${sec} entries do not permit addenda records; remove the following type-7 records.`, entry, 79, 79);
    check("addenda-indicator", indicator === (addenda.length ? "1" : "0") && (sec === "CIE" || indicator === "0"), "Addenda indicator", sec === "CIE" ? "Set CIE column 79 to 0 without addenda or 1 when the single permitted addenda is present." : `Set ${sec} column 79 to 0; these entries do not permit addenda.`, entry, 79, 79);
    if (sec !== "CIE") continue; // Do not report inapplicable addenda format checks as passing.
    for (const [index, row] of addenda.entries()) {
      const paymentAddenda = slice(row, 2, 3) === "05";
      check("addenda-type", paymentAddenda, "Addenda type", "A CIE origination addenda must use type 05 in columns 2–3. Return and notification records belong to their respective formats.", row, 2, 3);
      if (!paymentAddenda) {
        incomplete("addenda-sequence", "A non-type-05 record has no qualified CIE payment-addenda layout.");
        incomplete("addenda-link", "A non-type-05 record has no qualified CIE payment-addenda layout.");
        continue;
      }
      // Max-one is enforced separately; retain the shared consecutive sequence rule.
      check("addenda-sequence", number(slice(row, 84, 87)) === BigInt(index + 1), "Addenda sequence", "The CIE addenda sequence in columns 84–87 must start at 0001; CIE permits only one addenda record.", row, 84, 87);
      if (number(slice(entry, 88, 94)) === null) incomplete("addenda-link", "The parent entry trace sequence is not numeric.");
      else check("addenda-link", number(slice(row, 88, 94)) !== null && slice(row, 88, 94) === slice(entry, 88, 94), "Addenda entry sequence", "Addenda columns 88–94 must match the last seven digits of the preceding entry trace number.", row, 88, 94);
    }
  }
}

const define = (sec: AdditionalR2Sec): AdditionalR2SecDefinition => Object.freeze({
  sec,
  maximumAddenda: sec === "CIE" ? 1 : 0,
  nameColumns: Object.freeze(sec === "CIE" ? [40, 54] as const : [55, 76] as const),
  nameRequired: sec === "CIE",
  identificationColumns: Object.freeze(sec === "CIE" ? [55, 76] as const : sec === "POP" ? [40, 48] as const : [40, 54] as const),
  validateBatch: (batch: R2SecBatch, checks: R2SecChecks): void => validateBatch(sec, batch, checks),
});
// Named definitions only. Registration and per-batch dispatch belong to #76.
export const CIE_R2_DEFINITION = define("CIE");
export const ARC_R2_DEFINITION = define("ARC");
export const BOC_R2_DEFINITION = define("BOC");
export const POP_R2_DEFINITION = define("POP");
