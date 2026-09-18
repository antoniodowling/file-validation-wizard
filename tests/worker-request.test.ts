import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES, type WorkerRequest } from "../src/types";
import { validateWorkerRequest } from "../src/worker-request";
import { validateSource } from "../src/validation";
import { validPain001 } from "./helpers";

vi.mock("../src/validation", async (original) => {
  const actual = await original<typeof import("../src/validation")>();
  return { ...actual, validateSource: vi.fn(actual.validateSource) };
});
const request = (bytes: ArrayBuffer, packId = "pain-001-09"): WorkerRequest =>
  ({ type: "validate", packId, fileName: "test.xml", bytes });
const encoded = (source: string): ArrayBuffer => new TextEncoder().encode(source).buffer;

beforeEach(() => { vi.mocked(validateSource).mockClear(); });

describe("worker input and failure boundaries", () => {
  it("rejects oversized bytes before decoding, profile lookup, or parsing", () => {
    expect(validateWorkerRequest(request(new ArrayBuffer(MAX_FILE_BYTES + 1), "missing")))
      .toEqual({ type: "error", code: "FILE_TOO_LARGE" });
    expect(validateSource).not.toHaveBeenCalled();
  });
  it("permits the exact byte limit through the size gate", () => {
    const source = validPain001.replace("pain.001.001.99", "pain.001.001.09");
    const response = validateWorkerRequest(request(encoded(source.padEnd(MAX_FILE_BYTES, " "))));
    expect(response.type).toBe("complete");
    expect(validateSource).toHaveBeenCalledOnce();
  });
  it("distinguishes an unavailable profile and invalid UTF-8", () => {
    expect(validateWorkerRequest(request(encoded("test"), "missing")))
      .toEqual({ type: "error", code: "PROFILE_UNAVAILABLE" });
    expect(validateWorkerRequest(request(new Uint8Array([0xc3, 0x28]).buffer)))
      .toEqual({ type: "error", code: "INVALID_ENCODING" });
    expect(validateSource).not.toHaveBeenCalled();
  });
  it("keeps malformed XML as a completed FAIL, not an engine failure", () => {
    const response = validateWorkerRequest(request(encoded("<Document>")));
    expect(response.type).toBe("complete");
    if (response.type === "complete") expect(response.run.overallStatus).toBe("FAIL");
  });
  it("categorizes engine exceptions without forwarding potentially sensitive text", () => {
    vi.mocked(validateSource).mockImplementationOnce(() => { throw new Error("PRIVATE-FILE-CONTENT"); });
    expect(validateWorkerRequest(request(encoded("test"))))
      .toEqual({ type: "error", code: "ENGINE_ERROR" });
  });
});
