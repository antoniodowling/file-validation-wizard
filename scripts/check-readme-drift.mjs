import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run after build:readme (also included in validate:core). Include untracked
// files so newly generated artifacts cannot silently escape the check.
const status = execFileSync("git", [
  "status", "--porcelain", "--untracked-files=all", "--", "readme-package/",
], { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
if (status.trim()) {
  console.error("ReadMe artifacts differ from the checkpoint. Regenerate and commit readme-package/ with the source change.");
  console.error(status);
  process.exitCode = 1;
} else {
  console.log("ReadMe artifacts match the checkpoint.");
}
