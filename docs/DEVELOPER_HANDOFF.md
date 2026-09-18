# Developer handoff

## What to use

The source of truth is `src/`. The files in `readme-package/` are generated from it and `scripts/readme-templates/` and committed for developers who only need the ReadMe copy/paste deliverable. The former root-level package has moved into that directory. Do not edit generated artifacts directly.

Use Node.js 22.12 or newer and `npm ci` from the repository root. Run `npm run dev` for the standalone preview. Run `npx playwright install` once to install Chromium, Firefox, and WebKit, then `npm run validate` to run the unit tests, type check, standalone build, ReadMe build, and browser tests. On Linux, browser system dependencies may also be required (`npx playwright install --with-deps`).

## Code map

- `src/app.ts`: wizard UI and interaction flow.
- `src/main.ts` and `src/readme-entry.ts`: standalone and ReadMe entry points.
- `src/validation.worker.ts`: browser-local validation worker.
- `src/format-catalog.ts`: display catalog.
- `src/format-packs.ts`, `src/validation.ts`, and `src/parsers/`: executable demo profiles and validation rules.
- `src/file-policy.ts`, `src/outcome.ts`, `src/pagination.ts`, and `src/csv.ts`: file handling, result classification, paging, and export.
- `vite.readme.config.ts` and `scripts/finalize-readme-package.mjs`: self-contained bundle and scoped CSS generation.

## Deliver a change

1. Change source and relevant tests on a task branch.
2. Run proportionate tests during development and `npm run validate` before handoff.
3. Commit the source changes and regenerated `readme-package/` together. `dist/`, dependencies, and test reports are intentionally excluded.
4. Follow [ReadMe installation](../readme-package/INSTALLATION.md), using an unpublished draft to verify integration before publication.

## Acceptance still required

The nine executable profiles are DEMO profiles. Other catalog entries are reference-only. Passing the checks does not establish bank acceptance, standards conformance, or payment readiness.

Review [accessibility follow-ups](ACCESSIBILITY_FOLLOW_UPS.md) before finalization. ReadMe staging verification, embedded Blob-worker compatibility under the portal CSP, coexistence with existing portal JavaScript, and manual accessibility checks remain required. [Design QA](design-qa.md) records historical findings; its temporary screenshots are not part of this repository.

Use synthetic files only in examples, tests, and public issues. Never commit customer payment files, credentials, local environment files, or private validation exports. No license has been added as part of this handoff; the repository owner must choose any intended reuse license.

## Handoff validation (2026-09-17)

A clean `npm ci` completed with zero reported dependency vulnerabilities. All 32 unit tests across eight files passed. TypeScript checking, the standalone production build, and ReadMe package generation passed. The browser suite could not complete because test browser processes failed to launch under the local macOS sandbox; no browser pass is claimed. Browser testing was stopped after the owner reported unexpected browser exits. Hosted ReadMe and manual accessibility acceptance remain outstanding.

## Guide component and modal validation (2026-09-17)

The package now includes an inline MDX wrapper, format/version presets, optional selection locking, and same-origin link-triggered native dialogs. The existing dedicated-page mount remains supported. Each new instance has unique control IDs and independent state. Closing invalidates pending file reads, terminates active workers, and clears file/results state.

Validation: 32 unit tests passed; TypeScript, standalone build, and regenerated ReadMe package passed. The isolated browser suite passed 54 checks and exposed three copies of a cancellation-test failure (one per browser). After correcting cancellation and making active-worker testing deterministic, all 24 affected browser checks passed across Chromium, Firefox, and WebKit, including the new pending-read regression. Unaffected browser checks were not repeated. ReadMe-hosted integration and the previously documented manual accessibility acceptance remain outstanding.

Playwright no longer reuses an arbitrary existing server. If port 4173 is occupied, use an unused port, for example `PW_TEST_PORT=4187 npm run test:e2e`. The test server uses strict port binding so evidence comes from this checkout.
