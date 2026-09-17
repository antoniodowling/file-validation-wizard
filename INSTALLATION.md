# ReadMe installation

1. Create a ReadMe Custom Page in HTML mode and paste `custom-page.html` where the wizard should appear.
2. Add the page-level heading and explanatory content in ReadMe above the mount element. The host page must contain one descriptive `h1`; the embedded wizard intentionally does not create another.
3. Append `custom-css.css` to **Appearance → CSS, JS, HTML → Custom CSS**.
4. Append `custom-javascript.js` to **Appearance → CSS, JS, HTML → Custom JavaScript**.
5. Save the page as an unpublished draft and test format selection, upload, validation, pagination, and CSV export before publishing.

The JavaScript is safe to load site-wide: it mounts only when `#hnb-payment-file-validator` exists. The validation worker, catalog, parsers, and rules are embedded in the JavaScript bundle. No validator asset hosting or validation backend is required.

These files are generated. Make changes in `src/` and run `npm run build:readme` rather than editing the package directly.
