import { SaxesParser } from "saxes";
import { MAX_MODEL_DEPTH, MAX_MODEL_NODES, MAX_SCALAR_UNITS, ResourceLimitError, UnsupportedInputError } from "../resource-policy";
import type { SourceSpan } from "../types";

/** Semantic names are expanded names. Spans refer to original post-BOM UTF-16. */
export interface XmlNode {
  readonly id: number;
  readonly local: string;
  readonly uri: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: XmlNode[];
  text: string;
  span: SourceSpan;
  contentStart: number;
  contentEnd: number;
}
export class XmlSyntaxError extends Error {
  constructor(readonly offset: number) { super("XML syntax or namespace binding is invalid."); }
}
export interface ParsedXmlDocument {
  readonly root: XmlNode;
  readonly hasDeclaration: boolean;
}

/** Preserve the root-only API for source-coordinate and syntax consumers. */
export function parseXml(source: string): XmlNode {
  return parseXmlDocument(source).root;
}

export function parseXmlDocument(source: string): ParsedXmlDocument {
  const parser = new SaxesParser({ xmlns: true, defaultXMLVersion: "1.0", forceXMLVersion: true });
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let hasDeclaration = false;
  let count = 0;
  let start = 0;
  parser.on("error", () => { throw new XmlSyntaxError(Math.max(0, Math.min(source.length, parser.position - 1))); });
  parser.on("xmldecl", (decl) => {
    hasDeclaration = true;
    if (decl.version !== "1.0" || (decl.encoding && decl.encoding.toUpperCase() !== "UTF-8")) {
      throw new UnsupportedInputError("Only XML 1.0 encoded as UTF-8 is supported.");
    }
  });
  parser.on("doctype", () => { throw new XmlSyntaxError(parser.position); });
  parser.on("opentagstart", () => { start = source.lastIndexOf("<", parser.position - 1); });
  parser.on("opentag", (tag) => {
    if (++count > MAX_MODEL_NODES || stack.length >= MAX_MODEL_DEPTH) throw new ResourceLimitError();
    const attributes: Record<string, string> = Object.create(null);
    for (const attr of Object.values(tag.attributes)) {
      if (attr.value.length > MAX_SCALAR_UNITS) throw new ResourceLimitError();
      attributes[`{${attr.uri}}${attr.local}`] = attr.value;
    }
    const node: XmlNode = { id: count, local: tag.local, uri: tag.uri, attributes,
      children: [], text: "", span: { start, end: parser.position }, contentStart: parser.position, contentEnd: parser.position };
    const parent = stack.at(-1);
    if (parent) parent.children.push(node); else root = node;
    stack.push(node);
  });
  const text = (value: string): void => {
    const node = stack.at(-1);
    if (!node) return;
    if (node.text.length + value.length > MAX_SCALAR_UNITS) throw new ResourceLimitError();
    node.text += value;
  };
  parser.on("text", text);
  parser.on("cdata", text);
  parser.on("closetag", (tag) => {
    const node = stack.pop();
    if (!node) return;
    node.contentEnd = tag.isSelfClosing ? node.contentStart : source.lastIndexOf("<", parser.position - 1);
    node.span = { start: node.span.start, end: parser.position };
  });
  // Chunking bounds parser buffering checks and avoids constructing a second source string.
  for (let offset = 0; offset < source.length; offset += 4096) parser.write(source.slice(offset, offset + 4096));
  parser.close();
  if (!root) throw new XmlSyntaxError(0);
  return { root, hasDeclaration };
}
export function children(node: XmlNode | undefined, local: string, uri: string): XmlNode[] {
  return node?.children.filter((child) => child.local === local && child.uri === uri) ?? [];
}
