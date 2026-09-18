import "./styles.css";
import { mountPaymentFileValidator } from "./app";

const selector = "#hnb-payment-file-validator";
let mountedRoot: HTMLDivElement | null = null;
let unmount: (() => void) | null = null;

function synchronizeMount(): void {
  if (mountedRoot && !mountedRoot.isConnected) {
    unmount?.();
    mountedRoot = null;
    unmount = null;
  }

  const candidate = document.querySelector<HTMLDivElement>(selector);
  if (!candidate || candidate === mountedRoot || candidate.dataset.validatorMounted === "true") return;

  unmount?.();
  mountedRoot = candidate;
  unmount = mountPaymentFileValidator(candidate);
}

synchronizeMount();

const observer = new MutationObserver(synchronizeMount);
observer.observe(document.documentElement, { childList: true, subtree: true });
