import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerRequest, WorkerResponse } from "../src/types";
import { validPain001 } from "./helpers";

vi.mock("../src/finding-locations", async (original) => {
  const actual = await original<typeof import("../src/finding-locations")>();
  return { ...actual, locateFindings: vi.fn(actual.locateFindings) };
});

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function runWorker(failMapping = false, includeExplorer = false) {
  const worker = Object.assign(new EventTarget(), { postMessage: vi.fn<(response: WorkerResponse) => void>() });
  vi.stubGlobal("self", worker);
  const { locateFindings } = await import("../src/finding-locations");
  if (failMapping) vi.mocked(locateFindings).mockImplementationOnce(() => { throw new Error("PRIVATE-SOURCE-TEXT"); });
  await import("../src/validation.worker");
  const source = validPain001.replace("pain.001.001.99", "pain.001.001.09").replace("<NbOfTxs>1", "<NbOfTxs>bad");
  const request: WorkerRequest = { type: "validate", fileName: "test.xml", packId: "pain-001-09", bytes: new TextEncoder().encode(source).buffer, snapshotId: 12, includeFindingLines: true, includeExplorer };
  worker.dispatchEvent(new MessageEvent("message", { data: request }));
  return worker.postMessage.mock.calls.map(([response]) => response);
}

describe("worker source line delivery", () => {
  it("publishes compact results before line summaries without sending decoded source", async () => {
    const [completion, enrichment] = await runWorker();
    expect(completion!.type).toBe("complete");
    expect(completion).not.toHaveProperty("source");
    if (!completion || completion.type !== "complete" || !enrichment || enrichment.type !== "explorer-ready") throw new Error("Unexpected worker response");
    expect(enrichment.locations).toEqual([]);
    const count = completion.run.results.find(finding => finding.ruleId === "iso.transaction-count-type")!;
    expect(enrichment.lines!.find(line => line.ordinal === count.ordinal)!.label).toBe("4");
  });
  it("retains the source and navigation targets for explorer mounts", async () => {
    const [completion, enrichment] = await runWorker(false, true);
    expect(completion).toHaveProperty("source");
    if (!enrichment || enrichment.type !== "explorer-ready") throw new Error("Unexpected worker response");
    expect(enrichment.locations.length).toBeGreaterThan(0);
    expect(enrichment.lines!.length).toBeGreaterThan(0);
  });
  it("preserves completed FAIL results and sends no exception text when mapping fails", async () => {
    const responses = await runWorker(true);
    expect(responses[0]).toMatchObject({ type: "complete", run: { overallStatus: "FAIL" } });
    expect(responses[1]).toEqual({ type: "explorer-error", snapshotId: 12 });
    expect(JSON.stringify(responses)).not.toContain("PRIVATE-SOURCE-TEXT");
  });
});
