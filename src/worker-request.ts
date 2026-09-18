import { findEnabledFormatPack } from "./format-packs";
import { MAX_FILE_BYTES, type WorkerRequest, type WorkerResponse } from "./types";
import { validateSource } from "./validation";

export function validateWorkerRequest(request: WorkerRequest): WorkerResponse {
  // Check before decoding or parsing, independently of the file-picker policy.
  if (request.bytes.byteLength > MAX_FILE_BYTES) return { type: "error", code: "FILE_TOO_LARGE" };
  const pack = findEnabledFormatPack(request.packId);
  if (!pack) return { type: "error", code: "PROFILE_UNAVAILABLE" };

  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(request.bytes);
  } catch {
    return { type: "error", code: "INVALID_ENCODING" };
  }
  try {
    return { type: "complete", run: validateSource(request.fileName, source, pack) };
  } catch {
    // Parser exceptions can contain file content. Send a category, not raw exception text.
    return { type: "error", code: "ENGINE_ERROR" };
  }
}
