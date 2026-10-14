import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { parseXml } from "../src/parsers/xml-adapter";
import manifest from "./fixtures/w3c/manifest.json";
for (const fixture of manifest.cases) {
  it(`pinned W3C ${fixture.file}: ${fixture.claim}`, () => {
    const bytes = readFileSync(`${process.cwd()}/tests/fixtures/w3c/${fixture.file}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.sha256);
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (fixture.expect === "pass") expect(() => parseXml(source)).not.toThrow();
    else expect(() => parseXml(source)).toThrow();
  });
}
