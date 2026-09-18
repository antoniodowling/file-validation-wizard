import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountPaymentFileValidator } from "../src/app";
import { VALIDATION_DEADLINE_MS, type WorkerRequest, type WorkerResponse } from "../src/types";
import { validateWorkerRequest } from "../src/worker-request";
import { validPain001 } from "./helpers";

const control = vi.hoisted(() => ({ workers: [] as FakeWorker[], refuseStart: false, refuseSend: false }));
class FakeWorker extends EventTarget {
  terminated = false;
  requests: WorkerRequest[] = [];
  constructor() {
    super();
    if (control.refuseStart) throw new Error("CSP test");
    control.workers.push(this);
  }
  terminate() { this.terminated = true; }
  postMessage(request: WorkerRequest) {
    if (control.refuseSend) throw new Error("transfer test");
    this.requests.push(request);
  }
  respond(response: WorkerResponse) { this.dispatchEvent(new MessageEvent("message", { data: response })); }
}
vi.mock("../src/validation.worker?worker&inline", () => ({ default: class {
  constructor() { return new FakeWorker(); }
} }));
vi.mock("bootstrap-icons/icons/exclamation-triangle.svg?raw", () => ({ default: "<svg></svg>" }));

let root: HTMLDivElement;
let unmount: () => void;
const q = <T extends HTMLElement = HTMLElement>(selector: string): T => root.querySelector<T>(selector)!;
const bytes = () => new TextEncoder().encode(validPain001.replace("pain.001.001.99", "pain.001.001.09")).buffer;
function chooseFile(name: string, read: () => Promise<ArrayBuffer> = async () => bytes()) {
  const file = new File(["synthetic"], name);
  Object.defineProperty(file, "arrayBuffer", { value: read });
  Object.defineProperty(q("#file-input"), "files", { configurable: true, value: [file] });
  q("#file-input").dispatchEvent(new Event("change"));
}
async function start() { q("#validate-file").click(); await Promise.resolve(); }
function expectIncomplete() {
  expect(q("#step-3-panel").hidden).toBe(true);
  expect(q<HTMLButtonElement>("#export-csv").disabled).toBe(true);
  expect(q<HTMLButtonElement>("#validate-file").disabled).toBe(false);
}

function selectPainProfile() {
  q<HTMLInputElement>("#format-search").value = "pain.001";
  q("#format-search").dispatchEvent(new Event("input")); q('[role="option"]').click();
  q<HTMLSelectElement>("#version-select").value = "pain.001.001.09";
  q("#version-select").dispatchEvent(new Event("change")); q("#format-continue").click();
}

function remountWithExplorer() {
  unmount();
  unmount = mountPaymentFileValidator(root, { enableExplorer: true });
  selectPainProfile();
}

beforeEach(() => {
  vi.useFakeTimers(); control.workers = []; control.refuseStart = false; control.refuseSend = false;
  root = document.createElement("div"); document.body.append(root);
  unmount = mountPaymentFileValidator(root);
  selectPainProfile();
});
afterEach(() => { unmount(); root.remove(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("validation lifecycle", () => {
  it("scopes the explorer to opted-in mounts and keeps its workspace controls coherent", () => {
    expect(root.querySelector("[data-file-explorer]")).toBeNull();
    remountWithExplorer();
    expect(q("[data-file-explorer]")).toBeTruthy();
    expect(Array.from(root.querySelectorAll("thead th")).every((header) => header.getAttribute("scope") === "col")).toBe(true);
    expect(q('[data-step="2"]').getAttribute("aria-current")).toBe("step");

    q("[data-explorer-expand]").click();
    expect(q(".validator-workspace").classList.contains("explorer-expanded")).toBe(true);
    expect(q("[data-explorer-expand]").textContent).toBe("Restore split");
    q("[data-explorer-hide]").click();
    expect(q(".validator-workspace").classList.contains("explorer-hidden")).toBe(true);
    expect(q("[data-explorer-expand]").textContent).toBe("Expand file");
    q(".workspace-view-toggle .button:last-child").click();
    expect(q(".validator-workspace").classList.contains("explorer-hidden")).toBe(false);
    expect(q(".validator-workspace").dataset.mobileView).toBe("file");
  });

  it("terminates a silent worker at the deadline, ignores late results, and permits retry", async () => {
    chooseFile("A.xml"); await start();
    const worker = control.workers[0]!;
    vi.advanceTimersByTime(VALIDATION_DEADLINE_MS - 1); expect(worker.terminated).toBe(false);
    vi.advanceTimersByTime(1); expect(worker.terminated).toBe(true);
    expect(q("#upload-error").textContent).toContain("stopped after 10 seconds"); expectIncomplete();
    worker.respond(validateWorkerRequest(worker.requests[0]!)); expectIncomplete();
    await start();
    const retry = control.workers[1]!; retry.respond(validateWorkerRequest(retry.requests[0]!));
    expect(q("#results-title").textContent).toBe("PASS");
    expect(q("#step-3-panel").hidden).toBe(false);
    expect(q<HTMLButtonElement>("#export-csv").disabled).toBe(false);
    vi.advanceTimersByTime(VALIDATION_DEADLINE_MS);
    expect(q("#upload-error").hidden).toBe(true);
  });
  it("invalidates a pending read when the file is replaced", async () => {
    let resolve!: (value: ArrayBuffer) => void;
    chooseFile("A.xml", () => new Promise(r => { resolve = r; })); await start();
    chooseFile("B.xml"); resolve(bytes()); await Promise.resolve();
    expect(control.workers).toHaveLength(0);
    await start(); expect(control.workers[0]!.requests[0]!.fileName).toBe("B.xml");
  });
  it.each(["remove", "version", "reselect-format", "unmount", "timeout"])("invalidates a pending read on %s", async (action) => {
    let resolve!: (value: ArrayBuffer) => void;
    chooseFile("A.xml", () => new Promise(r => { resolve = r; })); await start();
    if (action === "remove") q("#remove-file").click();
    if (action === "reselect-format") {
      q<HTMLInputElement>("#format-search").value = "pain.001";
      q("#format-search").dispatchEvent(new Event("input")); q('[role="option"]').click();
    }
    if (action === "version") {
      q<HTMLSelectElement>("#version-select").value = "pain.001.001.03";
      q("#version-select").dispatchEvent(new Event("change"));
    }
    if (action === "unmount") unmount();
    if (action === "timeout") vi.advanceTimersByTime(VALIDATION_DEADLINE_MS);
    resolve(bytes()); await Promise.resolve();
    expect(control.workers).toHaveLength(0);
  });
  it("ignores old read failures while a newer run is active", async () => {
    let reject!: (reason: Error) => void;
    chooseFile("A.xml", () => new Promise((_, r) => { reject = r; })); await start();
    chooseFile("B.xml"); await start(); reject(new Error("old read")); await Promise.resolve();
    expect(control.workers[0]!.terminated).toBe(false);
    expect(q("#upload-error").hidden).toBe(true);
  });
  it("reports a read error separately from worker startup and runtime failures", async () => {
    chooseFile("A.xml", async () => { throw new Error("read"); }); await start();
    expect(q("#upload-error").textContent).toContain("could not read"); expectIncomplete();
    chooseFile("B.xml"); control.refuseStart = true; await start();
    expect(q("#upload-error").textContent).toContain("could not open"); expectIncomplete();
    control.refuseStart = false; await start();
    control.workers[0]!.dispatchEvent(new Event("error"));
    expect(q("#upload-error").textContent).toContain("worker failed"); expectIncomplete();
  });
  it.each(["messageerror", "transfer"])("recovers from a %s failure", async (kind) => {
    chooseFile("A.xml"); control.refuseSend = kind === "transfer"; await start();
    if (kind === "messageerror") control.workers[0]!.dispatchEvent(new Event("messageerror"));
    expect(control.workers[0]!.terminated).toBe(true); expectIncomplete();
    expect(q("#upload-error").textContent).toContain("worker failed");
  });
  it("presents an engine error without converting it to file FAIL", async () => {
    chooseFile("A.xml"); await start();
    control.workers[0]!.respond({ type: "error", code: "ENGINE_ERROR" });
    expect(q("#upload-error").textContent).toContain("engine encountered an error"); expectIncomplete();
  });
  it("clears completed results when another file is selected", async () => {
    chooseFile("A.xml"); await start();
    const worker = control.workers[0]!; worker.respond(validateWorkerRequest(worker.requests[0]!));
    q<HTMLButtonElement>('[data-open-step="2"].button').click(); chooseFile("B.xml");
    expectIncomplete();
  });

  it("accepts validation before optional explorer enrichment completes", async () => {
    remountWithExplorer();
    chooseFile("A.xml"); await start();
    const worker = control.workers[0]!;
    const completion = validateWorkerRequest(worker.requests[0]!);
    expect(completion.type).toBe("complete");
    worker.respond(completion);
    expect(q("#results-title").textContent).toBe("PASS");
    expect(q<HTMLButtonElement>("#export-csv").disabled).toBe(false);
    expect(worker.terminated).toBe(false);
    expect(q("[data-explorer-notice]").textContent).toContain("preparing");

    const snapshotId = worker.requests[0]!.snapshotId!;
    worker.respond({ type: "explorer-ready", snapshotId, locations: [] });
    expect(worker.terminated).toBe(true);
    expect(q("#results-title").textContent).toBe("PASS");
    expect(q<HTMLButtonElement>("#export-csv").disabled).toBe(false);
  });

  it("keeps completed results when explorer enrichment fails", async () => {
    remountWithExplorer();
    chooseFile("A.xml"); await start();
    const worker = control.workers[0]!;
    worker.respond(validateWorkerRequest(worker.requests[0]!));
    worker.respond({ type: "explorer-error", snapshotId: worker.requests[0]!.snapshotId! });
    expect(worker.terminated).toBe(true);
    expect(q("#results-title").textContent).toBe("PASS");
    expect(q<HTMLButtonElement>("#export-csv").disabled).toBe(false);
    expect(q("[data-explorer-notice]").textContent).toContain("unavailable");
  });

  it("preserves finding-action focus when enrichment updates its label", async () => {
    remountWithExplorer();
    const warningSource = validPain001
      .replace("pain.001.001.99", "pain.001.001.09")
      .replace(/^<\?xml[^>]+>\n/u, "");
    chooseFile("warning.xml", async () => new TextEncoder().encode(warningSource).buffer);
    await start();
    const worker = control.workers[0]!;
    const completion = validateWorkerRequest(worker.requests[0]!);
    expect(completion.type).toBe("complete");
    if (completion.type !== "complete") return;
    worker.respond(completion);
    const finding = completion.run.results.find((entry) => entry.outcome === "WARNING");
    expect(finding).toBeTruthy();
    if (!finding) return;
    const action = q<HTMLButtonElement>(`[data-finding-action="${finding.ordinal}"]`);
    action.focus();
    worker.respond({
      type: "explorer-ready",
      snapshotId: worker.requests[0]!.snapshotId!,
      locations: [{
        ordinal: finding.ordinal,
        location: {
          kind: "located",
          primary: { kind: "context", label: "Test context.", span: { start: 0, end: 0 } },
          related: [],
        },
      }],
    });
    const updatedAction = q(`[data-finding-action="${finding.ordinal}"]`);
    expect(document.activeElement).toBe(updatedAction);
    expect(updatedAction.textContent).toBe("View ›");
  });

  it("ignores late explorer data after a same-name file replacement", async () => {
    remountWithExplorer();
    chooseFile("same.xml"); await start();
    const worker = control.workers[0]!;
    worker.respond(validateWorkerRequest(worker.requests[0]!));
    const snapshotId = worker.requests[0]!.snapshotId!;
    q<HTMLButtonElement>('[data-open-step="2"].button').click();
    chooseFile("same.xml");
    worker.respond({ type: "explorer-ready", snapshotId, locations: [] });
    expect(q("[data-explorer-notice]").textContent).toContain("after this file is validated");
    expectIncomplete();
  });
});
