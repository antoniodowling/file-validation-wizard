# ReadMe installation

This package supports a dedicated page, inline Guide components, and link-triggered modals. It remains a browser-local demo with nine executable profiles; embedding does not change validation coverage or production approval status.

## Shared installation

1. Append `custom-css.css` to **Appearance → CSS, JS, HTML → Custom CSS**.
2. Append `custom-javascript.js` to **Appearance → CSS, JS, HTML → Custom JavaScript** once. When upgrading, replace the previous validator bundle and styles rather than adding a second copy. Preserve unrelated portal customization.
3. Test on unpublished pages before publishing. These instructions assume the portal enables Custom JavaScript and custom MDX components.

The bundle includes the worker, catalog, parsers, and rules. No validation backend or hosted validator assets are required if the portal permits Blob workers. Selected files are processed locally without application upload, analytics, or persistence. Use synthetic test files only. Portal scripts share the page context; this is not isolation from other portal code.

## Dedicated page and link fallback

Create a ReadMe Custom Page in HTML mode and paste `custom-page.html`. Add a descriptive page heading above it. For the examples below, give it the path `/page/payment-file-validator` or substitute your actual page URL in every link. The package does not create or publish this page.

The read-only File explorer is enabled on this dedicated page only. It is bundled into the shared JavaScript and requires no separate editor asset or CDN. Inline Guide components and link-triggered modals intentionally keep the compact validator without the explorer.

Direct navigation to that page reads preset settings from its fragment. Without the shared JavaScript, the page's JavaScript-required message is the fallback; validation itself requires JavaScript.

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

Use a normal link to the dedicated page with the reserved fragment:

```markdown
[Validate your payment file](/page/payment-file-validator#payment-file-validator)

[Validate a PAIN.001 file](/page/payment-file-validator#payment-file-validator?format=PAIN.001&version=pain.001.001.09&lockSelection=true)
```

An ordinary click on a same-origin link with this fragment opens a modal on any portal page that loads the shared bundle. The bundle intercepts the reserved fragment before ReadMe's client-side router; page authors need only add the link. This fragment is reserved for validator triggers regardless of the link's path, so always point it at the real dedicated validator page for a useful fallback.

Modified clicks, downloads, links targeting another window, and external-origin links retain normal browser behavior. Without modal support or the shared bundle, the link navigates normally. Links from email or another website navigate to the dedicated page; they cannot open a modal inside that other site.

Close or Escape stops active validation and clears selected files/results. Reopening starts fresh. The native dialog keeps keyboard focus inside it, restores focus to the trigger on close, and prevents interaction with background content. SPA navigation also dismisses it.

## Verification before publication

Check the actual ReadMe draft for component rendering, narrow article layouts and mobile widths, the dedicated-page explorer, finding-to-source navigation, multiple inline instances, modal keyboard focus and Escape, page navigation/back/forward, presets, reference-only formats, file replacement, validation, and CSV downloads. Confirm a synthetic PASS/FAIL result and Blob-worker compatibility, coexistence with existing Custom JavaScript, and no selected-file network upload. Local tests do not establish ReadMe-hosted compatibility. Existing accessibility follow-ups in `docs/ACCESSIBILITY_FOLLOW_UPS.md` remain applicable.

Generated files: edit `src/`, `scripts/finalize-readme-package.mjs`, or `scripts/readme-templates/`, then run `npm run build:readme`. Do not edit generated copies directly.
