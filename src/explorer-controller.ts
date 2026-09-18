import {
  evaluateExplorerBudget,
  MAX_SOURCE_SEARCH_MATCHES,
  sourceExcerpt,
  type ExplorerBudgetDecision,
} from "./explorer-budget";
import { adjacentFinding, navigableFindings } from "./finding-navigation";
import { sourceLineColumnAtOffset, sourceLineStarts } from "./source-coordinates";
import { ReadOnlySourceViewer } from "./source-viewer";
import type {
  FindingLocation,
  FindingLocationEntry,
  RuleResult,
  SourceSpan,
  SourceTarget,
  ValidationRun,
} from "./types";

export interface AcceptedSourceSnapshot {
  readonly id: number;
  readonly fileName: string;
  readonly fileSizeLabel: string;
  readonly source: string;
  readonly run: ValidationRun;
}

export interface ExplorerControllerOptions {
  readonly root: HTMLElement;
  readonly getVisibleFindings: () => readonly RuleResult[];
  readonly showFindingInResults: (ordinal: number, focus: boolean) => void;
  readonly onLocationLabelsChanged: () => void;
  readonly onHide: () => void;
  readonly onExpand: () => boolean;
  readonly announce: (message: string) => void;
}

export function explorerMarkup(): string {
  return `
    <aside class="file-explorer" aria-label="File explorer" data-file-explorer>
      <header class="explorer-header">
        <div>
          <p class="step-label">File explorer</p>
          <h2 data-explorer-file-name>No validated file</h2>
          <p class="helper"><span data-explorer-file-size></span><span data-explorer-read-only hidden> · Read-only</span></p>
        </div>
        <div class="explorer-header-actions">
          <button class="button text" type="button" data-explorer-expand>Expand file</button>
          <button class="button text" type="button" data-explorer-hide>Hide file</button>
        </div>
      </header>
      <div class="explorer-toolbar" aria-label="File explorer controls">
        <label class="explorer-find"><span>Find in file</span><input type="search" data-source-search disabled /></label>
        <button class="button secondary compact" type="button" data-search-previous disabled aria-label="Previous source match">↑</button>
        <button class="button secondary compact" type="button" data-search-next disabled aria-label="Next source match">↓</button>
        <span class="explorer-control-status" data-search-status>No search</span>
        <label class="explorer-line"><span>Go to line</span><input type="number" min="1" step="1" inputmode="numeric" data-go-line disabled /></label>
        <button class="button secondary compact" type="button" data-go-line-button disabled>Go</button>
        <button class="button secondary compact" type="button" data-finding-previous disabled>← Previous finding</button>
        <button class="button secondary compact" type="button" data-finding-next disabled>Next finding →</button>
      </div>
      <div class="explorer-details" data-explorer-details hidden>
        <div class="explorer-details-heading">
          <div><span class="severity" data-detail-outcome></span> <strong data-detail-rule></strong></div>
          <div class="explorer-detail-actions">
            <button class="button text" type="button" data-related-previous disabled>← Related</button>
            <span data-related-status></span>
            <button class="button text" type="button" data-related-next disabled>Related →</button>
          </div>
        </div>
        <dl class="explorer-finding-data">
          <div><dt>Field</dt><dd data-detail-field></dd></div>
          <div><dt>Path</dt><dd><code data-detail-locator></code></dd></div>
        </dl>
        <p data-detail-message></p>
        <p class="location-explanation" data-location-explanation></p>
        <div class="explorer-detail-actions">
          <button class="button secondary compact" type="button" data-focus-source>Focus source</button>
          <button class="button secondary compact" type="button" data-return-finding>Back to finding</button>
          <button class="button text" type="button" data-return-location>Return to selected location</button>
        </div>
      </div>
      <div class="explorer-notice" data-explorer-notice role="status">
        Validate a selected file to inspect its decoded source here.
      </div>
      <p class="explorer-scope-note" data-explorer-scope hidden></p>
      <p class="inline-error explorer-line-error" data-line-error role="alert" hidden></p>
      <div class="source-viewer-host" data-source-viewer hidden></div>
      <pre class="source-fallback" data-source-fallback hidden tabindex="0" aria-label="Read-only source excerpt"></pre>
    </aside>`;
}

export class FileExplorerController {
  private readonly root: HTMLElement;
  private readonly options: ExplorerControllerOptions;
  private snapshot: AcceptedSourceSnapshot | null = null;
  private locations = new Map<number, FindingLocation>();
  private selectedOrdinal: number | null = null;
  private relatedIndex = 0;
  private viewer: ReadOnlySourceViewer | null = null;
  private budget: ExplorerBudgetDecision | null = null;
  private displaySpan: SourceSpan | null = null;
  private searchMatches: SourceSpan[] = [];
  private searchIndex = -1;
  private searchCapped = false;

  constructor(options: ExplorerControllerOptions) {
    this.options = options;
    this.root = options.root;
    this.q<HTMLButtonElement>("[data-explorer-hide]").addEventListener("click", options.onHide);
    this.q<HTMLButtonElement>("[data-explorer-expand]").addEventListener("click", () => {
      const expanded = options.onExpand();
      this.q<HTMLButtonElement>("[data-explorer-expand]").textContent = expanded ? "Restore split" : "Expand file";
    });
    this.q<HTMLInputElement>("[data-source-search]").addEventListener("input", () => this.updateSearch());
    this.q<HTMLButtonElement>("[data-search-previous]").addEventListener("click", () => this.moveSearch(-1));
    this.q<HTMLButtonElement>("[data-search-next]").addEventListener("click", () => this.moveSearch(1));
    this.q<HTMLButtonElement>("[data-go-line-button]").addEventListener("click", () => this.goToLine());
    this.q<HTMLInputElement>("[data-go-line]").addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.goToLine();
    });
    this.q<HTMLButtonElement>("[data-finding-previous]").addEventListener("click", () => this.moveFinding("previous"));
    this.q<HTMLButtonElement>("[data-finding-next]").addEventListener("click", () => this.moveFinding("next"));
    this.q<HTMLButtonElement>("[data-related-previous]").addEventListener("click", () => this.moveRelated(-1));
    this.q<HTMLButtonElement>("[data-related-next]").addEventListener("click", () => this.moveRelated(1));
    this.q<HTMLButtonElement>("[data-focus-source]").addEventListener("click", () => this.viewer?.focus());
    this.q<HTMLButtonElement>("[data-return-finding]").addEventListener("click", () => {
      if (this.selectedOrdinal !== null) options.showFindingInResults(this.selectedOrdinal, true);
    });
    this.q<HTMLButtonElement>("[data-return-location]").addEventListener("click", () => this.showSelectedTarget());
  }

  private q<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`File explorer element is missing: ${selector}`);
    return element;
  }

  actionLabel(finding: RuleResult): string {
    const location = this.locations.get(finding.ordinal);
    if (location?.kind === "located") {
      return location.primary.kind === "context" ? "View context" : "View in file";
    }
    return "View details";
  }

  isSelected(ordinal: number): boolean {
    return this.selectedOrdinal === ordinal;
  }

  selectedFindingOrdinal(): number | null {
    return this.selectedOrdinal;
  }

  setPlaceholder(message: string, fileName?: string, fileSizeLabel?: string): void {
    this.clearSnapshot();
    this.q<HTMLElement>("[data-explorer-file-name]").textContent = fileName ?? "No validated file";
    this.q<HTMLElement>("[data-explorer-file-size]").textContent = fileSizeLabel ?? "";
    this.q<HTMLElement>("[data-explorer-read-only]").hidden = true;
    this.q<HTMLElement>("[data-explorer-notice]").textContent = message;
    this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
  }

  acceptSnapshot(snapshot: AcceptedSourceSnapshot): void {
    this.clearSnapshot();
    this.snapshot = snapshot;
    this.budget = evaluateExplorerBudget(snapshot.source);
    this.q<HTMLElement>("[data-explorer-file-name]").textContent = snapshot.fileName;
    this.q<HTMLElement>("[data-explorer-file-size]").textContent = snapshot.fileSizeLabel;
    this.q<HTMLElement>("[data-explorer-read-only]").hidden = false;
    this.q<HTMLElement>("[data-explorer-notice]").textContent = "Validation is complete. Source locations are preparing; results and CSV remain available.";
    this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
    this.configureViewer(null);
    this.updateFindingButtons();
  }

  setLocations(snapshotId: number, entries: readonly FindingLocationEntry[]): void {
    if (this.snapshot?.id !== snapshotId) return;
    this.locations = new Map(entries.map((entry) => [entry.ordinal, entry.location]));
    this.q<HTMLElement>("[data-explorer-notice]").hidden = true;
    this.options.onLocationLabelsChanged();
    if (this.selectedOrdinal !== null) this.renderSelection();
    this.updateFindingButtons();
  }

  setLocationFailure(snapshotId: number): void {
    if (this.snapshot?.id !== snapshotId) return;
    this.locations = new Map(this.snapshot.run.results
      .filter((finding) => finding.outcome !== "PASS")
      .map((finding) => [finding.ordinal, {
        kind: "unavailable",
        explanation: "Source-location preparation failed. The completed validation result is unchanged.",
      } as const]));
    this.q<HTMLElement>("[data-explorer-notice]").textContent = "Source locations are unavailable. The completed validation result and CSV remain available.";
    this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
    this.options.onLocationLabelsChanged();
    if (this.selectedOrdinal !== null) this.renderSelection();
  }

  selectFinding(finding: RuleResult): void {
    if (!this.snapshot || finding.outcome === "PASS") return;
    this.selectedOrdinal = finding.ordinal;
    this.relatedIndex = 0;
    this.renderSelection();
    this.updateFindingButtons();
    this.options.showFindingInResults(finding.ordinal, false);
  }

  reconcileVisibleFindings(): void {
    if (this.selectedOrdinal !== null && !this.options.getVisibleFindings().some((entry) => entry.ordinal === this.selectedOrdinal)) {
      this.selectedOrdinal = null;
      this.relatedIndex = 0;
      this.viewer?.setFindingTarget(null);
      this.q<HTMLElement>("[data-explorer-details]").hidden = true;
    }
    this.updateFindingButtons();
  }

  destroy(): void {
    this.viewer?.destroy();
    this.viewer = null;
    this.snapshot = null;
    this.locations.clear();
  }

  private clearSnapshot(): void {
    this.viewer?.destroy();
    this.viewer = null;
    this.snapshot = null;
    this.locations.clear();
    this.selectedOrdinal = null;
    this.relatedIndex = 0;
    this.budget = null;
    this.displaySpan = null;
    this.searchMatches = [];
    this.searchIndex = -1;
    this.searchCapped = false;
    this.q<HTMLElement>("[data-explorer-details]").hidden = true;
    this.q<HTMLElement>("[data-source-viewer]").hidden = true;
    this.q<HTMLElement>("[data-source-viewer]").replaceChildren();
    this.q<HTMLElement>("[data-source-fallback]").hidden = true;
    this.q<HTMLElement>("[data-explorer-scope]").hidden = true;
    this.q<HTMLInputElement>("[data-source-search]").value = "";
    this.setSourceControls(false);
    this.q<HTMLElement>("[data-search-status]").textContent = "No search";
  }

  private configureViewer(focus: SourceSpan | null): void {
    if (!this.snapshot || !this.budget) return;
    const excerpt = this.budget.mode === "excerpt" ? sourceExcerpt(this.snapshot.source, focus) : null;
    const displaySpan = excerpt?.span ?? { start: 0, end: this.snapshot.source.length };
    this.displaySpan = displaySpan;
    this.viewer?.destroy();
    this.viewer = null;
    const host = this.q<HTMLElement>("[data-source-viewer]");
    host.replaceChildren();
    host.hidden = false;
    this.q<HTMLElement>("[data-source-fallback]").hidden = true;
    try {
      this.viewer = new ReadOnlySourceViewer(host, this.snapshot.source, displaySpan);
    } catch {
      host.hidden = true;
      const fallback = this.q<HTMLElement>("[data-source-fallback]");
      fallback.textContent = this.snapshot.source.slice(displaySpan.start, displaySpan.end);
      fallback.hidden = false;
      this.q<HTMLElement>("[data-explorer-notice]").textContent = "The interactive viewer could not start. A bounded read-only source excerpt is shown instead.";
      this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
    }
    const scope = this.q<HTMLElement>("[data-explorer-scope]");
    if (excerpt) {
      const start = sourceLineColumnAtOffset(this.snapshot.source, displaySpan.start);
      const end = sourceLineColumnAtOffset(this.snapshot.source, displaySpan.end);
      scope.textContent = `${this.budget.reason} Showing an original-source excerpt from line ${start?.line ?? 1} through ${end?.line ?? 1}; full-file search and go-to-line are unavailable.`;
      scope.hidden = false;
    } else {
      scope.hidden = true;
    }
    const fullViewerAvailable = this.budget.mode === "full" && Boolean(this.viewer);
    this.setSourceControls(
      fullViewerAvailable,
      this.budget.mode === "excerpt" ? "Unavailable for excerpt" : "Unavailable in fallback",
    );
  }

  private setSourceControls(enabled: boolean, disabledStatus = "Unavailable"): void {
    this.q<HTMLInputElement>("[data-source-search]").disabled = !enabled;
    this.q<HTMLInputElement>("[data-go-line]").disabled = !enabled;
    this.q<HTMLButtonElement>("[data-go-line-button]").disabled = !enabled;
    if (!enabled) {
      this.q<HTMLButtonElement>("[data-search-previous]").disabled = true;
      this.q<HTMLButtonElement>("[data-search-next]").disabled = true;
      this.q<HTMLElement>("[data-search-status]").textContent = disabledStatus;
    } else {
      this.q<HTMLElement>("[data-search-status]").textContent = "No search";
    }
  }

  private selectedFinding(): RuleResult | null {
    if (!this.snapshot || this.selectedOrdinal === null) return null;
    return this.snapshot.run.results.find((finding) => finding.ordinal === this.selectedOrdinal) ?? null;
  }

  private selectedTargets(): readonly SourceTarget[] {
    if (this.selectedOrdinal === null) return [];
    const location = this.locations.get(this.selectedOrdinal);
    return location?.kind === "located" ? [location.primary, ...location.related] : [];
  }

  private selectedTarget(): SourceTarget | null {
    return this.selectedTargets()[this.relatedIndex] ?? null;
  }

  private renderSelection(): void {
    const finding = this.selectedFinding();
    if (!finding) return;
    const details = this.q<HTMLElement>("[data-explorer-details]");
    details.hidden = false;
    const outcome = this.q<HTMLElement>("[data-detail-outcome]");
    outcome.className = `severity ${finding.outcome.toLowerCase()}`;
    outcome.textContent = finding.outcome;
    this.q<HTMLElement>("[data-detail-rule]").textContent = finding.ruleId;
    this.q<HTMLElement>("[data-detail-field]").textContent = finding.field;
    this.q<HTMLElement>("[data-detail-locator]").textContent = finding.locator;
    this.q<HTMLElement>("[data-detail-message]").textContent = finding.message;

    const location = this.locations.get(finding.ordinal);
    const explanation = this.q<HTMLElement>("[data-location-explanation]");
    if (!location) explanation.textContent = "Source location is still preparing.";
    else if (location.kind === "file-wide" || location.kind === "unavailable") explanation.textContent = location.explanation;
    else {
      const selected = this.selectedTarget() ?? location.primary;
      const coordinates = sourceLineColumnAtOffset(this.snapshot?.source ?? "", selected.span.start);
      const quality = selected.kind === "exact"
        ? "Exact source location"
        : selected.kind === "context"
          ? "Contextual source location"
          : "Parsing stopped here";
      explanation.textContent = `${quality}: ${selected.label}. Line ${coordinates?.line ?? "?"}, column ${coordinates?.column ?? "?"}.`;
    }
    this.renderRelatedControls(location);
    this.showSelectedTarget();
    this.options.announce(`${finding.outcome}: ${finding.field}. ${explanation.textContent ?? ""}`);
  }

  private renderRelatedControls(location: FindingLocation | undefined): void {
    const targets = location?.kind === "located" ? [location.primary, ...location.related] : [];
    const previous = this.q<HTMLButtonElement>("[data-related-previous]");
    const next = this.q<HTMLButtonElement>("[data-related-next]");
    previous.disabled = targets.length < 2 || this.relatedIndex === 0;
    next.disabled = targets.length < 2 || this.relatedIndex >= targets.length - 1;
    this.q<HTMLElement>("[data-related-status]").textContent = targets.length > 1
      ? `Location ${this.relatedIndex + 1} of ${targets.length}${location?.kind === "located" && location.relatedTruncated ? "+" : ""}`
      : targets.length === 1 ? "Primary location" : "No source target";
  }

  private showSelectedTarget(): void {
    const selected = this.selectedTarget();
    if (!selected || !this.snapshot) {
      this.viewer?.setFindingTarget(null);
      return;
    }
    if (this.budget?.mode === "excerpt") this.configureViewer(selected.span);
    this.viewer?.setFindingTarget(selected);
  }

  private moveRelated(direction: -1 | 1): void {
    const targets = this.selectedTargets();
    const nextIndex = this.relatedIndex + direction;
    if (nextIndex < 0 || nextIndex >= targets.length) return;
    this.relatedIndex = nextIndex;
    this.renderSelection();
  }

  private updateFindingButtons(): void {
    const visible = this.options.getVisibleFindings();
    const navigable = navigableFindings(visible);
    const index = this.selectedOrdinal === null ? -1 : navigable.findIndex((entry) => entry.ordinal === this.selectedOrdinal);
    this.q<HTMLButtonElement>("[data-finding-previous]").disabled = navigable.length === 0 || index === 0;
    this.q<HTMLButtonElement>("[data-finding-next]").disabled = navigable.length === 0 || index === navigable.length - 1;
  }

  private moveFinding(direction: "previous" | "next"): void {
    const next = adjacentFinding(this.options.getVisibleFindings(), this.selectedOrdinal, direction);
    if (next) this.selectFinding(next);
  }

  private updateSearch(): void {
    if (!this.snapshot || this.budget?.mode !== "full") return;
    const query = this.q<HTMLInputElement>("[data-source-search]").value;
    this.searchMatches = [];
    this.searchIndex = -1;
    this.searchCapped = false;
    this.viewer?.setSearchSpan(null);
    if (!query) {
      this.q<HTMLElement>("[data-search-status]").textContent = "No search";
      this.updateSearchButtons();
      return;
    }
    let offset = 0;
    while (offset <= this.snapshot.source.length) {
      const found = this.snapshot.source.indexOf(query, offset);
      if (found < 0) break;
      if (this.searchMatches.length === MAX_SOURCE_SEARCH_MATCHES) {
        this.searchCapped = true;
        break;
      }
      this.searchMatches.push({ start: found, end: found + query.length });
      offset = found + Math.max(1, query.length);
    }
    if (this.searchMatches.length) {
      this.searchIndex = 0;
      this.viewer?.setSearchSpan(this.searchMatches[0] ?? null);
    }
    this.renderSearchStatus();
    this.updateSearchButtons();
  }

  private moveSearch(direction: -1 | 1): void {
    const next = this.searchIndex + direction;
    if (next < 0 || next >= this.searchMatches.length) return;
    this.searchIndex = next;
    this.viewer?.setSearchSpan(this.searchMatches[next] ?? null);
    this.renderSearchStatus();
    this.updateSearchButtons();
  }

  private renderSearchStatus(): void {
    const total = this.searchMatches.length;
    this.q<HTMLElement>("[data-search-status]").textContent = total === 0
      ? "No matches"
      : `${this.searchIndex + 1} of ${total}${this.searchCapped ? "+" : ""} matches`;
  }

  private updateSearchButtons(): void {
    this.q<HTMLButtonElement>("[data-search-previous]").disabled = this.searchIndex <= 0;
    this.q<HTMLButtonElement>("[data-search-next]").disabled = this.searchIndex < 0 || this.searchIndex >= this.searchMatches.length - 1;
  }

  private goToLine(): void {
    if (!this.snapshot || this.budget?.mode !== "full") return;
    const input = this.q<HTMLInputElement>("[data-go-line]");
    const line = Number(input.value);
    const starts = sourceLineStarts(this.snapshot.source);
    const error = this.q<HTMLElement>("[data-line-error]");
    if (!Number.isInteger(line) || line < 1 || line > starts.length) {
      error.textContent = `Enter a line from 1 through ${starts.length}.`;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    this.viewer?.scrollToCanonical(starts[line - 1] ?? 0);
    this.options.announce(`Moved to source line ${line}.`);
  }
}
