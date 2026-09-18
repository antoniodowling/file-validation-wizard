# Payment File Validator

A browser-local demo for exploring and validating common payment-file formats. Its format-first wizard provides:

- a searchable, frozen catalog of 50 legitimate payments and treasury format/message profiles;
- three relevant versions for each catalog entry;
- nine executable demo profiles covering PAIN.001, PAIN.008, and ASC X12 EDI 820; and
- reference-only metadata for every other catalog entry.

Demo results check a limited set of syntax and structure rules. They do not represent Product, SC, or FT approval and do not guarantee Huntington acceptance or payment readiness.

## Developer handoff

Start with [the developer guide](docs/DEVELOPER_HANDOFF.md). For copy/paste installation, use [readme-package/INSTALLATION.md](readme-package/INSTALLATION.md). This repository contains a demo, not an approved production validator.

| Path | Purpose |
| --- | --- |
| `src/` | Editable TypeScript source, styles, catalog, parsers, and rules |
| `readme-package/` | Generated, checked-in copy/paste deliverables for ReadMe |
| `demo-files/` | Synthetic XML samples for the browser workflow |
| `tests/` | Unit tests and Playwright browser tests |
| `scripts/` | ReadMe packaging post-processing |
| `docs/` | Handoff instructions, accessibility follow-ups, and historical design review |

## Local development

```sh
git clone https://github.com/antoniodowling/file-validation-wizard.git
cd file-validation-wizard
npm ci
npm run dev
```

Use `npm run validate` for unit tests, a production build, regeneration of the ReadMe package, and browser-level interaction tests. Install the test browsers first with `npx playwright install`. Use Node.js 22.12 or newer.

## Browser demo files

Select **PAIN.001**, choose version **pain.001.001.09**, and upload one of the synthetic files in `demo-files/` to inspect each result presentation:

- `pain.001.001.09-pass.xml` — PASS with no errors or warnings.
- `pain.001.001.09-pass-with-warnings.xml` — PASS WITH WARNINGS because the otherwise valid document omits the recommended XML declaration.
- `pain.001.001.09-fail.xml` — FAIL with one format/version error. Namespace mismatches stop validation before format-specific structural rules run.

## Catalog and validation profiles

Visual catalog metadata is defined in `src/format-catalog.ts`. Executable parser and rule metadata is defined separately in `src/format-packs.ts`. The current nine packs are explicitly marked `DEMO` and cannot claim release approvals.

To enable a production pack, provide its exact version identifiers, approved guide URL, approved rules and fixtures, and Product/SC/FT sign-offs. The registry fails closed when any of those production release gates are missing.

Selected files are read and validated in a Web Worker. The app has no backend, analytics, remote validation, history, or selected-file persistence.

## ReadMe package

Run `npm run build:readme` to generate the copy/paste artifacts in `readme-package/`:

- `custom-page.html` — the mount element for a ReadMe Custom Page in HTML mode;
- `custom-css.css` — portal-scoped styles for Appearance > Custom CSS; and
- `custom-javascript.js` — the site-wide guarded application bundle for Appearance > Custom JavaScript.

The JavaScript bundle includes the validation worker and requires no hosted validator assets or backend. Follow `readme-package/INSTALLATION.md` to install and test it in an unpublished ReadMe page.

## Pre-finalization to-do

- Resolve and verify the open WCAG 2.2 AA items in
  [`docs/ACCESSIBILITY_FOLLOW_UPS.md`](docs/ACCESSIBILITY_FOLLOW_UPS.md) before finalization.
- Verify the generated package in ReadMe staging, including Blob-worker compatibility and coexistence with the portal's existing Custom JavaScript.
- Document the smallest hosted-asset fallback only if ReadMe's content security policy blocks the embedded worker.
