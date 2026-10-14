import { expect, it } from "vitest";
import { validateWorkerRequest } from "../src/worker-request";
// @ts-ignore the fixture generator is plain Node ESM
import { stressCases } from "../scripts/generate-stress-files.mjs";
const cases = stressCases() as Array<{ name: string; expected: string; make: () => string | Uint8Array }>;
for (const fixture of cases) it(`resource policy matches stress guidance: ${fixture.name}`, () => {
  const source = fixture.make();
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : new Uint8Array(source);
  const response = validateWorkerRequest({ type: "validate", packId: fixture.name.endsWith(".edi") ? "edi-820-005010" : "pain-001-09", fileName: fixture.name, bytes: bytes.buffer as ArrayBuffer });
  if (fixture.expected.includes("RESOURCE_LIMIT")) expect(response).toEqual({type:"error",code:"RESOURCE_LIMIT"});
  else if (fixture.name.startsWith("08-")) expect(response).toEqual({type:"error",code:"FILE_TOO_LARGE"});
  else if (fixture.name.startsWith("03-")) expect(response).toEqual({type:"error",code:"INVALID_ENCODING"});
  else { expect(response.type).toBe("complete"); if (response.type === "complete") expect(response.run.overallStatus).toBe(fixture.expected.includes("PASS") ? "PASS" : "FAIL"); }
});
