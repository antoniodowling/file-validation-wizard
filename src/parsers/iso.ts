import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  FormatPack,
  IsoDocument,
  IsoVersionIdentifiers,
  RuleResult,
  ValidationContext,
} from "../types";
import {
  entriesByLocalName,
  firstObjectByLocalName,
  localName,
  result,
  scalarByLocalName,
} from "./shared";

export interface ParserOutput {
  readonly context: ValidationContext | null;
  readonly results: readonly RuleResult[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  allowBooleanAttributes: false,
});

function namespaceForRoot(rootName: string, root: Readonly<Record<string, unknown>>): string {
  const prefix = rootName.includes(":") ? rootName.split(":")[0] : null;
  const value = root[prefix ? `@_xmlns:${prefix}` : "@_xmlns"];
  return typeof value === "string" ? value : "";
}

export function parseIso(source: string, pack: FormatPack): ParserOutput {
  const results: RuleResult[] = [];
  const declarationIsSafe = !/<!DOCTYPE|<!ENTITY/i.test(source);
  results.push(
    result(
      results.length,
      "iso.safe-declarations",
      declarationIsSafe ? "PASS" : "ERROR",
      "XML declarations",
      "file",
      declarationIsSafe
        ? "No prohibited DTD or entity declaration is present."
        : "DTD and entity declarations are not allowed.",
    ),
  );
  if (!declarationIsSafe) return { context: null, results };

  const validation = XMLValidator.validate(source, { allowBooleanAttributes: false });
  const isWellFormed = validation === true;
  results.push(
    result(
      results.length,
      "iso.well-formed",
      isWellFormed ? "PASS" : "ERROR",
      "XML document",
      "file",
      isWellFormed
        ? "The XML document is well formed."
        : `The XML document is not well formed: ${validation.err.msg}`,
    ),
  );
  if (!isWellFormed) return { context: null, results };

  const parsed = parser.parse(source) as Readonly<Record<string, unknown>>;
  const rootEntry = Object.entries(parsed).find(([key]) => !key.startsWith("?"));
  const rootName = rootEntry?.[0] ?? "";
  const root =
    rootEntry?.[1] && typeof rootEntry[1] === "object" && !Array.isArray(rootEntry[1])
      ? (rootEntry[1] as Readonly<Record<string, unknown>>)
      : null;
  const hasDocumentRoot = localName(rootName) === "Document" && root !== null;
  results.push(
    result(
      results.length,
      "iso.document-root",
      hasDocumentRoot ? "PASS" : "ERROR",
      "Document root",
      "/Document",
      hasDocumentRoot ? "The required Document root is present." : "The required Document root is missing.",
    ),
  );
  if (!hasDocumentRoot || !root) return { context: null, results };

  const identifiers = pack.identifiers as IsoVersionIdentifiers;
  const namespace = namespaceForRoot(rootName, root);
  const namespaceMatches = namespace === identifiers.namespace;
  if (!namespaceMatches) {
    return {
      context: null,
      results: [
        result(
          0,
          "iso.namespace-version",
          "ERROR",
          "Message version",
          "/Document/@xmlns",
          "The XML namespace does not match the selected format version. Ensure the file format type/version you selected matches the file you uploaded.",
        ),
      ],
    };
  }
  results.push(
    result(
      results.length,
      "iso.namespace-version",
      "PASS",
      "Message version",
      "/Document/@xmlns",
      "The XML namespace matches the approved message version.",
    ),
  );

  const container = firstObjectByLocalName(root, identifiers.messageContainer);
  const hasContainer = container !== null;
  results.push(
    result(
      results.length,
      "iso.message-container",
      hasContainer ? "PASS" : "ERROR",
      "Message container",
      `/Document/${identifiers.messageContainer}`,
      hasContainer
        ? `The ${identifiers.messageContainer} message container is present.`
        : `The required ${identifiers.messageContainer} message container is missing.`,
    ),
  );

  const groupHeader = firstObjectByLocalName(container, "GrpHdr");
  results.push(
    result(
      results.length,
      "iso.group-header",
      groupHeader ? "PASS" : "ERROR",
      "Group header",
      `/Document/${identifiers.messageContainer}/GrpHdr`,
      groupHeader ? "The group header is present." : "The required group header is missing.",
    ),
  );

  const messageId = scalarByLocalName(groupHeader, "MsgId");
  results.push(
    result(
      results.length,
      "iso.message-id",
      messageId ? "PASS" : "ERROR",
      "Message ID",
      `/Document/${identifiers.messageContainer}/GrpHdr/MsgId`,
      messageId ? "The message ID is populated." : "The required message ID is missing or blank.",
    ),
  );

  const paymentBlocks = entriesByLocalName(container, "PmtInf");
  results.push(
    result(
      results.length,
      "iso.payment-information",
      paymentBlocks.length > 0 ? "PASS" : "ERROR",
      "Payment information",
      `/Document/${identifiers.messageContainer}/PmtInf`,
      paymentBlocks.length > 0
        ? `${paymentBlocks.length} payment information block(s) found.`
        : "At least one payment information block is required.",
    ),
  );

  const transactionCount = scalarByLocalName(groupHeader, "NbOfTxs");
  const countIsValid = transactionCount !== null && /^\d{1,15}$/.test(transactionCount);
  results.push(
    result(
      results.length,
      "iso.transaction-count-type",
      countIsValid ? "PASS" : "ERROR",
      "Number of transactions",
      `/Document/${identifiers.messageContainer}/GrpHdr/NbOfTxs`,
      countIsValid
        ? "The transaction count uses the required integer syntax."
        : "The transaction count is required and must contain 1 to 15 digits.",
    ),
  );

  const iso: IsoDocument = Object.freeze({
    rootName,
    namespace,
    containerName: hasContainer ? identifiers.messageContainer : null,
    container,
  });
  return {
    context: Object.freeze({ source, parserKind: "ISO_XML", iso }),
    results,
  };
}
