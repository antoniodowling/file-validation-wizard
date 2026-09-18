import type { SourceSpan } from "./types";

export const MAX_FULL_VIEWER_CHARACTERS = 5_000_000;
export const MAX_FULL_VIEWER_LINE_CHARACTERS = 250_000;
export const MAX_SOURCE_INDEX_CHARACTERS = 5_000_000;
export const EXCERPT_CONTEXT_CHARACTERS = 12_000;

export interface ExplorerBudgetDecision {
  readonly mode: "full" | "excerpt";
  readonly reason: string | null;
  readonly longestLine: number;
}

export interface SourceExcerpt {
  readonly span: SourceSpan;
  readonly text: string;
  readonly prefixTruncated: boolean;
  readonly suffixTruncated: boolean;
}

export function evaluateExplorerBudget(source: string): ExplorerBudgetDecision {
  let lineStart = 0;
  let longestLine = 0;
  for (let index = 0; index <= source.length; index += 1) {
    const character = source[index];
    if (index < source.length && character !== "\r" && character !== "\n") continue;
    longestLine = Math.max(longestLine, index - lineStart);
    if (character === "\r" && source[index + 1] === "\n") index += 1;
    lineStart = index + 1;
  }
  if (source.length > MAX_FULL_VIEWER_CHARACTERS) {
    return Object.freeze({
      mode: "excerpt",
      reason: `The decoded source exceeds the ${MAX_FULL_VIEWER_CHARACTERS.toLocaleString()}-character full-view budget.`,
      longestLine,
    });
  }
  if (longestLine > MAX_FULL_VIEWER_LINE_CHARACTERS) {
    return Object.freeze({
      mode: "excerpt",
      reason: `A source line exceeds the ${MAX_FULL_VIEWER_LINE_CHARACTERS.toLocaleString()}-character full-view budget.`,
      longestLine,
    });
  }
  return Object.freeze({ mode: "full", reason: null, longestLine });
}

export function sourceExcerpt(source: string, focus: SourceSpan | null): SourceExcerpt {
  const focusStart = focus?.start ?? 0;
  const focusEnd = focus?.end ?? focusStart;
  const halfContext = Math.floor(EXCERPT_CONTEXT_CHARACTERS / 2);
  let start = Math.max(0, focusStart - halfContext);
  let end = Math.min(source.length, Math.max(focusEnd, focusStart + 1) + halfContext);
  if (end - start < EXCERPT_CONTEXT_CHARACTERS) {
    if (start === 0) end = Math.min(source.length, EXCERPT_CONTEXT_CHARACTERS);
    else if (end === source.length) start = Math.max(0, source.length - EXCERPT_CONTEXT_CHARACTERS);
  }
  return Object.freeze({
    span: Object.freeze({ start, end }),
    text: source.slice(start, end),
    prefixTruncated: start > 0,
    suffixTruncated: end < source.length,
  });
}
