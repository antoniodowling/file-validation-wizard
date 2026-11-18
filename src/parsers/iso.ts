import type { FindingLocation, FormatPack, IsoVersionIdentifiers, RuleResult, ValidationContext } from "../types";
import { findProhibitedDeclaration } from "../prohibited-declarations";
import { result } from "./shared";
import { children, parseXmlDocument, XmlSyntaxError, type XmlNode } from "./xml-adapter";

export interface ParserOutput {
  readonly incompleteChecks?: readonly { readonly ruleId: string; readonly reason: string }[];
  readonly reportedDisposition?: import("../types").ReportedDisposition;
  readonly notApplicable?: readonly string[];
  /** A promised occurrence could not run; retain other occurrence evidence without claiming complete evaluation. */
  readonly notEvaluated?: readonly string[];
  readonly context: ValidationContext | null;
  readonly results: readonly RuleResult[];
}
export function nodeLocation(nodes: readonly XmlNode[], parent?: XmlNode): FindingLocation {
  const selected = nodes.length ? nodes : parent ? [parent] : [];
  const targets = selected.slice(0, 33).map((node) => ({
    kind: nodes.length ? "exact" as const : "context" as const,
    label: nodes.length ? `Element ${node.local}` : `Parent context; expected child is absent`,
    span: node.span,
  }));
  return targets[0] ? { kind: "located", primary: targets[0], related: targets.slice(1), relatedTruncated: selected.length > 33 }
    : { kind: "file-wide", explanation: "No trustworthy parent element is available." };
}
export function parseIso(source: string, pack: FormatPack): ParserOutput {
  const results: RuleResult[] = [];
  const add = (id: string, ok: boolean, field: string, path: string, message: string, location?: FindingLocation): void => {
    results.push({ ...result(results.length, id, ok ? "PASS" : "ERROR", field, path, message), ...(location ? { location } : {}) });
  };
  const prohibited = findProhibitedDeclaration(source);
  add("iso.safe-declarations", !prohibited, "XML declarations", "file", prohibited ? "DTD and entity declarations are prohibited by tool policy." : "No prohibited DTD or entity declaration is present.",
    prohibited ? { kind: "located", primary: { kind: "exact", label: "Prohibited declaration", span: { start: prohibited.index, end: prohibited.index + prohibited.length } }, related: [] } : undefined);
  if (prohibited) return { context: null, results };
  // Missing document content is a parser failure, not an independent payment rule.
  if (pack.version === "pain.001.001.03" && !source.trim()) {
    add("iso.well-formed", false, "XML document", "file", "The selected XML file is empty.",
      { kind: "file-wide", explanation: "No XML document content is present." });
    return { context: null, results };
  }
  let root: XmlNode;
  let hasDeclaration: boolean;
  try { ({ root, hasDeclaration } = parseXmlDocument(source)); } catch (error) {
    if (!(error instanceof XmlSyntaxError)) throw error;
    add("iso.well-formed", false, "XML document", "file", "The XML document is not well formed or has invalid namespace bindings. Dependent ISO checks were not evaluated.", {
      kind: "located", primary: { kind: "parser-position", label: "Parser stop; the cause may precede this position", span: { start: error.offset, end: error.offset } }, related: [],
    });
    return { context: null, results };
  }
  add("iso.well-formed", true, "XML document", "file", "XML 1.0 syntax and namespace bindings are well formed.");
  add("iso.document-root", root.local === "Document", "Document root", "/Document", root.local === "Document" ? "The required Document root is present." : "The required Document root is missing.", nodeLocation([root]));
  if (root.local !== "Document") return { context: null, results };
  const ids = pack.identifiers as IsoVersionIdentifiers;
  if (root.uri !== ids.namespace) {
    add("iso.namespace-version", false, "Message version", "/Document/@xmlns",
      "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded.", nodeLocation([], root));
    return { context: null, results };
  }
  add("iso.namespace-version", true, "Message version", "/Document/@xmlns", "The XML namespace matches the selected message version; this does not establish conformance.");
  const path = "/Document/" + ids.messageContainer;
  const containers = children(root, ids.messageContainer, ids.namespace);
  add("iso.message-container", containers.length === 1, "Message container", path,
    "Exactly one message container in the selected namespace is required.", nodeLocation(containers, root));
  if (containers.length !== 1) return { context: null, results };
  const container = containers[0]!;
  const pain00103 = pack.version === "pain.001.001.03";
  const headers = children(container, "GrpHdr", ids.namespace);
  add("iso.group-header", headers.length === 1, "Group header", path + "/GrpHdr",
    "Exactly one group header in the selected namespace is required.", nodeLocation(headers, container));

  // These extra checks apply ONLY to the original pain.001.001.03 schema.
  // They are intentionally partial: no XSD ordering/complete content model,
  // bank-specific conditional fields, or payment execution claim is made.
  const textValue = (node: XmlNode, maxLength?: number): boolean =>
    node.children.length === 0 && node.text.length > 0 &&
    (maxLength === undefined || Array.from(node.text).length <= maxLength);
  const nonblankValue = (node: XmlNode): boolean =>
    node.children.length === 0 && node.text.trim().length > 0;
  const requiredChild = (id: string, parents: readonly XmlNode[], childName: string,
    parentPath: string, explanation: string, isValid: (child: XmlNode) => boolean = () => true): void => {
    let location: FindingLocation | undefined;
    for (const parent of parents) {
      const matches = children(parent, childName, ids.namespace);
      if (matches.length !== 1 || !isValid(matches[0]!)) {
        // A missing child points to its parent context; a malformed present child
        // uses the actual element span. Never invent an exact span for absence.
        location ??= nodeLocation(matches, parent);
      }
    }
    add(id, location === undefined, childName, parentPath + "/" + childName, explanation, location);
  };
  if (headers.length === 1) {
    const header = headers[0]!;
    const messages = children(header, "MsgId", ids.namespace);
    // Max35Text is a code-point limit, not a UTF-16-unit limit. The nonblank
    // restriction remains an explicitly separate local data-quality policy.
    const validMessage = messages.length === 1 && messages[0]!.children.length === 0
      && Boolean(messages[0]!.text.trim())
      && (!pain00103 || Array.from(messages[0]!.text).length <= 35);
    add("iso.message-id", validMessage, "Message ID", path + "/GrpHdr/MsgId", pain00103
      ? "Exactly one MsgId element with 1 to 35 characters and a nonblank value is required."
      : "Exactly one populated MsgId element is required; an attribute cannot satisfy it.", nodeLocation(messages, header));
    const counts = children(header, "NbOfTxs", ids.namespace);
    add("iso.transaction-count-type",
      counts.length === 1 && counts[0]!.children.length === 0 && /^\d{1,15}$/.test(counts[0]!.text),
      "Number of transactions", path + "/GrpHdr/NbOfTxs",
      "Exactly one NbOfTxs element containing 1 to 15 digits is required.", nodeLocation(counts, header));
    if (pain00103) {
      requiredChild("iso.creation-date-time", [header], "CreDtTm", path + "/GrpHdr",
        "Exactly one nonempty scalar CreDtTm is required in the group header; full ISODateTime lexical validation is not yet implemented.", nonblankValue);
      // PartyIdentification32 has no universally mandatory nested name/ID.
      requiredChild("iso.initiating-party", [header], "InitgPty", path + "/GrpHdr",
        "Exactly one InitgPty element is required in the group header.");
    }
  }

  const payments = children(container, "PmtInf", ids.namespace);
  add("iso.payment-information", payments.length > 0, "Payment information", path + "/PmtInf",
    "At least one payment information block in the selected namespace is required.", nodeLocation(payments, container));

  const notEvaluated: string[] = [];
  if (pain00103 && payments.length) {
    const paymentPath = path + "/PmtInf";
    requiredChild("iso.payment-information-id", payments, "PmtInfId", paymentPath,
      "Every PmtInf requires exactly one scalar PmtInfId of 1 to 35 characters.", node => textValue(node, 35));
    requiredChild("iso.payment-method", payments, "PmtMtd", paymentPath,
      "Every PmtInf requires one PmtMtd using the .03 codes CHK, TRF or TRA.",
      node => node.children.length === 0 && ["CHK", "TRF", "TRA"].includes(node.text));
    requiredChild("iso.requested-execution-date", payments, "ReqdExctnDt", paymentPath,
      "Every PmtInf requires exactly one populated scalar ReqdExctnDt; full ISODate lexical validation is not yet implemented.", nonblankValue);
    // PartyIdentification32 itself permits optional name/identifier fields;
    // do not impose ACH- or Huntington-conditional choices without rail scope.
    requiredChild("iso.debtor", payments, "Dbtr", paymentPath,
      "Every PmtInf requires exactly one Dbtr party element.");
    requiredChild("iso.debtor-account", payments, "DbtrAcct", paymentPath,
      "Every PmtInf requires one DbtrAcct with a single Id choice (IBAN or Othr).", node => {
        const accountIds = children(node, "Id", ids.namespace);
        if (accountIds.length !== 1) return false;
        const iban = children(accountIds[0]!, "IBAN", ids.namespace);
        const other = children(accountIds[0]!, "Othr", ids.namespace);
        if (iban.length + other.length !== 1) return false;
        if (iban.length) return textValue(iban[0]!);
        const otherIds = children(other[0]!, "Id", ids.namespace);
        return otherIds.length === 1 && textValue(otherIds[0]!, 34);
      });
    requiredChild("iso.debtor-agent", payments, "DbtrAgt", paymentPath,
      "Every PmtInf requires one DbtrAgt with exactly one FinInstnId element.",
      node => children(node, "FinInstnId", ids.namespace).length === 1);

    const missingTransactions = payments.find(payment => children(payment, "CdtTrfTxInf", ids.namespace).length === 0);
    add("iso.credit-transfer-transactions", missingTransactions === undefined,
      "Credit transfer transactions", paymentPath + "/CdtTrfTxInf",
      "Every PmtInf requires at least one CdtTrfTxInf.",
      missingTransactions ? nodeLocation([], missingTransactions) : undefined);

    if (missingTransactions) {
      // Never report aggregate PASS for transaction checks when one payment
      // block has no qualified transaction scope.
      notEvaluated.push("iso.credit-transfer-identification", "iso.credit-transfer-amount",
        "iso.transaction-count-reconciliation");
    } else {
      const transfers = payments.flatMap(payment => children(payment, "CdtTrfTxInf", ids.namespace));
      const transactionPath = paymentPath + "/CdtTrfTxInf";
      requiredChild("iso.credit-transfer-identification", transfers, "PmtId", transactionPath,
        "Every CdtTrfTxInf requires PmtId with a 1–35 character EndToEndId.", node => {
          const values = children(node, "EndToEndId", ids.namespace);
          return values.length === 1 && textValue(values[0]!, 35);
        });
      requiredChild("iso.credit-transfer-amount", transfers, "Amt", transactionPath,
        "Every CdtTrfTxInf requires Amt with exactly one InstdAmt or EqvtAmt branch.", node => {
          const instructed = children(node, "InstdAmt", ids.namespace);
          const equivalent = children(node, "EqvtAmt", ids.namespace);
          if (instructed.length + equivalent.length !== 1) return false;
          const currencyAmount = (item: XmlNode): boolean =>
            textValue(item) && /^[A-Z]{3}$/.test(item.attributes["{}Ccy"] ?? "");
          if (instructed.length) return currencyAmount(instructed[0]!);
          const amounts = children(equivalent[0]!, "Amt", ids.namespace);
          const currencies = children(equivalent[0]!, "CcyOfTrf", ids.namespace);
          return amounts.length === 1 && currencyAmount(amounts[0]!) &&
            currencies.length === 1 && currencies[0]!.children.length === 0 &&
            /^[A-Z]{3}$/.test(currencies[0]!.text);
        });

      if (headers.length === 1) {
        const counts = children(headers[0]!, "NbOfTxs", ids.namespace);
        if (counts.length === 1 && counts[0]!.children.length === 0 && /^\d{1,15}$/.test(counts[0]!.text)) {
          add("iso.transaction-count-reconciliation", BigInt(counts[0]!.text) === BigInt(transfers.length),
            "Number of transactions", path + "/GrpHdr/NbOfTxs",
            "GrpHdr/NbOfTxs must equal the actual number of CdtTrfTxInf elements across all PmtInf blocks.",
            nodeLocation(counts, headers[0]!));
        }
        // An invalid count is already reported by iso.transaction-count-type;
        // the dependent reconciliation remains not-evaluated, not PASS.
      }
    }
  }
  return { context: { source, parserKind: "ISO_XML", xml: { hasDeclaration } }, results,
    ...(notEvaluated.length ? { notEvaluated } : {}) };
}
