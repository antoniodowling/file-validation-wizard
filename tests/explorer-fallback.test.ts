import { expect, it, vi } from "vitest";
import { FileExplorerController, explorerMarkup } from "../src/explorer-controller";
import { validateSource } from "../src/validation";
import { isoPack, validPain001 } from "./helpers";
vi.mock("../src/source-viewer", () => ({ ReadOnlySourceViewer: class { constructor() { throw new Error("synthetic viewer failure"); } } }));
it("shows the full fallback source and erases hidden source on clear", () => {
  const root = document.createElement("div"); root.innerHTML = explorerMarkup();
  const controller = new FileExplorerController({root, getVisibleFindings:()=>[], showFindingInResults:()=>{}, onLocationLabelsChanged:()=>{}, onHide:()=>{}, onExpand:()=>false, announce:()=>{}});
  const source = validPain001.replace("TEST-001", " ".repeat(300_000));
  const run = validateSource("synthetic.xml", source, isoPack());
  controller.acceptSnapshot({ id:1, fileName:"synthetic.xml", fileSizeLabel:"300KB", source, run });
  const fallback = root.querySelector<HTMLElement>("[data-source-fallback]")!;
  expect(fallback.textContent).toBe(source);
  controller.setPlaceholder("Removed");
  expect(fallback.textContent).toBe(""); expect(fallback.hidden).toBe(true);
  expect(root.querySelector("[data-source-viewer]")!.textContent).toBe("");
});
