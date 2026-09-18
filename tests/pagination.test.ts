import { describe, expect, it } from "vitest";
import { pageWindow } from "../src/pagination";

describe("pageWindow", () => {
  it("keeps up to 25 results on one page", () => {
    expect(pageWindow(0, 1, 25)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
    expect(pageWindow(25, 1, 25)).toEqual({ page: 1, pageCount: 1, start: 0, end: 25 });
  });

  it("creates deterministic 25-result pages", () => {
    expect(pageWindow(26, 1, 25)).toEqual({ page: 1, pageCount: 2, start: 0, end: 25 });
    expect(pageWindow(26, 2, 25)).toEqual({ page: 2, pageCount: 2, start: 25, end: 26 });
    expect(pageWindow(51, 2, 25)).toEqual({ page: 2, pageCount: 3, start: 25, end: 50 });
  });

  it("clamps stale page requests after filtering", () => {
    expect(pageWindow(26, 99, 25)).toEqual({ page: 2, pageCount: 2, start: 25, end: 26 });
    expect(pageWindow(26, -5, 25)).toEqual({ page: 1, pageCount: 2, start: 0, end: 25 });
    expect(() => pageWindow(10, 1, 0)).toThrow("Page size must be a positive integer.");
  });
});
