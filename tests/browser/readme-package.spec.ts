import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

const packageFile = (name: string): string => resolve(process.cwd(), "readme-package", name);
const demoFile = (name: string): string => resolve(process.cwd(), "demo-files", name);

test("self-contained ReadMe package mounts on demand and validates locally", async ({ page }) => {
  await page.setContent("<main><p>Existing ReadMe page content</p></main>");
  await page.addStyleTag({ path: packageFile("custom-css.css") });
  await page.addScriptTag({ path: packageFile("custom-javascript.js") });

  await expect(page.locator("#format-search")).toHaveCount(0);
  await page.evaluate(() => {
    const root = document.createElement("div");
    root.id = "hnb-payment-file-validator";
    document.querySelector("main")?.append(root);
  });

  await expect(page.locator("#format-search")).toBeVisible();
  await page.locator("#format-search").focus();
  await expect(page.locator('#format-listbox [role="option"]')).toHaveCount(50);
  await page.locator("#format-search").fill("pain.001");
  await page.getByRole("option", { name: /pain\.001/i }).click();
  await page.locator("#version-select").selectOption("pain.001.001.09");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#file-input").setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  await page.getByRole("button", { name: "Validate file" }).click();

  await expect(page.locator("#results-title")).toHaveText("PASS");
  await expect(page.locator("#finding-rows tr")).toHaveCount(11);
  await expect(page.getByText("Existing ReadMe page content")).toBeVisible();
});

async function installPackage(page: import("@playwright/test").Page, html: string): Promise<void> {
  await page.goto("/");
  await page.setContent(html);
  await page.addStyleTag({ path: packageFile("custom-css.css") });
  await page.addScriptTag({ path: packageFile("custom-javascript.js") });
}

test("inline instances isolate controls and state, apply safe presets, and unmount on navigation", async ({ page }) => {
  await installPackage(page, `<main><h1>Guide</h1>
    <div data-payment-file-validator data-format="PAIN.001" data-version="pain.001.001.09" data-lock-selection="true"></div>
    <div data-payment-file-validator data-format="unknown" data-version="bad" data-lock-selection="true"></div>
    </main>`);
  const roots = page.locator("[data-payment-file-validator]");
  await expect(roots.nth(0).getByRole("button", { name: "Validate file" })).toBeVisible();
  await roots.nth(0).getByRole("button", { name: "Change format" }).click();
  await expect(roots.nth(0).getByRole("combobox", { name: "File format" })).toBeDisabled();
  await expect(roots.nth(0).getByLabel("Version", { exact: true })).toHaveValue("pain.001.001.09");
  await expect(roots.nth(1).getByRole("combobox", { name: "File format" })).toBeEnabled();
  await expect(roots.nth(1).getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return new Set(ids).size === ids.length;
  })).toBe(true);
  await expect(page.locator("main")).toHaveCount(1);
  await page.evaluate(() => document.querySelector("[data-payment-file-validator]")?.remove());
  await expect(roots).toHaveCount(1);
  await expect(roots.getByRole("combobox", { name: "File format" })).toBeEnabled();
});

test("modal validates, exports, traps focus, and clears file state on close and navigation", async ({ page }) => {
  await installPackage(page, `<main><h1>Guide</h1><a id="launch" href="/page/payment-file-validator#payment-file-validator?format=PAIN.001&version=pain.001.001.09&lockSelection=true">Validate payment</a></main>`);
  const originalUrl = page.url();
  await page.getByRole("link", { name: "Validate payment" }).click();
  const dialog = page.getByRole("dialog", { name: "Payment File Validation Wizard" });
  await expect(dialog).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await expect(dialog.getByRole("button", { name: "Close validator" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.locator('input[type="file"]').setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  await dialog.getByRole("button", { name: "Validate file" }).click();
  await expect(dialog.locator('[id$="results-title"]')).toHaveText("PASS");
  const download = page.waitForEvent("download");
  await dialog.locator('[id$="export-csv"]').click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#launch")).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await page.locator("#launch").click();
  await expect(dialog.getByRole("button", { name: "Validate file" })).toBeDisabled();
  await expect(dialog.locator('input[type="file"]')).toHaveValue("");
  await dialog.locator('input[type="file"]').setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  await page.evaluate(() => {
    const original = Worker.prototype.terminate;
    Worker.prototype.terminate = function () {
      document.body.dataset.workerTerminated = "true";
      original.call(this);
    };
    // Keep the worker active so closing deterministically exercises termination.
    Worker.prototype.postMessage = function () { document.body.dataset.workerStarted = "true"; };
  });
  await dialog.getByRole("button", { name: "Validate file" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-worker-started", "true");
  await dialog.getByRole("button", { name: "Close validator" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-worker-terminated", "true");
  await expect(dialog).toHaveCount(0);
  await page.locator("#launch").click();
  await page.evaluate(() => {
    history.pushState({}, "", "/docs/another-guide");
    document.querySelector("main")!.innerHTML = "<h1>Another Guide</h1>";
  });
  await expect(dialog).toHaveCount(0);
});

test("modal trigger runs before ReadMe-style client-side routing", async ({ page }) => {
  await page.goto("/");
  await page.setContent(`<main><h1>Guide</h1>
    <a id="launch" href="/page/payment-file-validator#payment-file-validator">Validate your payment file</a>
  </main>`);
  await page.evaluate(() => {
    document.addEventListener("click", (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      document.body.dataset.readmeRouterRan = "true";
      event.preventDefault();
    }, { capture: true });
  });
  await page.addStyleTag({ path: packageFile("custom-css.css") });
  await page.addScriptTag({ path: packageFile("custom-javascript.js") });

  await page.getByRole("link", { name: "Validate your payment file" }).click();

  await expect(page.getByRole("dialog", { name: "Payment File Validation Wizard" })).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-readme-router-ran", "true");
  await expect(page).toHaveURL(/\/$/);
});

test("dedicated-page fragments apply presets and modal leaves external and new-window links alone", async ({ page }) => {
  await page.goto("/#payment-file-validator?format=PAIN.001&version=pain.001.001.09");
  await page.setContent('<div id="hnb-payment-file-validator"></div>');
  await page.addScriptTag({ path: packageFile("custom-javascript.js") });
  await expect(page.getByRole("button", { name: "Validate file" })).toBeVisible();
  const prevented = await page.evaluate(() => {
    return ["https://example.com/#payment-file-validator", "/page/validator#unrelated", "/page/validator#payment-file-validator"].map((href, index) => {
      const a = document.createElement("a");
      a.href = href;
      if (index === 2) a.target = "_blank";
      document.body.append(a);
      let intercepted = false;
      window.addEventListener("click", (event) => { intercepted = event.defaultPrevented; event.preventDefault(); }, { once: true });
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      return intercepted;
    });
  });
  expect(prevented).toEqual([false, false, false]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("inline and modal layouts fit narrow containers", async ({ page }) => {
  await installPackage(page, `<main style="width: 360px"><h1>Guide</h1><div data-payment-file-validator></div></main>
    <a href="/page/payment-file-validator#payment-file-validator">Open validator</a>`);
  const root = page.locator("[data-payment-file-validator]");
  const grid = root.locator(".selection-grid");
  expect(await grid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(1);
  expect(await root.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("link", { name: "Open validator" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(dialog.getByRole("button", { name: "Close validator" })).toBeInViewport();
});

test("closing during a pending file read prevents later worker creation", async ({ page }) => {
  await installPackage(page, '<a href="/page/payment-file-validator#payment-file-validator?format=PAIN.001&version=pain.001.001.09">Open validator</a>');
  await page.getByRole("link", { name: "Open validator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(demoFile("pain.001.001.09-pass.xml"));
  const workersCreated = await dialog.evaluate(async (element) => {
    const OriginalWorker = window.Worker;
    const originalRead = File.prototype.arrayBuffer;
    const workers: Worker[] = [];
    window.Worker = class extends OriginalWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) { super(...args); workers.push(this); }
    };
    let finishRead!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>((resolve) => { finishRead = resolve; });
    File.prototype.arrayBuffer = () => pending;
    try {
      element.querySelector<HTMLButtonElement>('[id$="validate-file"]')!.click();
      element.querySelector<HTMLButtonElement>(".hnb-validator-close")!.click();
      finishRead(new ArrayBuffer(0));
      await pending;
      return workers.length;
    } finally {
      workers.forEach((worker) => worker.terminate());
      window.Worker = OriginalWorker;
      File.prototype.arrayBuffer = originalRead;
    }
  });
  expect(workersCreated).toBe(0);
  await expect(dialog).toHaveCount(0);
});
