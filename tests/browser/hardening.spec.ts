import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { syntheticSample } from "../../src/samples";
import { findEnabledFormatPack } from "../../src/format-packs";

test("generated pane reflow, sample upload, full source, focus and portable provenance", async ({ page }, info) => {
  await page.goto("/");
  await page.setContent('<main><h1>Synthetic acceptance</h1><div data-payment-file-validator data-file-explorer="true"></div></main>');
  await page.addStyleTag({path:resolve("readme-package/custom-css.css")});
  await page.addScriptTag({path:resolve("readme-package/custom-javascript.js")});
  const search = page.getByRole("combobox", {name:"File format"});
  for (const width of [320,375,400,1440]) {
    await page.setViewportSize({width,height:900});
    await search.fill("pain");
    const list = page.getByRole("listbox");
    expect(await list.evaluate(e=>e.scrollWidth <= e.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await search.fill("pain.001"); await page.getByRole("option", {name:/pain\.001/i}).click();
  await page.getByLabel("Version",{exact:true}).selectOption("pain.001.001.09");
  await search.fill("MT940");
  await expect(page.getByRole("button",{name:"Continue"})).toBeDisabled();
  await page.getByLabel("Version",{exact:true}).focus();
  await expect(search).toHaveValue(/pain\.001/);
  await page.getByRole("button",{name:"Continue"}).focus(); await page.keyboard.press("Enter");
  expect(await page.evaluate(()=>document.activeElement?.id.endsWith("step-2-panel"))).toBe(true);
  await expect(page.getByRole("button", { name: /Load (PASS|FAIL) sample/i })).toHaveCount(0);
  const pack = findEnabledFormatPack("pain-001-09")!;
  await page.locator('[id$="file-input"]').setInputFiles({
    name: "synthetic-fail.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(syntheticSample(pack, true)),
  });
  await page.getByRole("button",{name:"Validate file"}).click();
  await expect(page.locator('[id$="results-title"]')).toHaveText("FAIL");
  await expect(page.locator('[id$="result-basis"]')).toContainText("DEMO");
  expect(await page.evaluate(()=>document.activeElement?.id.endsWith("step-3-panel"))).toBe(true);
  await page.getByRole("button",{name:"View in file"}).click();
  await expect(page.locator("[data-detail-confidence]")).toContainText("exact");
  const divider = page.getByRole("separator");
  for (const key of ["Home", "End"] as const) {
    await divider.focus(); await divider.press(key);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".validator-primary").evaluate(e=>e.scrollWidth <= e.clientWidth)).toBe(true);
    expect(await page.locator(".toolbar select").first().evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(160);
    expect(await page.locator(".table-wrap th").first().evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(95);
  }
  await divider.press("Home");
  await page.locator(".validator-primary").evaluate(e => { e.scrollTop = 0; });
  await page.screenshot({path:info.outputPath("split-30-percent.png"),fullPage:true});
  await page.getByText("Versioned DEMO coverage and check evaluations", {exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText("Versioned DEMO coverage and check evaluations", {exact:true}).click();
  await page.getByRole("button",{name:"Hide explorer"}).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Show file explorer"})).toBeFocused();
  const download = page.waitForEvent("download"); await page.getByRole("button",{name:"Export JSON report"}).click();
  const report = await download; const path = await report.path();
  const {readFile} = await import("node:fs/promises");
  const json = JSON.parse(await readFile(path!,"utf8"));
  expect(json.provenance.buildRevision).toMatch(/^sha256:/);
  expect(json.provenance.mode).toBe("DEMO"); expect(json.checks.length).toBeGreaterThan(0);
  const screenshot = info.outputPath("hardened-pane.png");
  await page.screenshot({path:screenshot,fullPage:true});
  await info.attach("hardened-pane.png",{path:screenshot,contentType:"image/png"});
});

test("browser measurements: pathological target, repeated runs and DOM release", async ({ page }, info) => {
  await page.goto("/");
  await page.locator("#format-search").fill("pain.001"); await page.getByRole("option",{name:/pain\.001/i}).click();
  await page.locator("#version-select").selectOption("pain.001.001.09"); await page.getByRole("button",{name:"Continue"}).click();
  const rows: unknown[] = [];
  for (const size of [100, 300_000, 100]) {
    const source = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"><CstmrCdtTrfInitn><GrpHdr><MsgId>${" ".repeat(size)}</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr><PmtInf/></CstmrCdtTrfInitn></Document>`;
    await page.locator("#file-input").setInputFiles({name:"synthetic.xml",mimeType:"application/xml",buffer:Buffer.from(source)});
    await page.evaluate(() => {
      const state = { last: performance.now(), maxGapMs: 0, timer: 0 };
      state.timer = window.setInterval(() => { const now = performance.now(); state.maxGapMs = Math.max(state.maxGapMs, now - state.last); state.last = now; }, 16);
      (window as unknown as { benchmark: typeof state }).benchmark = state;
    });
    const started = Date.now(); await page.getByRole("button",{name:"Validate file"}).click();
    await expect(page.locator("#results-title")).toHaveText("FAIL");
    await page.getByRole("button",{name:"View in file"}).click();
    const rendered = await page.locator(".cm-content").innerText();
    await expect(page.getByRole("button", { name: /source window/i })).toHaveCount(0);
    const runtime = await page.evaluate(() => {
      const state = (window as unknown as { benchmark: { maxGapMs: number; timer: number } }).benchmark;
      window.clearInterval(state.timer);
      return { maxMainThreadHeartbeatGapMs: Math.round(state.maxGapMs), jsHeapBytes: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null };
    });
    rows.push({decodedUnits:source.length,elapsedMs:Date.now()-started,renderedUnits:rendered.length,...runtime});
    await page.getByRole("button",{name:"Back to file"}).click(); await page.getByRole("button",{name:"Remove",exact:true}).click();
    expect(await page.locator("[data-source-viewer], [data-source-fallback]").allTextContents()).toEqual(["",""]);
  }
  const measurements = JSON.stringify({environment:"local browser; not ReadMe hosted acceptance",measurements:rows,memory:"Peak process memory and GC recovery not measured; no memory envelope claim"},null,2);
  const measurementPath = info.outputPath("measurements.json");
  await writeFile(measurementPath, measurements);
  await info.attach("local-browser-measurements.json", { path: measurementPath, contentType: "application/json" });
});


test("full-source explorer reaches findings and file end beyond 12000 characters", async ({ page }) => {
  await page.goto("/");
  await page.locator("#format-search").fill("pain.001");
  await page.getByRole("option", { name: /pain\.001/i }).click();
  await page.locator("#version-select").selectOption("pain.001.001.09");
  await page.getByRole("button", { name: "Continue" }).click();
  const pack = findEnabledFormatPack("pain-001-09")!;
  const source = syntheticSample(pack, true).replace("<Document", `<!--${"source context\n".repeat(2000)}-->\n<Document`);
  await page.locator("#file-input").setInputFiles({ name: "large.xml", mimeType: "application/xml", buffer: Buffer.from(source) });
  await page.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("#results-title")).toHaveText("FAIL");
  await page.getByRole("button", { name: "View in file" }).click();
  await expect(page.locator(".cm-content")).toContainText("</Document>");
  await expect(page.locator(".cm-finding-error")).toBeVisible();
  await expect(page.getByRole("button", { name: /source window/i })).toHaveCount(0);
  const scroller = page.locator(".cm-scroller");
  await scroller.evaluate(element => { element.scrollTop = 0; });
  await expect(page.locator(".cm-content")).toContainText('<?xml version="1.0"');
  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator(".cm-content")).toContainText("</Document>");
});
