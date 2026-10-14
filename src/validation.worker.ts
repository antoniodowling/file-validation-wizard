/// <reference lib="webworker" />

import { findingLines } from "./finding-lines";
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
  // Only explorer mounts receive the decoded source; compact mounts receive line summaries.
  if (response.type === "complete" && !request.includeExplorer) {
    const { source: _source, ...compactResponse } = response;
    worker.postMessage(compactResponse);
  } else {
    worker.postMessage(response);
  }
  if (
    response.type !== "complete"
    || !response.explorerPending
    || response.source === undefined
    || response.snapshotId === undefined
  ) return;

  const pack = findEnabledFormatPack(request.packId);
  if (!pack) return;
  try {
    const locations = locateFindings(response.source, pack, response.run);
    const explorerResponse: WorkerResponse = {
      type: "explorer-ready",
      snapshotId: response.snapshotId,
      locations: request.includeExplorer ? locations : [],
      lines: findingLines(response.source, locations),
    };
    worker.postMessage(explorerResponse);
  } catch {
    const explorerResponse: WorkerResponse = { type: "explorer-error", snapshotId: response.snapshotId };
    worker.postMessage(explorerResponse);
  }
});
