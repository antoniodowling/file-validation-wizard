import type { SyntaxNode } from "@lezer/common";
import { parser as xmlLocationParser } from "@lezer/xml";
import { XMLValidator } from "fast-xml-parser";
import { MAX_SOURCE_INDEX_CHARACTERS } from "./explorer-budget";
import { scanEdiSegments, type LocatedEdiElement, type LocatedEdiSegment } from "./parsers/edi-source";
import { isValidSourceSpan, sourceOffsetAtLineColumn, trimSourceSpan } from "./source-coordinates";
import type {
  EdiVersionIdentifiers,
  FindingLocation,
  FindingLocationEntry,
  FormatPack,
  IsoVersionIdentifiers,
  RuleResult,
  SourceSpan,
  SourceTarget,
  SourceTargetKind,
  ValidationRun,
} from "./types";

export const MAX_RELATED_SOURCE_TARGETS = 32;

function span(start: number, end: number): SourceSpan {
  return Object.freeze({ start, end });
}

function target(kind: SourceTargetKind, label: string, sourceSpan: SourceSpan): SourceTarget {
  return Object.freeze({ kind, label, span: sourceSpan });
}

function unavailable(explanation: string): FindingLocation {
  return Object.freeze({ kind: "unavailable", explanation });
}

function fileWide(explanation: string): FindingLocation {
  return Object.freeze({ kind: "file-wide", explanation });
}

function located(targets: readonly SourceTarget[]): FindingLocation {
  const [primary, ...remaining] = targets;
  if (!primary) return unavailable("No reliable source target could be established for this finding.");
  const relatedTruncated = remaining.length > MAX_RELATED_SOURCE_TARGETS;
  return Object.freeze({
    kind: "located",
    primary,
    related: Object.freeze(remaining.slice(0, MAX_RELATED_SOURCE_TARGETS)),
    ...(relatedTruncated ? { relatedTruncated: true } : {}),
  });
}

function validatedLocation(location: FindingLocation, sourceLength: number): FindingLocation {
  if (location.kind !== "located") return location;
  const targets = [location.primary, ...location.related];
  if (targets.some((entry) => !isValidSourceSpan(entry.span, sourceLength))) {
    return unavailable("The source location was outside the accepted source snapshot and was discarded.");
  }
  return location;
}

function localName(name: string): string {
  return name.split(":").at(-1) ?? name;
}

function directChildren(node: SyntaxNode): readonly SyntaxNode[] {
  const children: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) children.push(child);
  return children;
}

function directChild(node: SyntaxNode | null, name: string): SyntaxNode | null {
  if (!node) return null;
  return directChildren(node).find((child) => child.name === name) ?? null;
}

function xmlElementName(source: string, element: SyntaxNode | null): string {
  if (!element) return "";
  const tag = directChild(element, "OpenTag") ?? directChild(element, "SelfClosingTag");
  const name = directChild(tag, "TagName");
  return name ? source.slice(name.from, name.to) : "";
}

function xmlOpenTag(source: string, element: SyntaxNode | null): SourceSpan | null {
  if (!element) return null;
  const tag = directChild(element, "OpenTag") ?? directChild(element, "SelfClosingTag");
  return tag ? span(tag.from, tag.to) : null;
}

function xmlElementSpan(element: SyntaxNode | null): SourceSpan | null {
  return element ? span(element.from, element.to) : null;
}

function xmlContentSpan(source: string, element: SyntaxNode | null): SourceSpan | null {
  if (!element) return null;
  const open = directChild(element, "OpenTag");
  const close = directChild(element, "CloseTag");
  if (!open || !close) return xmlElementSpan(element);
  const content = span(open.to, close.from);
  const trimmed = trimSourceSpan(source, content);
  return trimmed.start === trimmed.end ? xmlElementSpan(element) : trimmed;
}

function directXmlElement(source: string, parent: SyntaxNode | null, wanted: string): SyntaxNode | null {
  if (!parent) return null;
  return directChildren(parent).find((child) => child.name === "Element" && localName(xmlElementName(source, child)) === wanted) ?? null;
}

function rootXmlElement(tree: ReturnType<typeof xmlLocationParser.parse>): SyntaxNode | null {
  return directChildren(tree.topNode).find((child) => child.name === "Element") ?? null;
}

interface XmlAttributeLocation {
  readonly name: string;
  readonly span: SourceSpan;
  readonly valueSpan: SourceSpan | null;
}

function xmlAttributes(source: string, element: SyntaxNode | null): readonly XmlAttributeLocation[] {
  if (!element) return [];
  const tag = directChild(element, "OpenTag") ?? directChild(element, "SelfClosingTag");
  if (!tag) return [];
  return directChildren(tag)
    .filter((child) => child.name === "Attribute")
    .map((attribute) => {
      const nameNode = directChild(attribute, "AttributeName");
      const valueNode = directChild(attribute, "AttributeValue");
      let valueSpan: SourceSpan | null = valueNode ? span(valueNode.from, valueNode.to) : null;
      if (valueSpan && valueSpan.end - valueSpan.start >= 2) {
        const first = source[valueSpan.start];
        const last = source[valueSpan.end - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          valueSpan = span(valueSpan.start + 1, valueSpan.end - 1);
        }
      }
      return Object.freeze({
        name: nameNode ? source.slice(nameNode.from, nameNode.to) : "",
        span: span(attribute.from, attribute.to),
        valueSpan,
      });
    });
}

function contextForElement(source: string, element: SyntaxNode | null, label: string): SourceTarget | null {
  const sourceSpan = xmlOpenTag(source, element) ?? xmlElementSpan(element);
  return sourceSpan ? target("context", label, sourceSpan) : null;
}

function exactForElement(source: string, element: SyntaxNode | null, label: string): SourceTarget | null {
  const sourceSpan = xmlContentSpan(source, element);
  return sourceSpan ? target("exact", label, sourceSpan) : null;
}

function parserPosition(source: string): FindingLocation {
  const validation = XMLValidator.validate(source, { allowBooleanAttributes: false });
  if (validation === true) return unavailable("The XML parser did not provide a failure position.");
  const line = Number(validation.err.line);
  const column = Number(validation.err.col);
  const offset = sourceOffsetAtLineColumn(source, line, column);
  return offset === null
    ? unavailable("The XML parser reported a location that could not be mapped to the decoded source.")
    : located([target("parser-position", "Parsing stopped here", span(offset, offset))]);
}

function locateXmlFinding(
  source: string,
  pack: FormatPack,
  finding: RuleResult,
  tree: ReturnType<typeof xmlLocationParser.parse> | null,
): FindingLocation {
  if (finding.ruleId === "iso.safe-declarations") {
    const match = /<!DOCTYPE|<!ENTITY/i.exec(source);
    return match?.index === undefined
      ? unavailable("The prohibited declaration detector did not provide a source match.")
      : located([target("exact", "Prohibited declaration", span(match.index, match.index + match[0].length))]);
  }
  if (finding.ruleId === "iso.well-formed") return parserPosition(source);
  if (finding.ruleId === "demo.non-empty-source") {
    return fileWide("This finding applies to the complete file rather than a single source token.");
  }
  if (finding.ruleId === "demo.xml-declaration") {
    const firstContent = source.search(/\S/u);
    const offset = firstContent < 0 ? 0 : firstContent;
    return located([target("context", "Beginning of the document where the declaration is expected", span(offset, offset))]);
  }
  if (!tree) return unavailable("A reliable XML source index could not be created for this finding.");

  const root = rootXmlElement(tree);
  const rootName = xmlElementName(source, root);
  if (finding.ruleId === "iso.document-root") {
    const rootTarget = contextForElement(source, root, "Existing document root");
    return rootTarget ? located([rootTarget]) : fileWide("No existing document root could be used as context.");
  }
  if (!root || localName(rootName) !== "Document") {
    return unavailable("The required Document root is unavailable, so this finding cannot be mapped reliably.");
  }

  const identifiers = pack.identifiers as IsoVersionIdentifiers;
  const container = directXmlElement(source, root, identifiers.messageContainer);
  const groupHeader = directXmlElement(source, container, "GrpHdr");
  const misplacedContainer = container ? null : directChildren(root)
    .find((child) => child.name === "Element") ?? null;
  const misplacedGroupHeader = directXmlElement(source, misplacedContainer, "GrpHdr");

  if (finding.ruleId === "iso.namespace-version") {
    const prefix = rootName.includes(":") ? rootName.split(":")[0] : null;
    const wanted = prefix ? `xmlns:${prefix}` : "xmlns";
    const attribute = xmlAttributes(source, root).find((entry) => entry.name === wanted);
    if (attribute) {
      return located([target("exact", "Actual namespace declaration", attribute.valueSpan ?? attribute.span)]);
    }
    const rootTarget = contextForElement(source, root, "Document root missing the required namespace declaration");
    return rootTarget ? located([rootTarget]) : unavailable("The namespace declaration could not be located.");
  }
  if (finding.ruleId === "iso.message-container") {
    const misplaced = contextForElement(
      source,
      misplacedContainer,
      `Existing top-level element where ${identifiers.messageContainer} is required`,
    );
    if (misplaced) return located([misplaced]);
    const rootTarget = contextForElement(source, root, "Document root where the message container is expected");
    return rootTarget ? located([rootTarget]) : unavailable("The Document root could not be located.");
  }
  if (finding.ruleId === "iso.group-header") {
    const misplaced = contextForElement(
      source,
      misplacedGroupHeader,
      `Existing group header outside the required ${identifiers.messageContainer} container`,
    );
    if (misplaced) return located([misplaced]);
    const parent = contextForElement(source, container ?? root, "Nearest existing parent for the missing group header");
    return parent ? located([parent]) : unavailable("No reliable parent context could be located.");
  }
  if (finding.ruleId === "iso.message-id") {
    const messageId = directXmlElement(source, groupHeader, "MsgId");
    const exact = exactForElement(source, messageId, "Message ID evaluated by this rule");
    if (exact) return located([exact]);
    const misplaced = contextForElement(
      source,
      directXmlElement(source, misplacedGroupHeader, "MsgId"),
      `Existing Message ID outside the required ${identifiers.messageContainer} container`,
    );
    if (misplaced) return located([misplaced]);
    const parent = contextForElement(source, groupHeader ?? container ?? root, "Nearest existing parent for the missing Message ID");
    return parent ? located([parent]) : unavailable("No reliable Message ID context could be located.");
  }
  if (finding.ruleId === "iso.payment-information") {
    const misplaced = contextForElement(
      source,
      directXmlElement(source, misplacedContainer, "PmtInf"),
      `Existing payment information outside the required ${identifiers.messageContainer} container`,
    );
    if (misplaced) return located([misplaced]);
    const parent = contextForElement(source, container ?? root, "Nearest existing parent for the missing payment information");
    return parent ? located([parent]) : unavailable("No reliable payment-information context could be located.");
  }
  if (finding.ruleId === "iso.transaction-count-type") {
    const count = directXmlElement(source, groupHeader, "NbOfTxs");
    const exact = exactForElement(source, count, "Transaction count evaluated by this rule");
    if (exact) return located([exact]);
    const misplaced = contextForElement(
      source,
      directXmlElement(source, misplacedGroupHeader, "NbOfTxs"),
      `Existing transaction count outside the required ${identifiers.messageContainer} container`,
    );
    if (misplaced) return located([misplaced]);
    const parent = contextForElement(source, groupHeader ?? container ?? root, "Nearest existing parent for the missing transaction count");
    return parent ? located([parent]) : unavailable("No reliable transaction-count context could be located.");
  }
  return unavailable("This XML finding does not yet have a rule-specific source mapping.");
}

function ediElement(segment: LocatedEdiSegment | undefined, position: number): LocatedEdiElement | undefined {
  return segment?.locatedElements[position - 1];
}

function ediValue(segment: LocatedEdiSegment | undefined, position: number): string {
  return ediElement(segment, position)?.value.trim() ?? "";
}

function ediElementTarget(
  segment: LocatedEdiSegment | undefined,
  position: number,
  label: string,
): SourceTarget | null {
  const element = ediElement(segment, position);
  if (!element) return segment ? target("context", `${label} is missing from this segment`, segment.span) : null;
  const sourceSpan = element.valueSpan.start === element.valueSpan.end ? element.span : element.valueSpan;
  return target("exact", label, sourceSpan);
}

function ediSegmentTarget(segment: LocatedEdiSegment | undefined, label: string): SourceTarget | null {
  return segment ? target("context", label, segment.span) : null;
}

function presentTargets(targets: readonly (SourceTarget | null)[]): readonly SourceTarget[] {
  return targets.filter((entry): entry is SourceTarget => entry !== null);
}

function locateEdiFinding(source: string, pack: FormatPack, finding: RuleResult): FindingLocation {
  if (finding.ruleId === "demo.non-empty-source") {
    return fileWide("This finding applies to the complete file rather than a single source token.");
  }
  if (finding.ruleId === "edi.fixed-header") {
    return source.startsWith("ISA")
      ? located([target("context", "Incomplete ISA header", span(0, Math.min(106, source.length)))])
      : fileWide("The file does not begin with an ISA header, so no existing header can be highlighted.");
  }
  if (!source.startsWith("ISA") || source.length < 106) {
    return unavailable("The EDI header is incomplete, so delimiters and segment locations are unavailable.");
  }

  const segments = scanEdiSegments(source, source[3] ?? "", source[105] ?? "");
  const find = (id: string): readonly LocatedEdiSegment[] => segments.filter((segment) => segment.id === id);
  const isa = find("ISA")[0];
  const iea = find("IEA").at(-1);
  const gs = find("GS")[0];
  const ge = find("GE").at(-1);
  const sts = find("ST");
  const ses = find("SE");

  if (finding.ruleId === "edi.interchange-envelope") {
    const targets = presentTargets([
      ediSegmentTarget(isa, "Existing ISA interchange header"),
      ediSegmentTarget(iea, "Existing IEA interchange trailer"),
    ]);
    return targets.length ? located(targets) : fileWide("No ISA or IEA envelope segment could be located.");
  }
  if (finding.ruleId === "edi.functional-group-envelope") {
    const targets = presentTargets([
      ediSegmentTarget(gs, "Existing GS functional-group header"),
      ediSegmentTarget(ge, "Existing GE functional-group trailer"),
    ]);
    return targets.length ? located(targets) : fileWide("No GS or GE envelope segment could be located.");
  }
  if (finding.ruleId === "edi.transaction-set-envelope") {
    const targets = [
      ...sts.map((segment) => ediSegmentTarget(segment, "Existing ST transaction-set header")),
      ...ses.map((segment) => ediSegmentTarget(segment, "Existing SE transaction-set trailer")),
    ].filter((entry): entry is SourceTarget => entry !== null);
    return targets.length ? located(targets) : fileWide("No ST or SE transaction-set boundary could be located.");
  }
  if (finding.ruleId === "edi.transaction-set-code") {
    const mismatches = sts
      .filter((segment) => ediValue(segment, 1) !== "820")
      .map((segment) => ediElementTarget(segment, 1, `ST01 in segment ${segment.position}`))
      .filter((entry): entry is SourceTarget => entry !== null);
    if (mismatches.length) return located(mismatches);
    const parent = ediSegmentTarget(gs ?? isa, "Nearest existing envelope where an ST segment is expected");
    return parent ? located([parent]) : fileWide("No ST segment or reliable envelope context could be located.");
  }
  if (finding.ruleId === "edi.version") {
    const identifiers = pack.identifiers as EdiVersionIdentifiers;
    const targets: SourceTarget[] = [];
    if (ediValue(isa, 12) !== identifiers.isa12) {
      const entry = ediElementTarget(isa, 12, "ISA12 interchange version");
      if (entry) targets.push(entry);
    }
    if (ediValue(gs, 8) !== identifiers.gs08) {
      const entry = ediElementTarget(gs, 8, "GS08 functional-group version");
      if (entry) targets.push(entry);
    }
    if (identifiers.st03) {
      for (const segment of sts.filter((entry) => ediValue(entry, 3) !== identifiers.st03)) {
        const entry = ediElementTarget(segment, 3, `ST03 implementation version in segment ${segment.position}`);
        if (entry) targets.push(entry);
      }
    }
    return targets.length ? located(targets) : unavailable("No mismatching EDI version field could be located.");
  }
  if (finding.ruleId === "edi.control-numbers") {
    const targets: SourceTarget[] = [];
    const addPair = (
      opening: LocatedEdiSegment | undefined,
      openingPosition: number,
      closing: LocatedEdiSegment | undefined,
      closingPosition: number,
      label: string,
    ): void => {
      const left = ediValue(opening, openingPosition);
      const right = ediValue(closing, closingPosition);
      if (left !== "" && left === right) return;
      const pair = presentTargets([
        ediElementTarget(opening, openingPosition, `${label} opening control number`),
        ediElementTarget(closing, closingPosition, `${label} closing control number`),
      ]);
      targets.push(...pair);
    };
    addPair(isa, 13, iea, 2, "Interchange");
    addPair(gs, 6, ge, 2, "Functional group");
    sts.forEach((st, index) => addPair(st, 2, ses[index], 2, `Transaction set ${index + 1}`));
    return targets.length ? located(targets) : unavailable("No mismatching EDI control field could be located.");
  }
  if (finding.ruleId === "edi.segment-count") {
    const targets: SourceTarget[] = [];
    sts.forEach((st, index) => {
      const se = ses[index];
      const count = ediValue(se, 1);
      const expected = se ? se.position - st.position + 1 : null;
      if (se && /^\d+$/u.test(count) && Number(count) === expected) return;
      const primary = ediElementTarget(se, 1, `SE01 segment count for transaction ${index + 1}`)
        ?? ediSegmentTarget(st, `ST boundary for transaction ${index + 1}`);
      if (primary) targets.push(primary);
      const opening = ediSegmentTarget(st, `ST boundary for transaction ${index + 1}`);
      const closing = ediSegmentTarget(se, `SE boundary for transaction ${index + 1}`);
      if (opening && opening !== primary) targets.push(opening);
      if (closing && closing !== primary) targets.push(closing);
    });
    return targets.length ? located(targets) : unavailable("No failing transaction segment count could be located.");
  }
  if (finding.ruleId === "edi.payment-remittance") {
    return fileWide("The current rule compares aggregate ST and BPR counts and does not identify a specific missing transaction segment.");
  }
  return unavailable("This EDI finding does not yet have a rule-specific source mapping.");
}

export function locateFindings(source: string, pack: FormatPack, run: ValidationRun): readonly FindingLocationEntry[] {
  if (source.length > MAX_SOURCE_INDEX_CHARACTERS) {
    return Object.freeze(run.results
      .filter((finding) => finding.outcome !== "PASS")
      .map((finding) => {
        let location: FindingLocation;
        if (finding.ruleId === "demo.non-empty-source") {
          location = fileWide("This finding applies to the complete file rather than a single source token.");
        } else if (finding.ruleId === "demo.xml-declaration") {
          const firstContent = source.search(/\S/u);
          const offset = firstContent < 0 ? 0 : firstContent;
          location = located([target("context", "Beginning of the document where the declaration is expected", span(offset, offset))]);
        } else if (finding.ruleId === "edi.fixed-header" && source.startsWith("ISA")) {
          location = located([target("context", "Incomplete ISA header", span(0, Math.min(106, source.length)))]);
        } else {
          location = unavailable(
            `The decoded source exceeds the ${MAX_SOURCE_INDEX_CHARACTERS.toLocaleString()}-character location-index budget. Validation results are unchanged.`,
          );
        }
        return Object.freeze({ ordinal: finding.ordinal, location: validatedLocation(location, source.length) });
      }));
  }

  let xmlTree: ReturnType<typeof xmlLocationParser.parse> | null = null;
  const needsXmlTree = pack.parserKind === "ISO_XML" && run.results.some((finding) =>
    finding.outcome !== "PASS"
    && !["iso.safe-declarations", "iso.well-formed", "demo.non-empty-source", "demo.xml-declaration"].includes(finding.ruleId));
  if (needsXmlTree) xmlTree = xmlLocationParser.parse(source);

  return Object.freeze(run.results
    .filter((finding) => finding.outcome !== "PASS")
    .map((finding) => {
      const location = pack.parserKind === "ISO_XML"
        ? locateXmlFinding(source, pack, finding, xmlTree)
        : locateEdiFinding(source, pack, finding);
      return Object.freeze({ ordinal: finding.ordinal, location: validatedLocation(location, source.length) });
    }));
}
