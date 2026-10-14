import { isValidSourceSpan } from "./source-coordinates";
import type { FindingLineEntry, FindingLocationEntry } from "./types";

// Summarize the primary target without sending source text to compact mounts.
// Context ranges point to an existing parent when an expected field is missing.
export function findingLines(source: string, entries: readonly FindingLocationEntry[]): readonly FindingLineEntry[] {
  // Scan only through requested offsets, with bounded memory even for large files.
  const offsets = new Set<number>();
  for (const { location } of entries) {
    if (location.kind !== "located" || !isValidSourceSpan(location.primary.span, source.length)) continue;
    offsets.add(location.primary.span.start);
    offsets.add(Math.max(location.primary.span.start, location.primary.span.end - 1));
  }
  const lines = new Map<number, number>();
  let cursor = 0;
  let line = 1;
  for (const offset of [...offsets].sort((a, b) => a - b)) {
    while (cursor < offset) {
      if (source[cursor] === "\n" || (source[cursor] === "\r" && source[cursor + 1] !== "\n")) line += 1;
      cursor += 1;
    }
    lines.set(offset, line);
  }
  return entries.map(({ ordinal, location }) => {
    if (location.kind !== "located") {
      return { ordinal, label: location.kind === "file-wide" ? "Whole file" : "Unavailable", description: location.explanation };
    }
    const { span, kind, label } = location.primary;
    if (!isValidSourceSpan(span, source.length)) return { ordinal, label: "Unavailable", description: "The source position could not be mapped to a line." };
    const start = lines.get(span.start);
    const end = lines.get(Math.max(span.start, span.end - 1));
    if (!start || !end) return { ordinal, label: "Unavailable", description: "The source position could not be mapped to a line." };
    const range = start === end ? String(start) : `${start}–${end}`;
    return {
      ordinal,
      label: kind === "context" ? `Context: ${range}` : range,
      description: `${kind === "context" ? "Source context" : kind === "parser-position" ? "Parser position" : "Source location"}: ${label}. Lines are numbered from 1.`,
    };
  });
}
