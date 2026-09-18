import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReadOnlySourceViewer } from "../src/source-viewer";

describe("read-only source viewer finding highlights", () => {
  let host: HTMLDivElement;
  let viewer: ReadOnlySourceViewer;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    viewer = new ReadOnlySourceViewer(host, "alpha\nbeta", { start: 0, end: 10 });
  });

  afterEach(() => {
    viewer.destroy();
    host.remove();
  });

  it("uses a red decoration for an error range", () => {
    viewer.setFindingTarget({ kind: "exact", label: "Error", span: { start: 0, end: 5 } }, "ERROR");
    expect(host.querySelector(".cm-finding-error")?.textContent).toBe("alpha");
    expect(host.querySelector(".cm-finding-warning")).toBeNull();
  });

  it("uses a yellow line decoration for a warning point", () => {
    viewer.setFindingTarget({ kind: "parser-position", label: "Warning", span: { start: 6, end: 6 } }, "WARNING");
    expect(host.querySelector(".cm-finding-line.cm-finding-warning")).toBeTruthy();
    expect(host.querySelector(".cm-finding-error")).toBeNull();
  });

  it("uses a neutral decoration when no severity applies", () => {
    viewer.setFindingTarget({ kind: "context", label: "Context", span: { start: 6, end: 10 } }, null);
    expect(host.querySelector(".cm-finding-neutral")?.textContent).toBe("beta");
  });
});
