import "./styles.css";
import { mountPaymentFileValidator, type ValidatorOptions } from "./app";

const selector = "#hnb-payment-file-validator, [data-payment-file-validator]";
const mounts = new Map<HTMLDivElement, () => void>();
let sequence = 0;
let closeModal: (() => void) | null = null;

function fragmentOptions(hash: string): ValidatorOptions | null {
  const [name, query = ""] = hash.slice(1).split("?");
  if (name !== "payment-file-validator") return null;
  const params = new URLSearchParams(query);
  return {
    format: params.get("format") ?? undefined,
    version: params.get("version") ?? undefined,
    lockSelection: params.get("lockSelection") === "true",
  };
}

function synchronizeMounts(): void {
  for (const [root, unmount] of mounts) {
    if (!root.isConnected) {
      unmount();
      mounts.delete(root);
    }
  }
  for (const root of document.querySelectorAll<HTMLDivElement>(selector)) {
    if (mounts.has(root) || root.dataset.validatorMounted === "true") continue;
    const legacy = root.id === "hnb-payment-file-validator";
    const options = legacy ? fragmentOptions(location.hash) : null;
    mounts.set(root, mountPaymentFileValidator(root, {
      format: root.dataset.format,
      version: root.dataset.version,
      lockSelection: root.dataset.lockSelection === "true",
      ...options,
      idPrefix: legacy ? "" : `hnb-validator-${++sequence}-`,
      enableExplorer: legacy,
    }));
  }
}

function openModal(options: ValidatorOptions, trigger: HTMLElement): void {
  closeModal?.();
  const dialog = document.createElement("dialog");
  dialog.className = "hnb-validator-dialog";
  dialog.setAttribute("aria-label", "Payment File Validation Wizard");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "hnb-validator-close";
  close.textContent = "Close validator";
  const root = document.createElement("div");
  root.setAttribute("data-payment-file-validator", "");
  dialog.append(close, root);
  document.body.append(dialog);
  const unmount = mountPaymentFileValidator(root, { ...options, idPrefix: `hnb-validator-${++sequence}-` });
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    unmount();
    dialog.remove();
    document.body.style.overflow = previousOverflow;
    closeModal = null;
    if (trigger.isConnected) trigger.focus();
  };
  closeModal = cleanup;
  close.addEventListener("click", cleanup);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); cleanup(); });
  dialog.addEventListener("close", cleanup);
  dialog.showModal();
  close.focus();
}

window.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || !["http:", "https:"].includes(url.protocol)) return;
  const options = fragmentOptions(url.hash);
  if (!options || typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal) return;
  event.preventDefault();
  // ReadMe handles internal links through its client-side router. Capture this
  // reserved trigger before the router sees it, otherwise it navigates to the
  // Custom Page instead of opening the validator over the current Guide.
  event.stopImmediatePropagation();
  openModal(options, anchor);
}, { capture: true });

// Release file state when ReadMe navigates without a full page reload.
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    closeModal?.();
  }
  synchronizeMounts();
});
window.addEventListener("popstate", () => closeModal?.());
window.addEventListener("hashchange", () => closeModal?.());
window.addEventListener("pagehide", () => {
  closeModal?.();
  for (const unmount of mounts.values()) unmount();
  mounts.clear();
});
window.addEventListener("pageshow", synchronizeMounts);
synchronizeMounts();
observer.observe(document.documentElement, { childList: true, subtree: true });
