# ReadMe installation

This package supports two independent dedicated-page demos, inline Guide components, and link-triggered modals. It remains a browser-local demo with nine executable profiles; embedding does not change validation coverage or production approval status.

## Shared installation

1. Append `custom-css.css` to **Appearance → CSS, JS, HTML → Custom CSS**.
2. Append `custom-javascript.js` to **Appearance → CSS, JS, HTML → Custom JavaScript** once. When upgrading, replace the previous validator bundle and styles rather than adding a second copy. Preserve unrelated portal customization.
3. Test on unpublished pages before publishing. These instructions assume the portal enables Custom JavaScript and custom MDX components.

The bundle includes the worker, catalog, parsers, and rules. No validation backend or hosted validator assets are required if the portal permits Blob workers. Selected files are processed locally without application upload, analytics, or persistence. Use synthetic test files only. Portal scripts share the page context; this is not isolation from other portal code.

## Two independent dedicated-page demos

Install `custom-css.css` and `custom-javascript.js` only once. Both Custom Pages use that same shared JavaScript and CSS, so fixes and validation behavior come from one generated source.

Create two unpublished ReadMe Custom Pages in HTML mode:

| Demo | Paste this file | Suggested path |
| --- | --- | --- |
| Wizard only | `custom-page.html` | `/page/payment-file-validator` |
| Wizard + File Explorer | `custom-page-file-explorer.html` | `/page/payment-file-validator-file-explorer` |

Add a descriptive page heading above each snippet. The explorer page opts in through its generated `data-file-explorer="true"` mount attribute. Do not add that attribute to the wizard-only page. The explorer and its CodeMirror dependency are already bundled into the shared JavaScript; no separate editor script, CDN, or page-specific CSS is required.

Direct links can expose both demos independently:

```markdown
[Open the validator wizard](/page/payment-file-validator)

[Open the validator with File Explorer](/page/payment-file-validator-file-explorer)
```

Direct navigation to either page can read supported preset settings from the reserved fragment described below. Without the shared JavaScript, each page's JavaScript-required message is the fallback; validation itself requires JavaScript.

## Inline Guide component

Create a component in **Settings → Custom Components**, using `PaymentFileValidator.mdx`. Insert it from the editor's `<` menu or use:

```jsx
<PaymentFileValidator />

<PaymentFileValidator
  format="PAIN.001"
  version="pain.001.001.09"
  lockSelection
/>
```

The wrapper passes settings to the shared bundle. A supported version starts at Upload; users can review the selected format in step 1. `lockSelection` disables changing a recognized, executable preset. Unknown settings remain editable and cannot enable unsupported validation. Reference-only versions retain their existing unavailable state. Multiple inline instances keep independent file state and unique control IDs.

For an HTML mount instead of MDX, use:

```html
<div data-payment-file-validator data-format="PAIN.001" data-version="pain.001.001.09" data-lock-selection="true"></div>
```

## Modal links on portal pages

Use a normal link to the wizard-only page with the reserved fragment:

```markdown
[Validate your payment file](/page/payment-file-validator#payment-file-validator)

[Validate a PAIN.001 file](/page/payment-file-validator#payment-file-validator?format=PAIN.001&version=pain.001.001.09&lockSelection=true)
```

An ordinary click on a same-origin link with this fragment opens the compact wizard modal on any portal page that loads the shared bundle. The bundle intercepts the reserved fragment before ReadMe's client-side router; page authors need only add the link. This fragment is reserved for modal triggers regardless of the link's path, so point modal links at the wizard-only page for the matching fallback. Use the direct explorer link above when the full two-pane demo is intended.

Modified clicks, downloads, links targeting another window, and external-origin links retain normal browser behavior. Without modal support or the shared bundle, the link navigates normally. Links from email or another website navigate to the dedicated page; they cannot open a modal inside that other site.

Close or Escape stops active validation and clears selected files/results. Reopening starts fresh. The native dialog keeps keyboard focus inside it, restores focus to the trigger on close, and prevents interaction with background content. SPA navigation also dismisses it.

## Verification before publication

Check both actual ReadMe drafts independently: the wizard-only page must not render a File Explorer, while the explorer page must render the two-pane workspace and finding-to-source navigation. Also check narrow/mobile layouts, multiple inline instances, modal keyboard focus and Escape, page navigation/back/forward, presets, reference-only formats, file replacement, validation, and CSV downloads. Confirm synthetic PASS/FAIL results, Blob-worker compatibility, coexistence with existing Custom JavaScript, and no selected-file network upload. Local tests do not establish ReadMe-hosted compatibility. Existing accessibility follow-ups in `docs/ACCESSIBILITY_FOLLOW_UPS.md` remain applicable.

Generated files: edit `src/`, `scripts/finalize-readme-package.mjs`, or `scripts/readme-templates/`, then run `npm run build:readme`. Do not edit generated copies directly.
