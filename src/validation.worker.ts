/// <reference lib="webworker" />

import type { WorkerRequest } from "./types";
import { validateWorkerRequest } from "./worker-request";

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== "validate") return;
  worker.postMessage(validateWorkerRequest(request));
});
