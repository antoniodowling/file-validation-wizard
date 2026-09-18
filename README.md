# Payment File Validator

A browser-local demo for exploring and validating common payment-file formats. Its format-first wizard provides:

- a searchable, frozen catalog of 50 legitimate payments and treasury format/message profiles;
- three relevant versions for each catalog entry;
- nine executable demo profiles covering PAIN.001, PAIN.008, and ASC X12 EDI 820; and
- reference-only metadata for every other catalog entry; and
- a dedicated-page, read-only file explorer that links current findings to exact source, honest context, or an explicit unavailable state.

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
| `docs/` | Handoff instructions, file-explorer contract, accessibility follow-ups, and historical design review |

## Local development

```sh
git clone https://github.com/antoniodowling/file-validation-wizard.git
cd file-validation-wizard
npm ci
npm run dev
```

Use `npm run validate:core` for unit tests, stress-kit integrity, a production build, ReadMe-package regeneration, and static package checks without browser automation. `npm run validate` adds browser-level interaction tests; install those browsers first with `npx playwright install`. Use Node.js 22.12 or newer.

## Browser demo files

Select **PAIN.001**, choose version **pain.001.001.09**, and upload one of the synthetic files in `demo-files/` to inspect each result presentation:

- `pain.001.001.09-pass.xml` — PASS with no errors or warnings.
- `pain.001.001.09-pass-with-warnings.xml` — PASS WITH WARNINGS because the otherwise valid document omits the recommended XML declaration.
- `pain.001.001.09-fail.xml` — FAIL with one format/version error. Namespace mismatches stop validation before format-specific structural rules run.
- `pain.001.001.09-syntax-error.xml` — FAIL with the correct PAIN.001.001.09 namespace but an unclosed `PmtInf` element, exercising malformed-XML handling and parser-position navigation.
- `pain.001.001.09-multiple-errors.xml` — FAIL with the correct namespace and well-formed XML, producing five structural errors plus the missing-declaration warning for multi-finding explorer demonstrations.

## Catalog and validation profiles

Visual catalog metadata is defined in `src/format-catalog.ts`. Executable parser and rule metadata is defined separately in `src/format-packs.ts`. The current nine packs are explicitly marked `DEMO` and cannot claim release approvals.

To enable a production pack, provide its exact version identifiers, approved guide URL, approved rules and fixtures, and Product/SC/FT sign-offs. The registry fails closed when any of those production release gates are missing.

Selected files are read and validated in a Web Worker. The app has no backend, analytics, remote validation, history, or selected-file persistence.

## ReadMe package

Run `npm run build:readme` to generate the copy/paste artifacts in `readme-package/`:

- `custom-page.html` — the mount element for a ReadMe Custom Page in HTML mode;
- `custom-css.css` — portal-scoped styles for Appearance > Custom CSS; and
- `PaymentFileValidator.mdx` — a reusable inline Guide component with optional format/version presets;
- `custom-javascript.js` — the site-wide guarded application bundle for Appearance > Custom JavaScript.

The same engine supports a dedicated page, inline Guide components, and link-triggered modals. The source explorer is enabled only for the dedicated page; inline and modal instances keep the compact workflow. See the installation guide for ordinary Markdown links that open the modal while retaining a dedicated-page fallback.

The JavaScript bundle includes the validation worker and requires no hosted validator assets or backend. Follow `readme-package/INSTALLATION.md` to install and test it in an unpublished ReadMe page.

## Processing safeguards and test uploads

The worker independently enforces the 25 MB limit. Runs have a provisional 10-second deadline and distinguish incomplete execution from a completed file FAIL. The ready-to-use archive is [demo-files/hnb-validator-stress-files.zip](demo-files/hnb-validator-stress-files.zip); see [processing limits and the synthetic upload kit](docs/PROCESSING_LIMITS.md) for behavior, reproducible files, and remaining browser acceptance.

See [the file explorer implementation](docs/FILE_EXPLORER.md) for coordinate semantics, location quality, provisional viewer/index budgets, and the hosted acceptance boundary.

## Pre-finalization to-do

- Resolve and verify the open WCAG 2.2 AA items in
  [`docs/ACCESSIBILITY_FOLLOW_UPS.md`](docs/ACCESSIBILITY_FOLLOW_UPS.md) before finalization.
- Verify the generated package in ReadMe staging, including Blob-worker compatibility and coexistence with the portal's existing Custom JavaScript.
- Document the smallest hosted-asset fallback only if ReadMe's content security policy blocks the embedded worker.
