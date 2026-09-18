import type { EdiSegment, SourceSpan } from "../types";

export interface LocatedEdiElement {
  readonly value: string;
  readonly span: SourceSpan;
  readonly valueSpan: SourceSpan;
}

export interface LocatedEdiSegment extends EdiSegment {
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly locatedElements: readonly LocatedEdiElement[];
}

function isOuterSegmentWhitespace(character: string | undefined): boolean {
  return character === "\r" || character === "\n" || character === " ";
}

function trimValueSpan(source: string, start: number, end: number): SourceSpan {
  let valueStart = start;
  let valueEnd = end;
  while (valueStart < valueEnd && /\s/u.test(source[valueStart] ?? "")) valueStart += 1;
  while (valueEnd > valueStart && /\s/u.test(source[valueEnd - 1] ?? "")) valueEnd -= 1;
  return Object.freeze({ start: valueStart, end: valueEnd });
}

export function scanEdiSegments(
  source: string,
  elementSeparator: string,
  segmentTerminator: string,
): readonly LocatedEdiSegment[] {
  if (!elementSeparator || !segmentTerminator) return Object.freeze([]);
  const segments: LocatedEdiSegment[] = [];

  const addSegment = (rawStart: number, rawEnd: number): void => {
    let start = rawStart;
    let end = rawEnd;
    while (start < end && isOuterSegmentWhitespace(source[start])) start += 1;
    while (end > start && isOuterSegmentWhitespace(source[end - 1])) end -= 1;
    if (start === end) return;

    const boundaries: number[] = [start];
    for (let index = start; index < end; index += 1) {
      if (source[index] === elementSeparator) boundaries.push(index + 1);
    }
    boundaries.push(end + 1);

    const rawParts: Array<{ readonly start: number; readonly end: number }> = [];
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const partStart = boundaries[index] ?? start;
      const boundaryEnd = boundaries[index + 1] ?? end + 1;
      const partEnd = index === boundaries.length - 2 ? end : boundaryEnd - 1;
      rawParts.push({ start: partStart, end: partEnd });
    }

    const idPart = rawParts.shift() ?? { start, end: start };
    const idSpan = trimValueSpan(source, idPart.start, idPart.end);
    const locatedElements = rawParts.map((part) => Object.freeze({
      value: source.slice(part.start, part.end),
      span: Object.freeze({ start: part.start, end: part.end }),
      valueSpan: trimValueSpan(source, part.start, part.end),
    }));
    segments.push(Object.freeze({
      id: source.slice(idSpan.start, idSpan.end),
      elements: Object.freeze(locatedElements.map((element) => element.value)),
      position: segments.length + 1,
      span: Object.freeze({ start, end }),
      idSpan,
      locatedElements: Object.freeze(locatedElements),
    }));
  };

  let rawStart = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== segmentTerminator) continue;
    addSegment(rawStart, index);
    rawStart = index + 1;
  }
  addSegment(rawStart, source.length);
  return Object.freeze(segments);
}
