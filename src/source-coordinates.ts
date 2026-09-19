import type { SourceSpan } from "./types";

// Canonical positions refer to the worker-decoded string, not UTF-8 bytes:
// zero-based UTF-16 offsets, half-open [start, end) spans, and one-based lines
// and columns. Columns also count UTF-16 code units. See docs/FILE_EXPLORER.md.
export interface ViewerDocument {
  readonly text: string;
  readonly canonicalToViewer: (offset: number) => number;
  readonly viewerToCanonical: (offset: number) => number;
}

function upperBound(values: readonly number[], wanted: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((values[middle] ?? Number.POSITIVE_INFINITY) <= wanted) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function isValidSourceSpan(span: SourceSpan, sourceLength: number): boolean {
  return Number.isInteger(span.start)
    && Number.isInteger(span.end)
    && span.start >= 0
    && span.end >= span.start
    && span.end <= sourceLength;
}

export function sourceLineStarts(source: string): readonly number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      starts.push(index + 1);
    } else if (character === "\n") {
      starts.push(index + 1);
    }
  }
  return Object.freeze(starts);
}

export function sourceOffsetAtLineColumn(source: string, line: number, column: number): number | null {
  if (!Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 1) return null;
  const starts = sourceLineStarts(source);
  const start = starts[line - 1];
  if (start === undefined) return null;
  const next = starts[line];
  let contentEnd = next ?? source.length;
  if (contentEnd > start && source[contentEnd - 1] === "\n") contentEnd -= 1;
  if (contentEnd > start && source[contentEnd - 1] === "\r") contentEnd -= 1;
  const offset = start + column - 1;
  return offset <= contentEnd ? offset : null;
}

export function sourceLineColumnAtOffset(source: string, offset: number): { readonly line: number; readonly column: number } | null {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null;
  const starts = sourceLineStarts(source);
  const lineIndex = Math.max(0, upperBound(starts, offset) - 1);
  return { line: lineIndex + 1, column: offset - (starts[lineIndex] ?? 0) + 1 };
}

/**
 * Normalize CRLF and lone CR to LF for the viewer without changing canonical
 * source. CRLF loses one code unit, so use these mappings for selections and
 * highlights; never apply a viewer offset directly to the original string.
 * Lone CR replacement preserves length. Canonical text retains copy/export data.
 */
export function normalizeSourceForViewer(source: string): ViewerDocument {
  const removedCanonicalOffsets: number[] = [];
  let text = "";
  let chunkStart = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "\r") continue;
    text += source.slice(chunkStart, index);
    if (source[index + 1] === "\n") {
      text += "\n";
      removedCanonicalOffsets.push(index + 1);
      index += 1;
    } else {
      text += "\n";
    }
    chunkStart = index + 1;
  }
  text += source.slice(chunkStart);
  const removedViewerOffsets = removedCanonicalOffsets.map((offset, index) => offset - index);

  return Object.freeze({
    text,
    canonicalToViewer: (offset: number): number => {
      if (!Number.isInteger(offset) || offset < 0 || offset > source.length) {
        throw new RangeError("Canonical source offset is out of range.");
      }
      return offset - upperBound(removedCanonicalOffsets, offset - 1);
    },
    viewerToCanonical: (offset: number): number => {
      if (!Number.isInteger(offset) || offset < 0 || offset > text.length) {
        throw new RangeError("Viewer source offset is out of range.");
      }
      return offset + upperBound(removedViewerOffsets, offset);
    },
  });
}

export function trimSourceSpan(source: string, span: SourceSpan): SourceSpan {
  if (!isValidSourceSpan(span, source.length)) throw new RangeError("Source span is out of range.");
  let start = span.start;
  let end = span.end;
  while (start < end && /\s/u.test(source[start] ?? "")) start += 1;
  while (end > start && /\s/u.test(source[end - 1] ?? "")) end -= 1;
  return Object.freeze({ start, end });
}
