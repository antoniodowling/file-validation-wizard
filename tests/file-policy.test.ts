import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extensionOf, fileSelectionError } from "../src/file-policy";
import { findCatalogVersion } from "../src/format-catalog";
import { findEnabledFormatPack } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { MAX_FILE_BYTES } from "../src/types";

describe("file selection policy", () => {
  it("accepts approved extensions case-insensitively at the size boundary", () => {
    for (const name of ["one.XML", "one.edi", "one.X12", "one.820", "one.TXT"]) {
      expect(fileSelectionError([{ name, size: MAX_FILE_BYTES }], [".xml", ".edi", ".x12", ".820", ".txt"])).toBeNull();
    }
  });

  it("accepts .nacha names without changing NACHA R2 validation", () => {
    const selected = findCatalogVersion("nacha", "origination-expanded-public-2026-r2")!;
    const pack = findEnabledFormatPack(selected.validationProfileId!)!;
    const content = readFileSync(resolve("demo-files/ach-candidates/origination-healthcare-pass.ach"), "utf8");
    const size = Buffer.byteLength(content, "utf8");

    for (const name of ["payments.ach", "payments.nacha", "payments.NACHA", "payments.txt"]) {
      expect(fileSelectionError([{ name, size }], selected.extensions)).toBeNull();
    }
    expect(fileSelectionError([{ name: "payments.nacha.exe", size }], selected.extensions))
      .toMatch(/Unsupported file extension/);

    const ach = validateSource("payments.ach", content, pack);
    const nacha = validateSource("payments.nacha", content, pack);
    expect(nacha.overallStatus).toBe("PASS");
    expect({ ...nacha, fileName: ach.fileName }).toEqual(ach);
  });

  it("rejects multiple, unsupported, extensionless, and oversized candidates", () => {
    expect(fileSelectionError([], [".xml"])).toMatch(/exactly one/);
    expect(fileSelectionError([{ name: "one.xml", size: 1 }, { name: "two.xml", size: 1 }], [".xml"])).toMatch(/exactly one/);
    expect(fileSelectionError([{ name: "one.pdf", size: 1 }], [".xml"])).toMatch(/Choose XML/);
    expect(fileSelectionError([{ name: "README", size: 1 }], [".xml"])).toMatch(/Unsupported/);
    expect(fileSelectionError([{ name: "one.xml", size: MAX_FILE_BYTES + 1 }], [".xml"])).toMatch(/25 MB/);
  });

  it("uses only the final extension for misleading names", () => {
    expect(extensionOf("payment.xml.exe")).toBe(".exe");
    expect(fileSelectionError([{ name: "payment.xml.exe", size: 10 }], [".xml"])).toMatch(/Unsupported/);
  });
});
