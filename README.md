# Payment File Validator

A browser-local demo for exploring and validating common payment-file formats. Its format-first wizard provides:

- a focused catalog of PAIN.001, PAIN.008, ASC X12 EDI 820, NACHA origination, ACH Returns, Huntington control totals, and File Received ACK;
- nine existing ISO/X12 profiles, with three versions per format;
- six ACH candidates across four format families, including three preserved/current origination revisions for CCD, PPD, CTX, WEB, and TEL; and
- a dedicated-page, read-only file explorer that links current findings to exact source, honest context, or an explicit unavailable state.

Demo results check a limited set of syntax and structure rules. They do not represent Product, SC, or FT approval and do not guarantee ABC Bank acceptance or payment readiness.

## Developer handoff

Start with [the developer guide](docs/DEVELOPER_HANDOFF.md). For copy/paste installation, use [readme-package/INSTALLATION.md](readme-package/INSTALLATION.md). This repository contains a demo, not an approved production validator.

| Path | Purpose |
| --- | --- |
| `src/` | Editable TypeScript source, styles, catalog, parsers, and rules |
| `readme-package/` | Generated, checked-in copy/paste deliverables for ReadMe |
| `demo-files/` | Synthetic XML, NACHA, and XML/EDI stress uploads with versioned manifests |
| `tests/` | Unit tests and Playwright browser tests |
| `scripts/` | ReadMe packaging, fixture generation, build provenance, and coverage exports |
| `docs/` | Handoff instructions, file-explorer contract, accessibility follow-ups, and historical design review |

## Local development

```sh
git clone https://github.com/antoniodowling/file-validation-wizard.git
cd file-validation-wizard
npm ci
npm run dev
```

Use `npm run validate:core` for unit tests, stress-kit integrity, a production build, ReadMe-package regeneration, and static package checks without browser automation. `npm run validate` adds browser-level interaction tests; install those browsers first with `npx playwright install`. Use Node.js 22.12 or newer (`nvm use` selects the version in `.nvmrc`). GitHub Actions runs core checks, generated-package drift detection, and all three browser projects. After regenerating and committing the ReadMe package, `npm run check:readme-drift` verifies it matches the checkpoint.

## Browser demo files

Select **PAIN.001**, choose version **pain.001.001.09**, and upload one of the synthetic files in `demo-files/` to inspect each result presentation:

- `pain.001.001.09-pass.xml` — PASS with no errors or warnings.
- `pain.001.001.09-pass-with-warnings.xml` — PASS WITH WARNINGS because the otherwise valid document omits the recommended XML declaration.
- `pain.001.001.09-fail.xml` — FAIL with one format/version error. Namespace mismatches stop validation before format-specific structural rules run.
- `pain.001.001.09-syntax-error.xml` — FAIL with the correct PAIN.001.001.09 namespace but an unclosed `PmtInf` element, exercising malformed-XML handling and parser-position navigation.
- `pain.001.001.09-multiple-errors.xml` — realistic-looking synthetic payment data with the correct namespace, a mistyped message-container name, a blank message ID, and a nonnumeric group transaction count. It produces one message-container error. Descendant checks and the dependent declaration advisory are not evaluated until that prerequisite is valid; the unchanged fixture preserves earlier report history.
- `pain.001.001.09-multiple-errors-resolved.xml` — corrected companion containing the same synthetic payment data with the message container and scalar fields corrected and the XML declaration present; it passes the current DEMO checks.

## Catalog and validation profiles

Visual catalog metadata is defined in `src/format-catalog.ts`. Executable parser and rule metadata is defined separately in `src/format-packs.ts`. The nine ISO/X12 packs retain their existing `DEMO` approval status and validation behavior. The six enabled ACH profiles are `CANDIDATE` revisions based on public specifications and declared scenarios. They include three origination revisions plus ordinary Returns/COR, standalone control totals and the single-scenario ACK. None is an approved production pack or a complete 2026 Operating Rules implementation. Other catalog placeholders have been removed.

Select **NACHA**, then **Public specification profile (2026 review)**. Supported ordinary monetary transaction codes are 22, 27, 32, 37, and 52. Files may combine the five supported SEC codes in separate batches. Both balanced and unbalanced files are accepted when their controls reconcile. LF, CRLF, CR, and concatenated 94-character records are supported. See [NACHA sources and validation scope](docs/NACHA_SOURCE_REVIEW.md) and the [synthetic NACHA fixture kit](demo-files/nacha/README.md).

To enable a production pack, provide its exact version identifiers, approved guide URL, approved rules and fixtures, and Product/SC/FT sign-offs. The registry fails closed when any of those production release gates are missing.

Selected files are read and validated in a Web Worker. The app has no backend, analytics, remote validation, history, or selected-file persistence.

## ReadMe package

Run `npm run build:readme` to generate the copy/paste artifacts in `readme-package/`:

- `custom-page.html` — the wizard-only ReadMe Custom Page mount;
- `custom-page-file-explorer.html` — the independent wizard-plus-File-Explorer Custom Page mount;
- `custom-css.css` — portal-scoped styles for Appearance > Custom CSS; and
- `PaymentFileValidator.mdx` — a reusable inline Guide component with optional format/version presets;
- `custom-javascript.js` — the site-wide guarded application bundle for Appearance > Custom JavaScript.

Error and warning rows show a one-based **Line** number or range in both dedicated demos and compact mounts. Missing-field findings identify **Context** lines; whole-file and unmappable findings are labeled explicitly. The line refers to the primary source target, which the explorer opens. Related targets may remain in report metadata; the explorer does not provide secondary-target navigation.

The same shared JavaScript and CSS support both dedicated demos, inline Guide components, and link-triggered modals. The explorer page opts in explicitly; the wizard-only page, inline instances, and modal instances keep the compact workflow. See the installation guide for page creation and linking details.

The JavaScript bundle includes the validation worker and requires no hosted validator assets or backend. Follow `readme-package/INSTALLATION.md` to install and test it in an unpublished ReadMe page.

## Processing safeguards and test uploads

The worker independently enforces the 25 MB limit. Runs have a provisional 10-second deadline and distinguish incomplete execution from a completed file FAIL. The ready-to-use files are in [demo-files/hnb-validator-stress-files/](demo-files/hnb-validator-stress-files/README.md); see [processing limits and the synthetic upload kit](docs/PROCESSING_LIMITS.md) for behavior, reproducible files, and remaining browser acceptance.

See [the file explorer implementation](docs/FILE_EXPLORER.md) for coordinate semantics, location quality, full-source browsing, the legacy index budget, and the hosted acceptance boundary.

## Pre-finalization to-do

- Complete the remaining manual and hosted WCAG 2.2 AA checks in
  [`docs/ACCESSIBILITY_FOLLOW_UPS.md`](docs/ACCESSIBILITY_FOLLOW_UPS.md) before finalization.
- Verify the generated package in ReadMe staging, including Blob-worker compatibility and coexistence with the portal's existing Custom JavaScript.
- Document the smallest hosted-asset fallback only if ReadMe's content security policy blocks the embedded worker.

Ruleset 2: [coverage and export semantics](docs/coverage/README.md), [implementation evidence and remaining gates](docs/IMPLEMENTATION_EVIDENCE.md), and [historical September bundle receipt](docs/evidence/ruleset-2/receipt.json). That receipt binds its original bundle, not later regenerated files. The nine ISO/X12 profiles remain DEMO; the preserved NACHA and new ACH candidates have separate coverage revisions.

Expanded origination is available as **Expanded entry types — public-source candidate (2026 r1)**. See [expanded source matrix and gates](docs/ACH_ORIGINATION_EXPANDED.md) and [new synthetic kit](demo-files/nacha-expanded/README.md). The earlier public profile remains executable; neither candidate is a fully qualified bank validator.

Four ACH format families now have executable candidates: [origination r2](docs/ACH_ORIGINATION_R2.md), [ordinary network Returns/COR](docs/ACH_RETURNS_CANDIDATE.md), [Huntington standalone control totals](docs/HUNTINGTON_CONTROL_TOTAL_CANDIDATE.md), and [Huntington single-scenario ACK](docs/HUNTINGTON_ACK_CANDIDATE.md). The ACK's reported disposition is separate from format validity: a valid REJECTED response can pass. New profiles export schema 3; historical profiles retain schema 2. [57 synthetic fixtures](demo-files/ach-candidates/README.md) and [version-bound coverage](docs/coverage/ach-candidates-1.0.0.json) document supported checks and remaining exclusions. These are source-based/candidate scenarios, with no bank acceptance or Production activation.
