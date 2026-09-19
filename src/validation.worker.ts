/// <reference lib="webworker" />

import { locateFindings } from "./finding-locations";
import { findEnabledFormatPack } from "./format-packs";
import type { WorkerRequest, WorkerResponse } from "./types";
import { validateWorkerRequest } from "./worker-request";

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== "validate") return;
  const response = validateWorkerRequest(request);
  // Publish the validation result before optional source mapping. Mapping can
  // exhaust its own budget or fail without changing the completed PASS/FAIL;
  // the UI handles explorer-ready/explorer-error against the same snapshot ID.
  worker.postMessage(response);
  if (
    response.type !== "complete"
    || !response.explorerPending
    || response.source === undefined
    || response.snapshotId === undefined
  ) return;

  const pack = findEnabledFormatPack(request.packId);
  if (!pack) return;
  try {
    const explorerResponse: WorkerResponse = {
      type: "explorer-ready",
      snapshotId: response.snapshotId,
      locations: locateFindings(response.source, pack, response.run),
    };
    worker.postMessage(explorerResponse);
  } catch {
    const explorerResponse: WorkerResponse = { type: "explorer-error", snapshotId: response.snapshotId };
    worker.postMessage(explorerResponse);
  }
});
