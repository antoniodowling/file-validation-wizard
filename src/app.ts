import warningTriangleIcon from "bootstrap-icons/icons/exclamation-triangle.svg?raw";
import InlineValidationWorker from "./validation.worker?worker&inline";
import { validationReportFileName, validationRunToCsv } from "./csv";
import { explorerMarkup, FileExplorerController } from "./explorer-controller";
import {
  extensionList,
  findCatalogEntry,
  findCatalogVersion,
  FORMAT_CATALOG,
  searchFormatCatalog,
} from "./format-catalog";
import { fileSelectionError } from "./file-policy";
import { findEnabledFormatPack } from "./format-packs";
import { overallStatusLabel } from "./outcome";
import { pageWindow } from "./pagination";
import { pageForFinding } from "./finding-navigation";
import { validationFailureMessage } from "./validation-failure";
import { VALIDATION_DEADLINE_MS } from "./types";
import type {
  FormatCatalogEntry,
  RuleOutcome,
  RuleResult,
  ValidationRun,
  ValidationFailureCode,
  WorkerRequest,
  WorkerResponse,
} from "./types";

export interface ValidatorOptions {
  format?: string | undefined;
  version?: string | undefined;
  lockSelection?: boolean;
  idPrefix?: string;
  enableExplorer?: boolean;
}

/**
 * Mount one independent instance into a caller-owned root, replacing its contents.
 * Supply a unique idPrefix when multiple instances share a document; an empty
 * prefix is for a single standalone instance. Invoke the returned disposer on
 * removal or portal navigation to invalidate pending reads, stop the worker,
 * destroy the viewer, and release selected-file/results state.
 */
export function mountPaymentFileValidator(app: HTMLDivElement, options: ValidatorOptions = {}): () => void {
  const prefix = options.idPrefix ?? "";
  const explorerEnabled = options.enableExplorer === true;

  app.dataset.validatorMounted = "true";

  app.innerHTML = `
  <div class="validator-content">
    <ol class="steps" aria-label="Validation steps">
      <li class="step active" data-step="1"><span class="step-number"><span>1</span></span><strong>Choose format</strong></li>
      <li class="step" data-step="2"><span class="step-number"><span>2</span></span><strong>Upload file</strong></li>
      <li class="step" data-step="3"><span class="step-number"><span>3</span></span><strong>View results</strong></li>
    </ol>

    <div class="wizard" aria-label="File validation workflow">
      <section class="wizard-step card" data-wizard-step="1">
        <button class="accordion-trigger" type="button" data-open-step="1" aria-expanded="true" aria-controls="step-1-panel">
          <span><span class="big-number" aria-hidden="true">01</span><strong>Choose format</strong></span>
        </button>
        <div id="step-1-panel" class="step-panel">
          <div class="selection-grid">
            <div class="field-group">
              <label for="format-search">File format</label>
              <div class="combobox-wrap">
                <input
                  id="format-search"
                  type="search"
                  role="combobox"
                  autocomplete="off"
                  aria-autocomplete="list"
                  aria-expanded="false"
                  aria-controls="format-listbox"
                  placeholder="Search by format, code, or standard"
                />
                <ul id="format-listbox" class="format-listbox" role="listbox" hidden></ul>
              </div>
            </div>
            <div id="version-field" class="field-group disabled">
              <label for="version-select">Version</label>
              <select id="version-select" disabled>
                <option value="">Select a file format</option>
              </select>
              <p id="format-selection-help" class="helper" hidden></p>
            </div>
            <div class="format-action">
              <span class="format-action-label" aria-hidden="true">Action</span>
              <button id="format-continue" class="button primary" type="button" disabled>Continue →</button>
            </div>
          </div>
        </div>
      </section>

      <section class="wizard-step card" data-wizard-step="2">
        <button class="accordion-trigger" type="button" data-open-step="2" aria-expanded="false" aria-controls="step-2-panel" disabled>
          <span><span class="big-number" aria-hidden="true">02</span><strong>Upload file</strong></span>
        </button>
        <div id="step-2-panel" class="step-panel" hidden>
          <div class="section-heading">
            <h2 id="upload-title">Upload your payment file</h2>
          </div>
          <aside class="safety-notice upload-safety" aria-labelledby="safety-title">
            <div id="safety-icon" class="notice-icon" aria-hidden="true"></div>
            <div>
              <strong id="safety-title">Use test data only</strong>
              <p>
                Selected files are never uploaded to Huntington, but using sensitive data is never advised.
              </p>
            </div>
          </aside>
          <div id="drop-zone" class="drop-zone">
            <div class="upload-icon" aria-hidden="true">↑</div>
            <p><strong>Drag and drop one file here</strong></p>
            <p id="accepted-extensions" class="helper"></p>
            <p class="helper">Maximum size: 25MB</p>
            <label id="choose-file" class="file-picker-label">
              Choose file
              <input id="file-input" class="file-picker-input" type="file" aria-describedby="file-help" />
            </label>
            <p id="file-help" class="visually-hidden">Choose one matching file up to 25 MB.</p>
          </div>
          <div id="upload-error" class="inline-error" role="alert" hidden></div>
          <div id="selected-file" class="selected-file" hidden>
            <div id="file-extension" class="file-badge" aria-hidden="true">FILE</div>
            <div class="file-details">
              <strong id="file-name"></strong>
              <span id="file-size" class="helper"></span>
            </div>
            <div class="file-actions">
              <button id="replace-file" class="button text" type="button">Replace</button>
              <button id="remove-file" class="button text danger-text" type="button">Remove</button>
            </div>
          </div>
          <div class="step-actions split-actions">
            <button class="button secondary" type="button" data-open-step="1">← Change format</button>
            <button id="validate-file" class="button primary" type="button" disabled>Validate file →</button>
          </div>
        </div>
      </section>

      <section class="wizard-step card" data-wizard-step="3">
        <button class="accordion-trigger" type="button" data-open-step="3" aria-expanded="false" aria-controls="step-3-panel" disabled>
          <span><span class="big-number" aria-hidden="true">03</span><strong>View results</strong></span>
        </button>
        <div id="step-3-panel" class="step-panel" hidden>
          <div id="result-banner" class="result-banner">
            <div>
              <p class="step-label">Validation Summary</p>
              <h2 id="results-title"></h2>
              <p id="result-basis" class="result-basis"></p>
            </div>
            <div class="metrics" aria-label="Finding counts">
              <div><span id="error-count">0</span><strong>Errors</strong></div>
              <div><span id="warning-count">0</span><strong>Warnings</strong></div>
              <div><span id="pass-count">0</span><strong>Pass</strong></div>
            </div>
          </div>
          <div class="findings-card">
            <div class="toolbar" aria-label="Result controls">
              <label class="search-field"><span>Search</span><input id="finding-search" type="search" placeholder="Field, path, or message" /></label>
              <fieldset class="severity-filter">
                <legend>Result</legend>
                <button class="filter-toggle active" type="button" data-outcome="ERROR" aria-pressed="true">Error</button>
                <button class="filter-toggle active" type="button" data-outcome="WARNING" aria-pressed="true">Warning</button>
                <button class="filter-toggle active" type="button" data-outcome="PASS" aria-pressed="true">Pass</button>
              </fieldset>
              <label><span>Path</span><select id="path-filter"><option value="">All paths</option></select></label>
              <label>
                <span>Sort</span>
                <select id="sort-order">
                  <option value="severity-desc">Result: Error to Pass</option>
                  <option value="severity-asc">Result: Pass to Error</option>
                  <option value="path-asc">Path: A to Z</option>
                  <option value="path-desc">Path: Z to A</option>
                </select>
              </label>
            </div>
            <div class="table-wrap">
              <table>
                <colgroup>
                  <col class="column-severity" />
                  <col class="column-field" />
                  <col class="column-location" />
                  <col class="column-message" />
                </colgroup>
                <thead><tr><th scope="col">Result</th><th scope="col">Field</th><th scope="col">Path</th><th scope="col">Message</th></tr></thead>
                <tbody id="finding-rows"></tbody>
              </table>
            </div>
            <nav id="results-pagination" class="pagination" aria-label="Validation result pages" hidden>
              <p id="pagination-status"></p>
              <div class="pagination-actions">
                <button id="previous-page" class="button secondary" type="button">← Previous</button>
                <button id="next-page" class="button secondary" type="button">Next →</button>
              </div>
            </nav>
          </div>
          <div class="step-actions split-actions results-actions">
            <button class="button secondary" type="button" data-open-step="2">← Back to file</button>
            <button id="export-csv" class="button secondary" type="button" disabled>Export CSV report</button>
          </div>
        </div>
      </section>
    </div>
    ${explorerEnabled ? explorerMarkup() : ""}
    <div id="live-status" class="visually-hidden" role="status" aria-live="polite"></div>
  </div>
`;

  for (const element of app.querySelectorAll<HTMLElement>("[id], [for], [aria-controls], [aria-labelledby], [aria-describedby]")) {
    for (const attribute of ["id", "for", "aria-controls", "aria-labelledby", "aria-describedby"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, value.split(" ").map((id) => prefix + id).join(" "));
    }
  }

  let workspace: HTMLDivElement | null = null;
  let workspaceDivider: HTMLDivElement | null = null;
  let showExplorerButton: HTMLButtonElement | null = null;
  let mobileResultsButton: HTMLButtonElement | null = null;
  let mobileFileButton: HTMLButtonElement | null = null;
  if (explorerEnabled) {
    const content = app.querySelector<HTMLDivElement>(".validator-content");
    const steps = content?.querySelector<HTMLOListElement>(".steps");
    const wizard = content?.querySelector<HTMLDivElement>(".wizard");
    const explorer = content?.querySelector<HTMLElement>("[data-file-explorer]");
    const live = content?.querySelector<HTMLElement>(`#${prefix}live-status`);
    if (!content || !steps || !wizard || !explorer || !live) throw new Error("Explorer workspace could not be constructed.");
    content.classList.add("explorer-enabled");
    workspace = document.createElement("div");
    workspace.className = "validator-workspace";
    workspace.dataset.mobileView = "results";
    const primary = document.createElement("div");
    primary.className = "validator-primary";
    primary.append(steps, wizard);
    workspaceDivider = document.createElement("div");
    workspaceDivider.className = "workspace-divider";
    workspaceDivider.tabIndex = 0;
    workspaceDivider.setAttribute("role", "separator");
    workspaceDivider.setAttribute("aria-label", "Resize validation results and file explorer");
    workspaceDivider.setAttribute("aria-orientation", "vertical");
    workspaceDivider.setAttribute("aria-valuemin", "30");
    workspaceDivider.setAttribute("aria-valuemax", "70");
    workspaceDivider.setAttribute("aria-valuenow", "40");
    workspace.append(primary, workspaceDivider, explorer);

    const mobileViews = document.createElement("div");
    mobileViews.className = "workspace-view-toggle";
    mobileViews.setAttribute("aria-label", "Workspace view");
    mobileResultsButton = document.createElement("button");
    mobileResultsButton.type = "button";
    mobileResultsButton.className = "button secondary active";
    mobileResultsButton.textContent = "Results";
    mobileResultsButton.setAttribute("aria-pressed", "true");
    mobileFileButton = document.createElement("button");
    mobileFileButton.type = "button";
    mobileFileButton.className = "button secondary";
    mobileFileButton.textContent = "File";
    mobileFileButton.setAttribute("aria-pressed", "false");
    mobileViews.append(mobileResultsButton, mobileFileButton);

    showExplorerButton = document.createElement("button");
    showExplorerButton.type = "button";
    showExplorerButton.className = "button secondary workspace-show-file";
    showExplorerButton.textContent = "Show file explorer";
    showExplorerButton.hidden = true;
    content.insertBefore(mobileViews, live);
    content.insertBefore(showExplorerButton, live);
    content.insertBefore(workspace, live);
  }

  requiredElement<HTMLElement>("#safety-icon").innerHTML = warningTriangleIcon;

  function requiredElement<T extends Element>(selector: string): T {
    const element = app.querySelector<T>(selector.startsWith("#") ? `#${prefix}${selector.slice(1)}` : selector);
    if (!element) throw new Error(`Required element is missing: ${selector}`);
    return element;
  }

  const formatSearch = requiredElement<HTMLInputElement>("#format-search");
  const comboboxWrap = requiredElement<HTMLDivElement>(".combobox-wrap");
  const formatListbox = requiredElement<HTMLUListElement>("#format-listbox");
  const versionSelect = requiredElement<HTMLSelectElement>("#version-select");
  const formatContinue = requiredElement<HTMLButtonElement>("#format-continue");
  const fileInput = requiredElement<HTMLInputElement>("#file-input");
  const replaceButton = requiredElement<HTMLButtonElement>("#replace-file");
  const removeButton = requiredElement<HTMLButtonElement>("#remove-file");
  const validateButton = requiredElement<HTMLButtonElement>("#validate-file");
  const exportButton = requiredElement<HTMLButtonElement>("#export-csv");
  const dropZone = requiredElement<HTMLDivElement>("#drop-zone");
  const uploadError = requiredElement<HTMLDivElement>("#upload-error");
  const selectedFilePanel = requiredElement<HTMLDivElement>("#selected-file");
  const liveStatus = requiredElement<HTMLDivElement>("#live-status");
  const outcomeFilters = new Set<RuleOutcome>(["ERROR", "WARNING", "PASS"]);
  const resultsPageSize = 25;
  const explorerPreparationDeadlineMs = 10_000;

  let activeStep: 1 | 2 | 3 = 1;
  const presetFormat = FORMAT_CATALOG.find((item) =>
    [item.id, item.code].some((value) => value.toLowerCase() === options.format?.toLowerCase()));
  const presetVersion = presetFormat?.versions.find((item) => item.id === options.version?.toLowerCase());
  const selectionLocked = Boolean(options.lockSelection && presetVersion?.validationProfileId);
  let selectedFormatId: string | null = presetFormat?.id ?? null;
  let selectedVersionId: string | null = presetVersion?.id ?? null;
  if (presetFormat) formatSearch.value = `${presetFormat.code} — ${presetFormat.name}`;
  if (presetVersion?.validationProfileId) activeStep = 2;
  let selectedFile: File | null = null;
  let currentRun: ValidationRun | null = null;
  let acceptedSnapshotId: number | null = null;
  let resultsPage = 1;
  let activeWorker: Worker | null = null;
  let validating = false;
  // Replacement, reset, and unmount advance this token. File reads cannot be
  // cancelled, so continuations and worker messages must match the current
  // generation before changing UI state; terminating the worker is not enough.
  let runGeneration = 0;
  let validationDeadline: number | null = null;
  let explorerDeadline: number | null = null;
  let visibleFormats: readonly FormatCatalogEntry[] = FORMAT_CATALOG;
  let activeOptionIndex = -1;
  let explorerController: FileExplorerController | null = null;

  const selectedFormat = () => findCatalogEntry(selectedFormatId);
  const selectedVersion = () => findCatalogVersion(selectedFormatId, selectedVersionId);
  const selectedProfileId = () => selectedVersion()?.validationProfileId ?? null;

  function humanFileSize(bytes: number): string {
    if (bytes < 1_000) return `${bytes} bytes`;
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }

  function fileExtensionBadge(fileName: string): string {
    const extensionIndex = fileName.lastIndexOf(".");
    return extensionIndex >= 0 ? fileName.slice(extensionIndex).toUpperCase() : "FILE";
  }

  function setUploadError(message: string | null): void {
    uploadError.hidden = !message;
    uploadError.textContent = message ?? "";
  }

  function announce(message: string): void {
    liveStatus.textContent = "";
    window.setTimeout(() => {
      liveStatus.textContent = message;
    }, 10);
  }

  function setMobileWorkspaceView(view: "results" | "file"): void {
    if (!workspace) return;
    workspace.dataset.mobileView = view;
    mobileResultsButton?.classList.toggle("active", view === "results");
    mobileFileButton?.classList.toggle("active", view === "file");
    mobileResultsButton?.setAttribute("aria-pressed", String(view === "results"));
    mobileFileButton?.setAttribute("aria-pressed", String(view === "file"));
  }

  function revealExplorer(): void {
    if (!workspace) return;
    workspace.classList.remove("explorer-hidden");
    if (showExplorerButton) showExplorerButton.hidden = true;
    setMobileWorkspaceView("file");
  }

  function hideExplorer(): void {
    if (!workspace) return;
    workspace.classList.add("explorer-hidden");
    workspace.classList.remove("explorer-expanded");
    const expandButton = workspace.querySelector<HTMLButtonElement>("[data-explorer-expand]");
    if (expandButton) expandButton.textContent = "Expand explorer";
    if (showExplorerButton) showExplorerButton.hidden = false;
    setMobileWorkspaceView("results");
  }

  function toggleExpandedExplorer(): boolean {
    if (!workspace) return false;
    workspace.classList.remove("explorer-hidden");
    workspace.classList.toggle("explorer-expanded");
    if (showExplorerButton) showExplorerButton.hidden = true;
    setMobileWorkspaceView("file");
    return workspace.classList.contains("explorer-expanded");
  }

  if (explorerEnabled) {
    const explorerRoot = app.querySelector<HTMLElement>("[data-file-explorer]");
    if (!explorerRoot) throw new Error("File explorer root is missing.");
    explorerController = new FileExplorerController({
      root: explorerRoot,
      getVisibleFindings: () => visibleFindings(),
      showFindingInResults,
      onLocationLabelsChanged: () => renderFindingRows(),
      onHide: hideExplorer,
      onExpand: toggleExpandedExplorer,
      announce,
    });
    explorerController.setPlaceholder("Validate a selected file to inspect its decoded source here.");
    showExplorerButton?.addEventListener("click", revealExplorer);
    mobileResultsButton?.addEventListener("click", () => setMobileWorkspaceView("results"));
    mobileFileButton?.addEventListener("click", revealExplorer);

    const setDividerValue = (value: number): void => {
      if (!workspace || !workspaceDivider) return;
      const clamped = Math.max(30, Math.min(70, Math.round(value)));
      workspace.style.setProperty("--wizard-share", `${clamped}%`);
      workspaceDivider.setAttribute("aria-valuenow", String(clamped));
    };
    workspaceDivider?.addEventListener("keydown", (event) => {
      const current = Number(workspaceDivider?.getAttribute("aria-valuenow") ?? 40);
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") setDividerValue(current - 2);
      if (event.key === "ArrowRight") setDividerValue(current + 2);
      if (event.key === "Home") setDividerValue(30);
      if (event.key === "End") setDividerValue(70);
    });
    workspaceDivider?.addEventListener("dblclick", () => setDividerValue(40));
    workspaceDivider?.addEventListener("pointerdown", (event) => {
      if (!workspace || !workspaceDivider) return;
      event.preventDefault();
      workspaceDivider.setPointerCapture(event.pointerId);
      const move = (moveEvent: PointerEvent): void => {
        const bounds = workspace?.getBoundingClientRect();
        if (!bounds?.width) return;
        setDividerValue(((moveEvent.clientX - bounds.left) / bounds.width) * 100);
      };
      const finish = (): void => {
        workspaceDivider?.removeEventListener("pointermove", move);
        workspaceDivider?.removeEventListener("pointerup", finish);
        workspaceDivider?.removeEventListener("pointercancel", finish);
      };
      workspaceDivider.addEventListener("pointermove", move);
      workspaceDivider.addEventListener("pointerup", finish);
      workspaceDivider.addEventListener("pointercancel", finish);
    });
  }

  function terminateWorker(): void {
    if (validationDeadline !== null) window.clearTimeout(validationDeadline);
    if (explorerDeadline !== null) window.clearTimeout(explorerDeadline);
    validationDeadline = null;
    explorerDeadline = null;
    activeWorker?.terminate();
    activeWorker = null;
    validating = false;
    validateButton.textContent = "Validate file →";
  }

  function invalidateActiveWork(): void {
    runGeneration += 1;
    terminateWorker();
  }

  function completeValidationPhase(): void {
    if (validationDeadline !== null) window.clearTimeout(validationDeadline);
    validationDeadline = null;
    validating = false;
    validateButton.textContent = "Validate file →";
  }

  function clearRun(): void {
    currentRun = null;
    acceptedSnapshotId = null;
    resultsPage = 1;
    exportButton.disabled = true;
  }

  function clearFileAndRun(): void {
    invalidateActiveWork();
    selectedFile = null;
    fileInput.value = "";
    selectedFilePanel.hidden = true;
    setUploadError(null);
    clearRun();
    explorerController?.setPlaceholder("Validate a selected file to inspect its decoded source here.");
  }

  function formatDisplay(item: FormatCatalogEntry): string {
    return `${item.code} — ${item.name}`;
  }

  function setListboxOpen(open: boolean): void {
    formatListbox.hidden = !open;
    formatSearch.setAttribute("aria-expanded", String(open));
    if (!open) {
      activeOptionIndex = -1;
      formatSearch.removeAttribute("aria-activedescendant");
    }
  }

  function renderFormatList(): void {
    visibleFormats = searchFormatCatalog(formatSearch.value);
    formatListbox.replaceChildren();
    if (visibleFormats.length === 0) {
      const empty = document.createElement("li");
      empty.className = "no-options";
      empty.textContent = "No formats match your search.";
      empty.setAttribute("role", "presentation");
      formatListbox.append(empty);
      return;
    }
    const header = document.createElement("li");
    header.className = "format-list-header";
    header.setAttribute("role", "presentation");
    for (const label of ["Format", "Code", "Standard"]) {
      const cell = document.createElement("span");
      cell.textContent = label;
      header.append(cell);
    }
    formatListbox.append(header);
    visibleFormats.forEach((item, index) => {
      const option = document.createElement("li");
      option.id = `${prefix}format-option-${item.id}`;
      option.className = "format-option";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(item.id === selectedFormatId));
      if (index === activeOptionIndex) option.classList.add("active");
      for (const value of [item.standard, item.code, item.name]) {
        const cell = document.createElement("span");
        cell.textContent = value;
        option.append(cell);
      }
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => chooseFormat(item));
      formatListbox.append(option);
    });
    if (activeOptionIndex >= 0) {
      formatSearch.setAttribute("aria-activedescendant", `${prefix}format-option-${visibleFormats[activeOptionIndex]?.id}`);
    }
  }

  function chooseFormat(item: FormatCatalogEntry): void {
    // Choosing even the same format resets its version, so invalidate any pending run.
    clearFileAndRun();
    selectedFormatId = item.id;
    selectedVersionId = null;
    formatSearch.value = formatDisplay(item);
    setListboxOpen(false);
    renderAll();
    versionSelect.focus();
    announce(`${item.code}, ${item.name}, selected. Choose a version.`);
  }

  function renderVersionPicker(): void {
    const format = selectedFormat();
    const versionField = requiredElement<HTMLElement>("#version-field");
    versionSelect.replaceChildren();
    if (!format) {
      versionSelect.append(new Option("Select a file format", ""));
      versionSelect.disabled = true;
      versionField.classList.add("disabled");
      return;
    }
    versionSelect.append(new Option("Select a version", ""));
    for (const item of format.versions) versionSelect.append(new Option(item.label, item.id));
    versionSelect.disabled = false;
    versionField.classList.remove("disabled");
    versionSelect.value = selectedVersionId ?? "";
  }

  function renderFormatSelection(): void {
    const format = selectedFormat();
    const version = selectedVersion();
    const helper = requiredElement<HTMLElement>("#format-selection-help");
    helper.replaceChildren();
    helper.hidden = false;
    if (!format) {
      helper.hidden = true;
    } else if (!version) {
      helper.hidden = true;
    } else if (!version.validationProfileId) {
      helper.textContent = `Accepted extensions: ${extensionList(version.extensions)} · Reference only — validation is unavailable in this demo.`;
    } else {
      const guideUrl = findEnabledFormatPack(version.validationProfileId)?.guideUrl;
      if (guideUrl) {
        const guideLink = document.createElement("a");
        guideLink.href = guideUrl;
        guideLink.target = "_blank";
        guideLink.rel = "noopener noreferrer";
        guideLink.textContent = "File Format Guide";
        const sampleLink = document.createElement("a");
        sampleLink.href = `${guideUrl}#sample-file`;
        sampleLink.target = "_blank";
        sampleLink.rel = "noopener noreferrer";
        sampleLink.textContent = "sample file";
        helper.append("See ", guideLink, " and ", sampleLink);
      } else {
        helper.textContent = "File Format Guide unavailable.";
      }
    }
    formatContinue.disabled = !version?.validationProfileId;
  }

  function renderUpload(): void {
    const version = selectedVersion();
    const extensions = version?.extensions ?? [];
    requiredElement<HTMLElement>("#upload-title").textContent = version
      ? `Upload your ${version.label} file`
      : "Upload your payment file";
    fileInput.accept = extensions.join(",");
    requiredElement<HTMLElement>("#accepted-extensions").textContent = extensions.length
      ? `Accepted file types: ${extensionList(extensions)}`
      : "Choose a supported format and version first.";
    if (selectedFile) {
      requiredElement<HTMLElement>("#file-extension").textContent = fileExtensionBadge(selectedFile.name);
      requiredElement<HTMLElement>("#file-name").textContent = selectedFile.name;
      requiredElement<HTMLElement>("#file-size").textContent = humanFileSize(selectedFile.size);
      selectedFilePanel.hidden = false;
    } else {
      selectedFilePanel.hidden = true;
    }
    validateButton.disabled = validating || !selectedFile || !selectedProfileId();
  }

  function canOpenStep(step: number): boolean {
    if (step === 1) return true;
    if (step === 2) return Boolean(selectedProfileId());
    return Boolean(currentRun);
  }

  function openStep(step: 1 | 2 | 3): void {
    if (!canOpenStep(step)) return;
    activeStep = step;
    renderWizard();
    requiredElement<HTMLElement>(`#step-${step}-panel`).focus({ preventScroll: true });
  }

  function renderWizard(): void {
    if (!canOpenStep(activeStep)) activeStep = 1;
    const stepIsComplete = (step: number): boolean => step === 1
      ? Boolean(selectedProfileId()) && activeStep > 1
      : step === 2
        ? Boolean(currentRun) && activeStep > 2
        : false;
    app.querySelectorAll<HTMLElement>("[data-wizard-step]").forEach((section) => {
      const step = Number(section.dataset.wizardStep) as 1 | 2 | 3;
      const panel = requiredElement<HTMLElement>(`#step-${step}-panel`);
      const trigger = section.querySelector<HTMLButtonElement>(".accordion-trigger");
      const expanded = step === activeStep;
      panel.hidden = !expanded;
      panel.tabIndex = expanded ? -1 : 0;
      trigger?.setAttribute("aria-expanded", String(expanded));
      if (trigger) trigger.disabled = !canOpenStep(step);
      section.classList.toggle("active", expanded);
      section.classList.toggle("complete", stepIsComplete(step));
    });

    app.querySelectorAll<HTMLElement>(".step").forEach((step) => {
      const number = Number(step.dataset.step);
      const current = number === activeStep;
      step.classList.toggle("active", current);
      step.classList.toggle("complete", stepIsComplete(number));
      if (current) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });

  }

  function renderAll(): void {
    renderVersionPicker();
    renderFormatSelection();
    renderUpload();
    renderWizard();
    if (selectionLocked) {
      formatSearch.disabled = true;
      versionSelect.disabled = true;
    }
  }

  formatSearch.addEventListener("focus", () => {
    formatSearch.select();
    renderFormatList();
    setListboxOpen(true);
  });
  formatSearch.addEventListener("input", () => {
    activeOptionIndex = -1;
    renderFormatList();
    setListboxOpen(true);
  });
  comboboxWrap.addEventListener("focusout", () => window.setTimeout(() => {
    if (!comboboxWrap.contains(document.activeElement)) setListboxOpen(false);
  }, 0));
  formatSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setListboxOpen(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
    event.preventDefault();
    if (formatListbox.hidden) setListboxOpen(true);
    if (event.key === "ArrowDown") activeOptionIndex = Math.min(activeOptionIndex + 1, visibleFormats.length - 1);
    if (event.key === "ArrowUp") activeOptionIndex = Math.max(activeOptionIndex - 1, 0);
    if (event.key === "Enter" && activeOptionIndex >= 0) {
      const item = visibleFormats[activeOptionIndex];
      if (item) chooseFormat(item);
      return;
    }
    renderFormatList();
  });

  versionSelect.addEventListener("change", () => {
    const next = versionSelect.value || null;
    if (next !== selectedVersionId) clearFileAndRun();
    selectedVersionId = next;
    renderAll();
    const version = selectedVersion();
    if (version) announce(`${version.label} selected. Accepted file types: ${extensionList(version.extensions)}.`);
  });

  formatContinue.addEventListener("click", () => {
    if (!selectedProfileId()) return;
    activeStep = 2;
    renderAll();
    announce("Format selection complete. Upload one matching file.");
  });

  app.querySelectorAll<HTMLButtonElement>("[data-open-step]").forEach((button) => {
    button.addEventListener("click", () => openStep(Number(button.dataset.openStep) as 1 | 2 | 3));
  });

  function chooseFiles(files: FileList | readonly File[]): void {
    const version = selectedVersion();
    if (!version?.validationProfileId) return;
    const error = fileSelectionError(Array.from(files), version.extensions);
    if (error) {
      setUploadError(error);
      return;
    }
    const candidate = files[0];
    if (!candidate) return;
    invalidateActiveWork();
    selectedFile = candidate;
    clearRun();
    setUploadError(null);
    explorerController?.setPlaceholder(
      "The source will appear after this file is validated.",
      candidate.name,
      humanFileSize(candidate.size),
    );
    renderAll();
    announce(`${candidate.name} selected. Ready to validate.`);
  }

  replaceButton.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
  removeButton.addEventListener("click", () => {
    clearFileAndRun();
    activeStep = 2;
    renderAll();
    announce("The selected file and results were removed.");
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) chooseFiles(fileInput.files);
  });

  for (const eventName of ["dragenter", "dragover"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  }
  dropZone.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (files) chooseFiles(files);
  });

  function findings(): readonly RuleResult[] {
    return currentRun?.results ?? [];
  }

  function populatePathFilter(): void {
    const select = requiredElement<HTMLSelectElement>("#path-filter");
    const current = select.value;
    select.replaceChildren(new Option("All paths", ""));
    const paths = [...new Set(findings().map((finding) => finding.locator))].sort((a, b) => a.localeCompare(b));
    for (const path of paths) select.append(new Option(path, path));
    select.value = paths.includes(current) ? current : "";
  }

  function visibleFindings(): readonly RuleResult[] {
    const query = requiredElement<HTMLInputElement>("#finding-search").value.trim().toLocaleLowerCase();
    const path = requiredElement<HTMLSelectElement>("#path-filter").value;
    const sort = requiredElement<HTMLSelectElement>("#sort-order").value;
    const rank = (value: RuleResult): number => {
      if (value.outcome === "ERROR") return 2;
      if (value.outcome === "WARNING") return 1;
      return 0;
    };
    return findings()
      .filter((finding) => outcomeFilters.has(finding.outcome))
      .filter((finding) => !path || finding.locator === path)
      .filter((finding) => !query || `${finding.field} ${finding.locator} ${finding.message}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        let compared = 0;
        if (sort === "severity-desc") compared = rank(b) - rank(a);
        if (sort === "severity-asc") compared = rank(a) - rank(b);
        if (sort === "path-asc") compared = a.locator.localeCompare(b.locator);
        if (sort === "path-desc") compared = b.locator.localeCompare(a.locator);
        return compared || a.ordinal - b.ordinal;
      });
  }

  function showFindingInResults(ordinal: number, focus: boolean): void {
    const rows = visibleFindings();
    const page = pageForFinding(rows, ordinal, resultsPageSize);
    if (page !== null) resultsPage = page;
    renderFindingRows();
    if (!focus) return;
    setMobileWorkspaceView("results");
    window.setTimeout(() => {
      app.querySelector<HTMLButtonElement>(`[data-finding-action="${ordinal}"]`)?.focus();
    }, 0);
  }

  function renderFindingRows(): void {
    const activeFindingAction = document.activeElement instanceof HTMLElement && app.contains(document.activeElement)
      ? document.activeElement.dataset.findingAction
      : undefined;
    const restoreFindingActionFocus = (): void => {
      if (activeFindingAction === undefined) return;
      app.querySelector<HTMLButtonElement>(`[data-finding-action="${activeFindingAction}"]`)?.focus();
    };
    const body = requiredElement<HTMLTableSectionElement>("#finding-rows");
    body.replaceChildren();
    const rows = visibleFindings();
    const window = pageWindow(rows.length, resultsPage, resultsPageSize);
    resultsPage = window.page;
    const pagination = requiredElement<HTMLElement>("#results-pagination");
    const paginationStatus = requiredElement<HTMLElement>("#pagination-status");
    pagination.hidden = rows.length <= resultsPageSize;
    paginationStatus.textContent = rows.length === 0
      ? "No results"
      : `Page ${window.page} of ${window.pageCount} · Showing ${window.start + 1}–${window.end} of ${rows.length} results`;
    requiredElement<HTMLButtonElement>("#previous-page").disabled = window.page === 1;
    requiredElement<HTMLButtonElement>("#next-page").disabled = window.page === window.pageCount;
    if (rows.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.className = "no-findings";
      cell.textContent = findings().length === 0 ? "No validation results are available." : "No results match these filters.";
      row.append(cell);
      body.append(row);
      explorerController?.reconcileVisibleFindings();
      restoreFindingActionFocus();
      return;
    }
    for (const finding of rows.slice(window.start, window.end)) {
      const row = document.createElement("tr");
      if (explorerController?.isSelected(finding.ordinal)) row.classList.add("selected-finding");
      const severity = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `severity ${finding.outcome.toLowerCase()}`;
      badge.textContent = finding.outcome;
      severity.append(badge);
      const field = document.createElement("td");
      field.textContent = finding.field;
      const locator = document.createElement("td");
      const code = document.createElement("code");
      code.textContent = finding.locator;
      locator.append(code);
      const message = document.createElement("td");
      const messageText = document.createElement("span");
      messageText.textContent = finding.message;
      message.append(messageText);
      if (explorerController && finding.outcome !== "PASS") {
        const action = document.createElement("button");
        action.type = "button";
        action.className = "button text finding-source-action";
        action.dataset.findingAction = String(finding.ordinal);
        action.textContent = explorerController.actionLabel(finding);
        action.setAttribute("aria-pressed", String(explorerController.isSelected(finding.ordinal)));
        action.addEventListener("click", () => {
          revealExplorer();
          explorerController?.selectFinding(finding);
        });
        message.append(action);
      }
      row.append(severity, field, locator, message);
      body.append(row);
    }
    explorerController?.reconcileVisibleFindings();
    restoreFindingActionFocus();
  }

  function renderResults(): void {
    if (!currentRun) return;
    resultsPage = 1;
    const label = overallStatusLabel(currentRun.overallStatus);
    requiredElement<HTMLElement>("#results-title").textContent = label;
    requiredElement<HTMLElement>("#result-basis").textContent = currentRun.overallStatus === "FAIL"
      ? "Based on syntax and structure checks, this file contains the errors below. Please resolve them before file submission."
      : "This result is based on syntax and structure checks. It does not guarantee that Huntington will accept, process, or execute the file.";
    const passCount = currentRun.results.filter((result) => result.outcome === "PASS").length;
    requiredElement<HTMLElement>("#error-count").textContent = String(currentRun.errorCount);
    requiredElement<HTMLElement>("#warning-count").textContent = String(currentRun.warningCount);
    requiredElement<HTMLElement>("#pass-count").textContent = String(passCount);
    requiredElement<HTMLDivElement>("#result-banner").dataset.status = currentRun.overallStatus;
    exportButton.disabled = false;
    populatePathFilter();
    renderFindingRows();
    activeStep = 3;
    renderAll();
    announce(`Validation complete. Result: ${label}. ${currentRun.errorCount} errors, ${currentRun.warningCount} warnings, and ${passCount} passes.`);
  }

  app.querySelectorAll<HTMLButtonElement>(".filter-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const outcome = button.dataset.outcome as RuleOutcome;
      if (outcomeFilters.has(outcome)) outcomeFilters.delete(outcome);
      else outcomeFilters.add(outcome);
      const active = outcomeFilters.has(outcome);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      renderAfterFindingControlsChange();
    });
  });
  const renderAfterFindingControlsChange = (): void => {
    const selectedOrdinal = explorerController?.selectedFindingOrdinal() ?? null;
    const selectedPage = selectedOrdinal === null ? null : pageForFinding(visibleFindings(), selectedOrdinal, resultsPageSize);
    resultsPage = selectedPage ?? 1;
    renderFindingRows();
  };
  requiredElement<HTMLInputElement>("#finding-search").addEventListener("input", renderAfterFindingControlsChange);
  requiredElement<HTMLSelectElement>("#path-filter").addEventListener("change", renderAfterFindingControlsChange);
  requiredElement<HTMLSelectElement>("#sort-order").addEventListener("change", renderAfterFindingControlsChange);
  requiredElement<HTMLButtonElement>("#previous-page").addEventListener("click", () => {
    resultsPage -= 1;
    renderFindingRows();
    announce(requiredElement<HTMLElement>("#pagination-status").textContent ?? "Previous result page.");
  });
  requiredElement<HTMLButtonElement>("#next-page").addEventListener("click", () => {
    resultsPage += 1;
    renderFindingRows();
    announce(requiredElement<HTMLElement>("#pagination-status").textContent ?? "Next result page.");
  });

  validateButton.addEventListener("click", async () => {
    const profileId = selectedProfileId();
    if (!selectedFile || !profileId || validating) return;
    const file = selectedFile;
    const generation = ++runGeneration;
    validating = true;
    clearRun();
    explorerController?.setPlaceholder("Validation is in progress. Previous source state has been cleared.", file.name, humanFileSize(file.size));
    setUploadError(null);
    validateButton.textContent = "Validating…";
    renderUpload();
    announce("Validation started.");

    function failRun(code: ValidationFailureCode): void {
      if (generation !== runGeneration) return;
      invalidateActiveWork();
      const message = validationFailureMessage(code);
      setUploadError(message);
      renderAll();
      announce(message);
    }

    // The deadline lives outside the worker so a busy parser cannot block it.
    // It includes file reading; invalidation prevents a late read from starting work.
    validationDeadline = window.setTimeout(() => failRun("TIMEOUT"), VALIDATION_DEADLINE_MS);
    let bytes: ArrayBuffer;
    try {
      bytes = await file.arrayBuffer();
    } catch {
      failRun("FILE_READ_ERROR");
      return;
    }
    if (generation !== runGeneration) return;

    let worker: Worker;
    try {
      worker = new InlineValidationWorker();
    } catch {
      failRun("WORKER_UNAVAILABLE");
      return;
    }
    activeWorker = worker;
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      if (generation !== runGeneration || worker !== activeWorker) return;
      if (event.data.type === "complete") {
        completeValidationPhase();
        currentRun = event.data.run;
        acceptedSnapshotId = event.data.snapshotId ?? generation;
        if (explorerController && event.data.source !== undefined) {
          explorerController.acceptSnapshot({
            id: acceptedSnapshotId,
            fileName: file.name,
            fileSizeLabel: humanFileSize(file.size),
            source: event.data.source,
            run: event.data.run,
          });
        }
        renderResults();
        if (event.data.explorerPending && explorerController) {
          explorerDeadline = window.setTimeout(() => {
            if (acceptedSnapshotId !== generation) return;
            explorerController?.setLocationFailure(generation);
            terminateWorker();
          }, explorerPreparationDeadlineMs);
        } else {
          terminateWorker();
        }
      } else if (event.data.type === "explorer-ready") {
        if (event.data.snapshotId !== acceptedSnapshotId) return;
        explorerController?.setLocations(event.data.snapshotId, event.data.locations);
        terminateWorker();
      } else if (event.data.type === "explorer-error") {
        if (event.data.snapshotId !== acceptedSnapshotId) return;
        explorerController?.setLocationFailure(event.data.snapshotId);
        terminateWorker();
      } else if (event.data.type === "error") {
        failRun(event.data.code);
      }
    });
    const handleWorkerFailure = (): void => {
      if (generation !== runGeneration || worker !== activeWorker) return;
      if (acceptedSnapshotId === generation && currentRun) {
        explorerController?.setLocationFailure(generation);
        terminateWorker();
      } else {
        failRun("WORKER_ERROR");
      }
    };
    worker.addEventListener("error", handleWorkerFailure);
    worker.addEventListener("messageerror", handleWorkerFailure);
    try {
      const request: WorkerRequest = {
        type: "validate",
        packId: profileId,
        fileName: file.name,
        bytes,
        includeExplorer: explorerEnabled,
        snapshotId: generation,
      };
      worker.postMessage(request, [bytes]);
    } catch {
      failRun("WORKER_ERROR");
    }
  });

  exportButton.addEventListener("click", () => {
    if (!currentRun) return;
    const blob = new Blob([validationRunToCsv(currentRun)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = validationReportFileName(currentRun);
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("The complete validation CSV report was downloaded.");
  });

  renderAll();

  return () => {
    explorerController?.destroy();
    explorerController = null;
    clearFileAndRun();
    app.replaceChildren();
    delete app.dataset.validatorMounted;
  };
}
