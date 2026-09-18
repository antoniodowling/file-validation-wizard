import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers, type DecorationSet } from "@codemirror/view";
import { normalizeSourceForViewer, sourceLineColumnAtOffset } from "./source-coordinates";
import type { SourceSpan, SourceTarget } from "./types";

const setDecorations = StateEffect.define<DecorationSet>();
const decorationState = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (current, transaction) => {
    let next = current.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setDecorations)) next = effect.value;
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function clipSpan(sourceSpan: SourceSpan, displaySpan: SourceSpan): SourceSpan | null {
  const start = Math.max(sourceSpan.start, displaySpan.start);
  const end = Math.min(sourceSpan.end, displaySpan.end);
  if (sourceSpan.start === sourceSpan.end && start === end && start >= displaySpan.start && start <= displaySpan.end) {
    return { start, end };
  }
  return end > start ? { start, end } : null;
}

export class ReadOnlySourceViewer {
  readonly view: EditorView;
  private readonly canonicalSource: string;
  private displaySpan: SourceSpan;
  private mapping = normalizeSourceForViewer("");
  private findingTarget: SourceTarget | null = null;
  private searchSpan: SourceSpan | null = null;

  constructor(parent: HTMLElement, canonicalSource: string, displaySpan: SourceSpan) {
    this.canonicalSource = canonicalSource;
    this.displaySpan = displaySpan;
    this.mapping = normalizeSourceForViewer(canonicalSource.slice(displaySpan.start, displaySpan.end));
    const firstLine = sourceLineColumnAtOffset(canonicalSource, displaySpan.start)?.line ?? 1;
    this.view = new EditorView({
      parent,
      doc: this.mapping.text,
      extensions: [
        lineNumbers({ formatNumber: (lineNumber) => String(firstLine + lineNumber - 1) }),
        decorationState,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({
          tabindex: "0",
          "aria-label": "Read-only payment file source",
          spellcheck: "false",
        }),
        EditorView.domEventHandlers({
          copy: (event, view) => this.copySelection(event, view),
          cut: (event, view) => this.copySelection(event, view),
          paste: (event) => { event.preventDefault(); return true; },
          drop: (event) => { event.preventDefault(); return true; },
          beforeinput: (event) => { event.preventDefault(); return true; },
        }),
        EditorView.theme({
          "&": { height: "100%", backgroundColor: "#ffffff", color: "#17383c" },
          ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
          ".cm-content": { caretColor: "transparent", padding: "12px 0" },
          ".cm-line": { padding: "0 12px" },
          ".cm-gutters": { backgroundColor: "#f3f8f8", color: "#52696c", borderRight: "1px solid #d1dfe0" },
          ".cm-finding-range": { backgroundColor: "#fff0a8", outline: "2px solid #9b7300" },
          ".cm-context-range": { backgroundColor: "#dff4f5", outline: "2px dashed #006f77" },
          ".cm-parser-position": { backgroundColor: "#ffe0df", outline: "2px solid #a32929" },
          ".cm-finding-line": { backgroundColor: "#fff7cf" },
          ".cm-search-match": { backgroundColor: "#cfe8ff", outline: "1px solid #27648a" },
          ".cm-focused": { outline: "3px solid #006f77", outlineOffset: "-3px" },
        }),
      ],
    });
  }

  private copySelection(event: ClipboardEvent, view: EditorView): boolean {
    const selection = view.state.selection.main;
    if (selection.empty || !event.clipboardData) {
      event.preventDefault();
      return true;
    }
    const canonicalStart = this.displaySpan.start + this.mapping.viewerToCanonical(selection.from);
    const canonicalEnd = this.displaySpan.start + this.mapping.viewerToCanonical(selection.to);
    event.clipboardData.setData("text/plain", this.canonicalSource.slice(canonicalStart, canonicalEnd));
    event.preventDefault();
    return true;
  }

  setDisplaySpan(displaySpan: SourceSpan): void {
    this.displaySpan = displaySpan;
    this.mapping = normalizeSourceForViewer(this.canonicalSource.slice(displaySpan.start, displaySpan.end));
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: this.mapping.text },
      selection: { anchor: 0 },
    });
    this.refreshDecorations();
  }

  setFindingTarget(target: SourceTarget | null): void {
    this.findingTarget = target;
    this.refreshDecorations();
    if (target) this.scrollToCanonical(target.span.start);
  }

  setSearchSpan(searchSpan: SourceSpan | null): void {
    this.searchSpan = searchSpan;
    this.refreshDecorations();
    if (searchSpan) this.scrollToCanonical(searchSpan.start);
  }

  scrollToCanonical(offset: number): void {
    if (offset < this.displaySpan.start || offset > this.displaySpan.end) return;
    const viewerOffset = this.mapping.canonicalToViewer(offset - this.displaySpan.start);
    this.view.dispatch({ effects: EditorView.scrollIntoView(viewerOffset, { y: "center" }) });
  }

  focus(): void {
    this.view.focus();
  }

  destroy(): void {
    this.view.destroy();
  }

  private refreshDecorations(): void {
    const ranges: Array<ReturnType<Decoration["range"]>> = [];
    const addRange = (sourceSpan: SourceSpan, className: string): void => {
      const clipped = clipSpan(sourceSpan, this.displaySpan);
      if (!clipped) return;
      const from = this.mapping.canonicalToViewer(clipped.start - this.displaySpan.start);
      const to = this.mapping.canonicalToViewer(clipped.end - this.displaySpan.start);
      if (from === to) {
        ranges.push(Decoration.line({ class: "cm-finding-line" }).range(this.view.state.doc.lineAt(from).from));
      } else {
        ranges.push(Decoration.mark({ class: className }).range(from, to));
      }
    };
    if (this.findingTarget) {
      const className = this.findingTarget.kind === "context"
        ? "cm-context-range"
        : this.findingTarget.kind === "parser-position"
          ? "cm-parser-position"
          : "cm-finding-range";
      addRange(this.findingTarget.span, className);
    }
    if (this.searchSpan) addRange(this.searchSpan, "cm-search-match");
    this.view.dispatch({ effects: setDecorations.of(Decoration.set(ranges, true)) });
  }
}
