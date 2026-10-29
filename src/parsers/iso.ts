import type { FindingLocation, FormatPack, IsoVersionIdentifiers, RuleResult, ValidationContext } from "../types";
import { findProhibitedDeclaration } from "../prohibited-declarations";
import { result } from "./shared";
import { children, parseXml, XmlSyntaxError, type XmlNode } from "./xml-adapter";

export interface ParserOutput {
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
  let root: XmlNode;
  try { root = parseXml(source); } catch (error) {
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
    return { context: null, results: [{ ...result(0, "iso.namespace-version", "ERROR", "Message version", "/Document/@xmlns",
      "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded."), location: nodeLocation([], root) }] };
  }
  add("iso.namespace-version", true, "Message version", "/Document/@xmlns", "The XML namespace matches the selected message version; this does not establish conformance.");
  const path = `/Document/${ids.messageContainer}`;
  const containers = children(root, ids.messageContainer, ids.namespace);
  add("iso.message-container", containers.length === 1, "Message container", path, "Exactly one message container in the selected namespace is required.", nodeLocation(containers, root));
  if (containers.length !== 1) return { context: null, results };
  const container = containers[0]!;
  const headers = children(container, "GrpHdr", ids.namespace);
  add("iso.group-header", headers.length === 1, "Group header", `${path}/GrpHdr`, "Exactly one group header in the selected namespace is required.", nodeLocation(headers, container));
  if (headers.length === 1) {
    const header = headers[0]!;
    const messages = children(header, "MsgId", ids.namespace);
    add("iso.message-id", messages.length === 1 && messages[0]!.children.length === 0 && Boolean(messages[0]!.text.trim()), "Message ID", `${path}/GrpHdr/MsgId`, "Exactly one populated MsgId element is required; an attribute cannot satisfy it.", nodeLocation(messages, header));
    const counts = children(header, "NbOfTxs", ids.namespace);
    add("iso.transaction-count-type", counts.length === 1 && counts[0]!.children.length === 0 && /^\d{1,15}$/.test(counts[0]!.text.trim()), "Number of transactions", `${path}/GrpHdr/NbOfTxs`, "Exactly one NbOfTxs element containing 1 to 15 digits is required.", nodeLocation(counts, header));
  }
  const payments = children(container, "PmtInf", ids.namespace);
  add("iso.payment-information", payments.length > 0, "Payment information", `${path}/PmtInf`, "At least one payment information block in the selected namespace is required.", nodeLocation(payments, container));
  return { context: { source, parserKind: "ISO_XML" }, results };
}
