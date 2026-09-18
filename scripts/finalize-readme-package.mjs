import { readFile, writeFile } from "node:fs/promises";
import postcss from "postcss";

const packageDirectory = new URL("../readme-package/", import.meta.url);
const cssPath = new URL("custom-css.css", packageDirectory);
const javascriptPath = new URL("custom-javascript.js", packageDirectory);
const rootSelector = ":is(#hnb-payment-file-validator, [data-payment-file-validator])";
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

await writeFile(cssPath, `${stylesheet.toString()}\n${await readFile(new URL("./readme-templates/modal.css", import.meta.url), "utf8")}`, "utf8");
const javascript = await readFile(javascriptPath, "utf8");
await writeFile(
  javascriptPath,
  javascript
    .replaceAll("<!DOCTYPE", "\\x3c!DOCTYPE")
    .replaceAll("<!ENTITY", "\\x3c!ENTITY"),
  "utf8",
);
await writeFile(
  new URL("custom-page.html", packageDirectory),
  `<div id="hnb-payment-file-validator"><p>JavaScript is required to use the Payment File Validation Wizard.</p></div>\n<noscript>JavaScript is required to use the Payment File Validation Wizard.</noscript>\n`,
  "utf8",
);
await writeFile(
  new URL("custom-page-file-explorer.html", packageDirectory),
  `<div id="hnb-payment-file-validator-file-explorer" data-payment-file-validator data-file-explorer="true"><p>JavaScript is required to use the Payment File Validation Wizard with File Explorer.</p></div>\n<noscript>JavaScript is required to use the Payment File Validation Wizard with File Explorer.</noscript>\n`,
  "utf8",
);
for (const name of ["INSTALLATION.md", "PaymentFileValidator.mdx"]) {
  await writeFile(new URL(name, packageDirectory), await readFile(new URL(`./readme-templates/${name}`, import.meta.url), "utf8"));
}
