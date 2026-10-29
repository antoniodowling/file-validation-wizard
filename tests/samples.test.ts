import { expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { syntheticSample } from "../src/samples";
import { validateSource } from "../src/validation";
it("generates scoped positive and failing wiring fixtures for selectable versions", () => {
  for (const pack of FORMAT_PACKS) {
    expect(validateSource("sample", syntheticSample(pack, false), pack).overallStatus, pack.id).toBe(pack.id === "edi-820-008030" ? "UNSUPPORTED" : "PASS");
    expect(validateSource("sample", syntheticSample(pack, true), pack).overallStatus, pack.id).toBe("FAIL");
  }
});
