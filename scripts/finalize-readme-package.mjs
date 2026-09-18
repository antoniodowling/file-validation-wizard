import { readFile, writeFile } from "node:fs/promises";
import postcss from "postcss";

const packageDirectory = new URL("../readme-package/", import.meta.url);
const cssPath = new URL("custom-css.css", packageDirectory);
const rootSelector = "#hnb-payment-file-validator";
const css = await readFile(cssPath, "utf8");
const stylesheet = postcss.parse(css);

function scopeSelector(selector) {
  const trimmed = selector.trim();
  if (trimmed === ":root" || trimmed === "html" || trimmed === "body") return rootSelector;
  return `${rootSelector} ${trimmed}`;
}

stylesheet.walkRules((rule) => {
  if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
  rule.selectors = rule.selectors.map(scopeSelector);
});

stylesheet.append({
  selector: rootSelector,
  nodes: [
    { prop: "min-width", value: "0" },
    { prop: "min-height", value: "0" },
    { prop: "margin", value: "0" },
  ],
});

await writeFile(cssPath, `${stylesheet.toString()}\n`, "utf8");
await writeFile(
  new URL("custom-page.html", packageDirectory),
  `<div id="hnb-payment-file-validator"></div>\n<noscript>JavaScript is required to use the Payment File Validation Wizard.</noscript>\n`,
  "utf8",
);
await writeFile(
  new URL("INSTALLATION.md", packageDirectory),
  `# ReadMe installation\n\n1. Create a ReadMe Custom Page in HTML mode and paste \`custom-page.html\` where the wizard should appear.\n2. Add the page-level heading and explanatory content in ReadMe above the mount element. The host page must contain one descriptive \`h1\`; the embedded wizard intentionally does not create another.\n3. Append \`custom-css.css\` to **Appearance → CSS, JS, HTML → Custom CSS**.\n4. Append \`custom-javascript.js\` to **Appearance → CSS, JS, HTML → Custom JavaScript**.\n5. Save the page as an unpublished draft and test format selection, upload, validation, pagination, and CSV export before publishing.\n\nThe JavaScript is safe to load site-wide: it mounts only when \`#hnb-payment-file-validator\` exists. The validation worker, catalog, parsers, and rules are embedded in the JavaScript bundle. No validator asset hosting or validation backend is required.\n\nThese files are generated. Make changes in \`src/\` and run \`npm run build:readme\` rather than editing the package directly.\n`,
  "utf8",
);
