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

beforeEach(() => {
  vi.useFakeTimers(); control.workers = []; control.refuseStart = false; control.refuseSend = false;
  root = document.createElement("div"); document.body.append(root);
  unmount = mountPaymentFileValidator(root);
  q<HTMLInputElement>("#format-search").value = "pain.001";
  q("#format-search").dispatchEvent(new Event("input")); q('[role="option"]').click();
  q<HTMLSelectElement>("#version-select").value = "pain.001.001.09";
  q("#version-select").dispatchEvent(new Event("change")); q("#format-continue").click();
});
afterEach(() => { unmount(); root.remove(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("validation lifecycle", () => {
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
});
