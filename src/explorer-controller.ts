import { adjacentFinding, navigableFindings } from "./finding-navigation";
import { ReadOnlySourceViewer } from "./source-viewer";
import type {
  FindingLocation,
  FindingLocationEntry,
  RuleResult,
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
          <button class="button text" type="button" data-explorer-expand>Expand explorer</button>
          <button class="button text" type="button" data-explorer-hide>Hide explorer</button>
        </div>
      </header>
      <div class="explorer-toolbar" aria-label="File explorer controls">
        <button class="button secondary compact" type="button" data-finding-previous disabled>← Previous finding</button>
        <button class="button secondary compact" type="button" data-finding-next disabled>Next finding →</button>
      </div>
      <div class="explorer-toolbar">
        <button class="button secondary compact" type="button" data-target-previous disabled>Previous occurrence</button>
        <button class="button secondary compact" type="button" data-target-next disabled>Next occurrence</button>
      </div>
      <div class="explorer-details" data-explorer-details hidden>
        <div class="explorer-details-heading">
          <div><span class="severity" data-detail-outcome></span> <strong data-detail-rule></strong></div>
        </div>
        <dl class="explorer-finding-data">
          <div><dt>Field</dt><dd data-detail-field></dd></div>
          <div><dt>Path</dt><dd><code data-detail-locator></code></dd></div>
          <div><dt>Location confidence</dt><dd data-detail-confidence></dd></div>
          <div><dt>Message</dt><dd data-detail-message></dd></div>
        </dl>
      </div>
      <div class="explorer-notice" data-explorer-notice role="status">
        Validate a selected file to inspect its decoded source here.
      </div>
      <div class="source-viewer-host" data-source-viewer hidden></div>
      <pre class="source-fallback" data-source-fallback hidden tabindex="0" aria-label="Read-only source"></pre>
    </aside>`;
}

export class FileExplorerController {
  private readonly root: HTMLElement;
  private readonly options: ExplorerControllerOptions;
  private snapshot: AcceptedSourceSnapshot | null = null;
  private locations = new Map<number, FindingLocation>();
  private selectedOrdinal: number | null = null;
  private viewer: ReadOnlySourceViewer | null = null;
  private targetIndex = 0;

  constructor(options: ExplorerControllerOptions) {
    this.options = options;
    this.root = options.root;
    for (const [selector, delta] of [["[data-target-previous]", -1], ["[data-target-next]", 1]] as const) {
      this.q<HTMLButtonElement>(selector).addEventListener("click", () => {
        this.targetIndex += delta; this.renderSelection();
      });
    }
    this.q<HTMLButtonElement>("[data-explorer-hide]").addEventListener("click", options.onHide);
    this.q<HTMLButtonElement>("[data-explorer-expand]").addEventListener("click", () => {
      const expanded = options.onExpand();
      this.q<HTMLButtonElement>("[data-explorer-expand]").textContent = expanded ? "Restore split" : "Expand explorer";
    });
    this.q<HTMLButtonElement>("[data-finding-previous]").addEventListener("click", () => this.moveFinding("previous"));
    this.q<HTMLButtonElement>("[data-finding-next]").addEventListener("click", () => this.moveFinding("next"));
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
    this.q<HTMLElement>("[data-explorer-file-name]").textContent = snapshot.fileName;
    this.q<HTMLElement>("[data-explorer-file-size]").textContent = snapshot.fileSizeLabel;
    this.q<HTMLElement>("[data-explorer-read-only]").hidden = false;
    this.q<HTMLElement>("[data-explorer-notice]").textContent = "Validation is complete. Source locations are preparing; results and CSV remain available.";
    this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
    this.configureViewer();
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
    this.targetIndex = 0;
    this.renderSelection();
    this.updateFindingButtons();
    this.options.showFindingInResults(finding.ordinal, false);
  }

  reconcileVisibleFindings(): void {
    if (this.selectedOrdinal !== null && !this.options.getVisibleFindings().some((entry) => entry.ordinal === this.selectedOrdinal)) {
      this.selectedOrdinal = null;
      this.viewer?.setFindingTarget(null, null);
      this.q<HTMLElement>("[data-explorer-details]").hidden = true;
    }
    this.updateFindingButtons();
  }

  destroy(): void { this.clearSnapshot(); }

  private clearSnapshot(): void {
    this.viewer?.destroy();
    this.viewer = null;
    this.snapshot = null;
    this.locations.clear();
    this.selectedOrdinal = null;
    this.targetIndex = 0;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-target-previous], [data-target-next], [data-finding-previous], [data-finding-next]")) button.disabled = true;
    for (const field of this.root.querySelectorAll<HTMLElement>("[data-detail-field], [data-detail-locator], [data-detail-message], [data-detail-rule], [data-detail-confidence]")) field.textContent = "";
    this.q<HTMLElement>("[data-explorer-details]").hidden = true;
    this.q<HTMLElement>("[data-source-viewer]").hidden = true;
    this.q<HTMLElement>("[data-source-viewer]").replaceChildren();
    this.q<HTMLElement>("[data-source-fallback]").hidden = true;
    this.q<HTMLElement>("[data-source-fallback]").textContent = "";
  }

  private configureViewer(): void {
    if (!this.snapshot) return;
    const displaySpan = { start: 0, end: this.snapshot.source.length };
    this.viewer?.destroy();
    this.viewer = null;
    const host = this.q<HTMLElement>("[data-source-viewer]");
    host.replaceChildren();
    host.hidden = false;
    this.q<HTMLElement>("[data-source-fallback]").hidden = true;
    this.q<HTMLElement>("[data-source-fallback]").textContent = "";
    try {
      this.viewer = new ReadOnlySourceViewer(host, this.snapshot.source, displaySpan);
    } catch {
      host.hidden = true;
      host.replaceChildren();
      const fallback = this.q<HTMLElement>("[data-source-fallback]");
      fallback.textContent = this.snapshot.source;
      fallback.hidden = false;
      this.q<HTMLElement>("[data-explorer-notice]").textContent = "The interactive viewer could not start. The full read-only source is shown instead.";
      this.q<HTMLElement>("[data-explorer-notice]").hidden = false;
    }
  }

  private selectedFinding(): RuleResult | null {
    if (!this.snapshot || this.selectedOrdinal === null) return null;
    return this.snapshot.run.results.find((finding) => finding.ordinal === this.selectedOrdinal) ?? null;
  }

  private selectedTarget(): SourceTarget | null {
    if (this.selectedOrdinal === null) return null;
    const location = this.locations.get(this.selectedOrdinal);
    return location?.kind === "located" ? [location.primary, ...location.related][this.targetIndex] ?? location.primary : null;
  }

  private renderSelection(): void {
    const finding = this.selectedFinding();
    if (!finding) return;
    const details = this.q<HTMLElement>("[data-explorer-details]");
    details.hidden = false;
    const outcome = this.q<HTMLElement>("[data-detail-outcome]");
    outcome.className = `severity ${finding.outcome.toLowerCase()}`;
    outcome.textContent = finding.outcome;
    this.q<HTMLElement>("[data-detail-rule], [data-detail-confidence]").textContent = finding.ruleId;
    this.q<HTMLElement>("[data-detail-field]").textContent = finding.field;
    this.q<HTMLElement>("[data-detail-locator]").textContent = finding.locator;
    this.q<HTMLElement>("[data-detail-message]").textContent = finding.message;

    const location = this.locations.get(finding.ordinal);
    this.q<HTMLElement>("[data-detail-confidence]").textContent = location?.kind === "located"
      ? `${location.primary.kind}: ${location.primary.label}. ${location.related.length} related targets${location.relatedTruncated ? " (additional targets omitted)" : ""}.`
      : location ? `${location.kind}: ${location.explanation}` : "Locations are preparing.";
    this.q<HTMLButtonElement>("[data-target-previous]").disabled = this.targetIndex <= 0;
    this.q<HTMLButtonElement>("[data-target-next]").disabled = location?.kind !== "located" || this.targetIndex >= location.related.length;
    if (location?.kind === "located") this.q<HTMLElement>("[data-detail-confidence]").textContent += ` Showing occurrence ${this.targetIndex + 1} of ${location.related.length + 1}.`;
    this.showSelectedTarget();
    this.options.announce(`${finding.outcome}: ${finding.field}. ${finding.message}. ${this.q<HTMLElement>("[data-detail-confidence]").textContent}`);
  }

  private showSelectedTarget(): void {
    const selected = this.selectedTarget();
    const finding = this.selectedFinding();
    if (!selected || !this.snapshot) {
      this.viewer?.setFindingTarget(null, null);
      return;
    }
    this.viewer?.setFindingTarget(selected, finding?.severity ?? null);
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
}
