import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileExplorerController, explorerMarkup } from "../src/explorer-controller";
import type { RuleResult, SourceTarget, ValidationRun } from "../src/types";

const viewerControl = vi.hoisted(() => ({
  targets: [] as Array<[SourceTarget | null, "ERROR" | "WARNING" | null]>,
}));

vi.mock("../src/source-viewer", () => ({
  ReadOnlySourceViewer: class {
    setFindingTarget(target: SourceTarget | null, severity: "ERROR" | "WARNING" | null) {
      viewerControl.targets.push([target, severity]);
    }
    destroy() {}
  },
}));

const finding: RuleResult = {
  ruleId: "demo.rule",
  outcome: "ERROR",
  severity: "ERROR",
  field: "Message ID",
  locator: "/Document/GrpHdr/MsgId",
  message: "The message ID is required.",
  ordinal: 1,
};

const run: ValidationRun = {
  fileName: "demo.xml",
  formatId: "pain.001.001.09",
  formatLabel: "PAIN.001",
  version: "pain.001.001.09",
  results: [finding],
  errorCount: 1,
  warningCount: 0,
  overallStatus: "FAIL",
};

describe("file explorer finding view", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    viewerControl.targets = [];
    root = document.createElement("div");
    root.innerHTML = explorerMarkup();
  });

  it("renders only finding navigation and a three-part detail row", () => {
    expect(root.querySelector("[data-explorer-expand]")?.textContent).toBe("Expand explorer");
    expect(root.querySelector("[data-explorer-hide]")?.textContent).toBe("Hide explorer");
    expect(root.querySelectorAll(".explorer-finding-data > div")).toHaveLength(3);
    expect(root.querySelector("[data-detail-field]")).toBeTruthy();
    expect(root.querySelector("[data-detail-locator]")).toBeTruthy();
    expect(root.querySelector("[data-detail-message]")).toBeTruthy();
    expect(root.querySelector("[data-finding-previous]")).toBeTruthy();
    expect(root.querySelector("[data-finding-next]")).toBeTruthy();
    expect(root.querySelector("[data-source-search], [data-go-line], [data-related-status], [data-location-explanation], [data-focus-source], [data-return-finding], [data-return-location]")).toBeNull();
  });

  it("sends only the primary target and finding severity to the viewer", () => {
    const primary: SourceTarget = { kind: "exact", label: "Primary", span: { start: 1, end: 4 } };
    const related: SourceTarget = { kind: "context", label: "Related", span: { start: 6, end: 9 } };
    const controller = new FileExplorerController({
      root,
      getVisibleFindings: () => [finding],
      showFindingInResults: () => {},
      onLocationLabelsChanged: () => {},
      onHide: () => {},
      onExpand: () => false,
      announce: () => {},
    });

    controller.acceptSnapshot({ id: 7, fileName: "demo.xml", fileSizeLabel: "10 bytes", source: "0123456789", run });
    controller.setLocations(7, [{
      ordinal: finding.ordinal,
      location: { kind: "located", primary, related: [related] },
    }]);
    controller.selectFinding(finding);

    expect(viewerControl.targets.at(-1)).toEqual([primary, "ERROR"]);
    expect(viewerControl.targets.some(([target]) => target === related)).toBe(false);
    controller.destroy();
  });
});
