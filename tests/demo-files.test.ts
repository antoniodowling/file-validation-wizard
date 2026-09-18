import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findEnabledFormatPack } from "../src/format-packs";
import { validateSource } from "../src/validation";

const fixtures = [
  ["pain.001.001.09-pass.xml", "PASS", 0, 0],
  ["pain.001.001.09-pass-with-warnings.xml", "PASS_WITH_WARNINGS", 0, 1],
  ["pain.001.001.09-fail.xml", "FAIL", 1, 0],
  ["pain.001.001.09-syntax-error.xml", "FAIL", 1, 0],
] as const;

describe("PAIN.001.001.09 browser demo files", () => {
  const pack = findEnabledFormatPack("pain-001-09");

  it.each(fixtures)("produces the intended result for %s", (fileName, status, errors, warnings) => {
    expect(pack).toBeTruthy();
    if (!pack) return;

    const path = resolve(process.cwd(), "demo-files", fileName);
    const run = validateSource(fileName, readFileSync(path, "utf8"), pack);

    expect(run.overallStatus).toBe(status);
    expect(run.errorCount).toBe(errors);
    expect(run.warningCount).toBe(warnings);
  });

  it("keeps the syntax-error fixture on the selected PAIN version and fails XML parsing", () => {
    expect(pack).toBeTruthy();
    if (!pack) return;

    const fileName = "pain.001.001.09-syntax-error.xml";
    const source = readFileSync(resolve(process.cwd(), "demo-files", fileName), "utf8");
    expect(source).toContain("urn:iso:std:iso:20022:tech:xsd:pain.001.001.09");
    const run = validateSource(fileName, source, pack);

    expect(run.results.at(-1)?.ruleId).toBe("iso.well-formed");
    expect(run.results.at(-1)?.outcome).toBe("ERROR");
    expect(run.results.some((result) => result.ruleId === "iso.namespace-version")).toBe(false);
  });
});
