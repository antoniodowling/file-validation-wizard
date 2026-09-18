import { describe, expect, it } from "vitest";
import { findProhibitedDeclaration } from "../src/prohibited-declarations";

describe("prohibited XML declaration detection", () => {
  it("does not flag an ordinary PAIN document", () => {
    expect(findProhibitedDeclaration('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"/>')).toBeNull();
  });

  it("finds declaration markers case-insensitively", () => {
    expect(findProhibitedDeclaration('prefix<!DoCtYpE Document>')).toEqual({ index: 6, length: 9 });
  });

  it("returns the earliest prohibited marker", () => {
    expect(findProhibitedDeclaration('<!ENTITY example "value"><!DOCTYPE Document>')).toEqual({ index: 0, length: 8 });
  });
});
