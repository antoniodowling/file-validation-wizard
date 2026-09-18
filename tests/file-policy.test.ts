import { describe, expect, it } from "vitest";
import { extensionOf, fileSelectionError } from "../src/file-policy";
import { MAX_FILE_BYTES } from "../src/types";

describe("file selection policy", () => {
  it("accepts approved extensions case-insensitively at the size boundary", () => {
    for (const name of ["one.XML", "one.edi", "one.X12", "one.820", "one.TXT"]) {
      expect(fileSelectionError([{ name, size: MAX_FILE_BYTES }], [".xml", ".edi", ".x12", ".820", ".txt"])).toBeNull();
    }
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
