import { expect, it } from "vitest";
import { ALL_FORMAT_PACKS } from "../src/format-packs";
import { MAX_FILE_BYTES } from "../src/types";
import { ResourceLimitError } from "../src/resource-policy";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
// @ts-ignore the fixture generator is plain Node ESM
import { stressCases } from "../scripts/generate-stress-files.mjs";

const cases = stressCases() as Array<{ name: string; expected: string; make: () => string | Uint8Array }>;
for (const fixture of cases) it(`preserves historical stress behavior: ${fixture.name}`, () => {
  const source = fixture.make();
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : new Uint8Array(source);
  const currentWorker = (packId = "pain-001-03") => validateWorkerRequest({
    type: "validate", packId, fileName: fixture.name, bytes: bytes.buffer as ArrayBuffer,
  });
  // Cross-version stress files are immutable historical evidence. New public
  // dispatch rejects retired packs; direct-engine historical tests still run.
  if (bytes.byteLength > MAX_FILE_BYTES) {
    expect(currentWorker()).toEqual({ type: "error", code: "FILE_TOO_LARGE" });
    return;
  }
  if (fixture.name.startsWith("03-")) {
    expect(currentWorker()).toEqual({ type: "error", code: "INVALID_ENCODING" });
    return;
  }
  const id = fixture.name.endsWith(".edi") ? "edi-820-005010" : "pain-001-09";
  const legacyPack = ALL_FORMAT_PACKS.find(pack => pack.id === id)!;
  const sourceText = typeof source === "string" ? source : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (fixture.expected.includes("RESOURCE_LIMIT")) {
    expect(() => validateSource(fixture.name, sourceText, legacyPack)).toThrow(ResourceLimitError);
  } else {
    expect(validateSource(fixture.name, sourceText, legacyPack).overallStatus)
      .toBe(fixture.expected.includes("PASS") ? "PASS" : "FAIL");
  }
});
