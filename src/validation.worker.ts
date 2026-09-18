/// <reference lib="webworker" />

import { findEnabledFormatPack } from "./format-packs";
import type { WorkerRequest, WorkerResponse } from "./types";
import { validateSource } from "./validation";

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== "validate") return;
  try {
    const pack = findEnabledFormatPack(request.packId);
    if (!pack) throw new Error("The selected format is not available.");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(request.bytes);
    const run = validateSource(request.fileName, source, pack);
    const response: WorkerResponse = { type: "complete", run };
    worker.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: "error",
      message: error instanceof Error ? error.message : "Unable to validate the file.",
    };
    worker.postMessage(response);
  }
});
