import warningTriangleIcon from "bootstrap-icons/icons/exclamation-triangle.svg?raw";
import InlineValidationWorker from "./validation.worker?worker&inline";
import { validationReportFileName, validationRunToCsv } from "./csv";
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
}

export function mountPaymentFileValidator(app: HTMLDivElement, options: ValidatorOptions = {}): () => void {
const prefix = options.idPrefix ?? "";

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
                Selected files are never uploaded to Huntington, but using sensitive data is still not advised.
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
                <thead><tr><th>Result</th><th>Field</th><th>Path</th><th>Message</th></tr></thead>
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
    <div id="live-status" class="visually-hidden" role="status" aria-live="polite"></div>
  </div>
`;

for (const element of app.querySelectorAll<HTMLElement>("[id], [for], [aria-controls], [aria-labelledby], [aria-describedby]")) {
  for (const attribute of ["id", "for", "aria-controls", "aria-labelledby", "aria-describedby"]) {
    const value = element.getAttribute(attribute);
    if (value) element.setAttribute(attribute, value.split(" ").map((id) => prefix + id).join(" "));
  }
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
let resultsPage = 1;
let activeWorker: Worker | null = null;
let validating = false;
let runGeneration = 0;
let validationDeadline: number | null = null;
let visibleFormats: readonly FormatCatalogEntry[] = FORMAT_CATALOG;
let activeOptionIndex = -1;

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

function stopWorker(): void {
  runGeneration += 1;
  if (validationDeadline !== null) window.clearTimeout(validationDeadline);
  validationDeadline = null;
  activeWorker?.terminate();
  activeWorker = null;
  validating = false;
  validateButton.textContent = "Validate file →";
}

function clearRun(): void {
  currentRun = null;
  resultsPage = 1;
  exportButton.disabled = true;
}

function clearFileAndRun(): void {
  stopWorker();
  selectedFile = null;
  fileInput.value = "";
  selectedFilePanel.hidden = true;
  setUploadError(null);
  clearRun();
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
    step.classList.toggle("active", number === activeStep);
    step.classList.toggle("complete", stepIsComplete(number));
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
  stopWorker();
  selectedFile = candidate;
  clearRun();
  setUploadError(null);
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

function renderFindingRows(): void {
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
    return;
  }
  for (const finding of rows.slice(window.start, window.end)) {
    const row = document.createElement("tr");
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
    message.textContent = finding.message;
    row.append(severity, field, locator, message);
    body.append(row);
  }
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
    resultsPage = 1;
    renderFindingRows();
  });
});
const resetPageAndRenderFindings = (): void => {
  resultsPage = 1;
  renderFindingRows();
};
requiredElement<HTMLInputElement>("#finding-search").addEventListener("input", resetPageAndRenderFindings);
requiredElement<HTMLSelectElement>("#path-filter").addEventListener("change", resetPageAndRenderFindings);
requiredElement<HTMLSelectElement>("#sort-order").addEventListener("change", resetPageAndRenderFindings);
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
  setUploadError(null);
  validateButton.textContent = "Validating…";
  renderUpload();
  announce("Validation started.");

  function failRun(code: ValidationFailureCode): void {
    if (generation !== runGeneration) return;
    stopWorker();
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
      stopWorker();
      currentRun = event.data.run;
      renderResults();
    } else {
      failRun(event.data.code);
    }
  });
  worker.addEventListener("error", () => failRun("WORKER_ERROR"));
  worker.addEventListener("messageerror", () => failRun("WORKER_ERROR"));
  try {
    const request: WorkerRequest = { type: "validate", packId: profileId, fileName: file.name, bytes };
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
  clearFileAndRun();
  app.replaceChildren();
  delete app.dataset.validatorMounted;
};
}
