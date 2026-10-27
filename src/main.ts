import "./styles.css";
import { mountPaymentFileValidator } from "./app";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root is missing.");

mountPaymentFileValidator(app, { enableExplorer: true });

const ciNegativeCanary: number = "intentional type error";
