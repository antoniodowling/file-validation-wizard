import { expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { syntheticSample } from "../src/samples";
import { validateSource } from "../src/validation";
it("generates passing and failing test fixtures for all executable versions", () => {
  for (const pack of FORMAT_PACKS) {
    expect(validateSource("sample", syntheticSample(pack, false), pack).overallStatus, pack.id).toBe("PASS");
    expect(validateSource("sample", syntheticSample(pack, true), pack).overallStatus, pack.id).toBe("FAIL");
  }
});
