# Developer handoff

## What to use

The source of truth is `src/`. The files in `readme-package/` are generated from it and `scripts/readme-templates/` and committed for developers who only need the ReadMe copy/paste deliverable. The former root-level package has moved into that directory. Do not edit generated artifacts directly.

Use Node.js 22.12 or newer and `npm ci` from the repository root. Run `npm run dev` for the standalone preview. `npm run validate:core` runs the non-browser release checks. `npm run validate` adds Playwright interaction tests; install Chromium, Firefox, and WebKit first with `npx playwright install`. On Linux, browser system dependencies may also be required (`npx playwright install --with-deps`).

## Code map

- `src/app.ts`: wizard UI and interaction flow.
- `src/main.ts` and `src/readme-entry.ts`: standalone and ReadMe entry points.
- `src/validation.worker.ts` and `src/worker-request.ts`: browser-local validation worker and input/failure boundary.
- `src/validation-failure.ts`: user-facing incomplete-run messages.
- `src/finding-locations.ts`, `src/source-coordinates.ts`, and `src/parsers/edi-source.ts`: run-scoped source mapping and canonical coordinates.
- `src/explorer-controller.ts`, `src/source-viewer.ts`, `src/explorer-budget.ts`, and `src/finding-navigation.ts`: dedicated-page explorer, read-only viewer, resource limits, and result synchronization. See [the explorer contract](FILE_EXPLORER.md).
- `scripts/generate-stress-files.mjs`: reproducible synthetic upload stress kit; see [processing limits](PROCESSING_LIMITS.md).
- `src/format-catalog.ts`: display catalog.
- `src/format-packs.ts`, `src/validation.ts`, and `src/parsers/`: executable demo profiles and validation rules.
- `src/file-policy.ts`, `src/outcome.ts`, `src/pagination.ts`, and `src/csv.ts`: file handling, result classification, paging, and export.
- `vite.readme.config.ts` and `scripts/finalize-readme-package.mjs`: self-contained bundle and scoped CSS generation.

## Deliver a change

1. Change source and relevant tests on a task branch.
2. Run proportionate tests during development and `npm run validate:core` before handoff. Run `npm run validate` as well when the browser environment is stable.
3. Commit the source changes and regenerated `readme-package/` together. `dist/`, dependencies, and test reports are intentionally excluded.
4. Follow [ReadMe installation](../readme-package/INSTALLATION.md), using an unpublished draft to verify integration before publication.

## Acceptance still required

The nine executable profiles are DEMO profiles. Other catalog entries are reference-only. Passing the checks does not establish bank acceptance, standards conformance, or payment readiness.

Review [accessibility follow-ups](ACCESSIBILITY_FOLLOW_UPS.md) before finalization. ReadMe staging verification, embedded Blob-worker compatibility under the portal CSP, coexistence with existing portal JavaScript, and manual accessibility checks remain required. [Design QA](design-qa.md) records historical findings; its temporary screenshots are not part of this repository.

Use synthetic files only in examples, tests, and public issues. Never commit customer payment files, credentials, local environment files, or private validation exports. No license has been added as part of this handoff; the repository owner must choose any intended reuse license.

## File explorer validation (2026-09-18)

The generated package now provides independent wizard-only and wizard-plus-explorer Custom Page snippets backed by one shared JavaScript/CSS bundle. The standalone preview provides the read-only source explorer; wizard-only, inline, and modal mounts remain compact unless the mount explicitly opts in. Validation completion is independent from optional location enrichment, and named limits provide deterministic excerpt or unavailable-location behavior.

The explorer finding view now keeps only Previous/Next finding navigation, presents Field/Path/Message in a responsive row, opens the primary mapped target, and uses red error or yellow warning source highlights. Search, go-to-line, related-location navigation, location explanations, and secondary focus/return actions have been removed without changing validation, location-sidecar, or CSV contracts.

`npm run validate:core` passed: 99 Vitest tests across 17 files, the generated stress-kit integrity test, TypeScript checking, the standalone production build, regenerated ReadMe package, and the static self-contained-package contract test. The generated JavaScript was 407.52 kB (130.55 kB gzip). Playwright and Firefox were not rerun after the owner reported repeated unexpected exits, so no browser, real ReadMe, zoom/reflow, or screen-reader acceptance is claimed by this handoff.

## Handoff validation (2026-09-17)

A clean `npm ci` completed with zero reported dependency vulnerabilities. All 32 unit tests across eight files passed. TypeScript checking, the standalone production build, and ReadMe package generation passed. The browser suite could not complete because test browser processes failed to launch under the local macOS sandbox; no browser pass is claimed. Browser testing was stopped after the owner reported unexpected browser exits. Hosted ReadMe and manual accessibility acceptance remain outstanding.

## Guide component and modal validation (2026-09-17)

The package now includes an inline MDX wrapper, format/version presets, optional selection locking, and same-origin link-triggered native dialogs. The existing dedicated-page mount remains supported. Each new instance has unique control IDs and independent state. Closing invalidates pending file reads, terminates active workers, and clears file/results state.

Validation: 32 unit tests passed; TypeScript, standalone build, and regenerated ReadMe package passed. The isolated browser suite passed 54 checks and exposed three copies of a cancellation-test failure (one per browser). After correcting cancellation and making active-worker testing deterministic, all 24 affected browser checks passed across Chromium, Firefox, and WebKit, including the new pending-read regression. Unaffected browser checks were not repeated. ReadMe-hosted integration and the previously documented manual accessibility acceptance remain outstanding.

Playwright no longer reuses an arbitrary existing server. If port 4173 is occupied, use an unused port, for example `PW_TEST_PORT=4187 npm run test:e2e`. The test server uses strict port binding so evidence comes from this checkout.
