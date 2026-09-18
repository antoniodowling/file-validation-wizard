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

## Current acceptance checklist

This is a demo implementation with nine executable profiles; other catalog entries are reference-only. Passing local checks does not establish bank acceptance, standards conformance, production approval, or WCAG conformance.

| Check | Current evidence | Responsible role / next action |
| --- | --- | --- |
| Core validation | 2026-09-18: 102 unit tests, stress-file integrity, TypeScript, standalone build, ReadMe build, and static package contract passed. Local runtime: Node 26.5.0 / npm 11.17.0. | Front-end developer: run `npm run validate:core` after relevant changes. |
| Generated artifacts | Regeneration matched checked-in `readme-package/`; `npm run check:readme-drift` passed. | Front-end developer: commit generated changes with source changes. |
| Browser interactions | 2026-09-18: the full run passed 81/87 cases and exposed two issues per browser. After updating the host-landmark assertion and isolating the layout defect, the focused follow-up passed 9 ordinary cases and confirmed 3 expected layout failures. Together these cover all 90 current cases (87 ordinary passes, 3 expected failures); the unchanged full suite was not repeated. | Front-end developer: run `npm run test:e2e`. |
| Automated accessibility | Expanded scans cover Upload, invalid-extension errors, PASS, PASS WITH WARNINGS, FAIL, malformed XML, and worker-startup failure. Full axe reports are attached to browser results. | Front-end developer: address any new violations. Only A11Y-001 warning controls/chips have a documented contrast allowance; a green test is not accessibility conformance. |
| Known layout defect | HANDOFF-UI-001: format controls misalign by about 18–20 pixels when the format label wraps in the narrow explorer pane. A dedicated expected-failure browser test preserves this finding. | Front-end developer: fix in the separately scoped CSS pass, then remove the expected-failure annotation. |
| Known accessibility defects | Warning contrast (A11Y-001) and format-list reflow (A11Y-003) remain open. | Front-end developer: fix and verify before finalization; see [accessibility follow-ups](ACCESSIBILITY_FOLLOW_UPS.md). |
| Actual ReadMe integration | Not verified. No staging URL has been supplied for this checkout. Local package tests simulate host mounts and routing but do not establish portal compatibility. | Portal maintainer: supply an unpublished staging URL and verify the checklist below. |
| Manual accessibility | Screen-reader, actual 200% browser zoom, complete 320px workflow, and explorer keyboard acceptance remain unverified. | Accessibility tester: complete the outstanding checks in the follow-up log. |
| Production profiles | Not approved; demo limits remain in effect. | API/Product owners: supply approved rules, fixtures, guides, and required sign-offs before enabling production profiles. |

Role assignments above identify responsibilities; they do not imply a named person has accepted ownership. Historical run counts and temporary screenshot references are not current acceptance evidence. [Design QA](design-qa.md) is historical context only.

## Automated checks

`.nvmrc` selects Node 22.12.0, the minimum supported runtime, and `package.json` declares Node >=22.12.0. With nvm installed, run `nvm use` before `npm ci`. The GitHub Actions workflow uses `.nvmrc`, installs locked dependencies, runs core checks, checks generated drift, and runs Chromium, Firefox, and WebKit serially. Browser reports and axe attachments are retained for 14 days. Remote CI execution remains unverified until this branch is pushed and the workflow runs.

`npm run check:readme-drift` checks tracked and untracked files under `readme-package/` against the Git checkpoint. Run it **after regeneration**; it intentionally fails until changed generated artifacts are committed. It does not regenerate files itself.

Playwright starts its own strict-port server. If port 4173 is occupied, use an unused port, for example `PW_TEST_PORT=4287 npm run test:e2e`. Do not reuse another checkout's server. On sandboxed macOS, a Chromium Mach-port permission failure is a launch-environment failure; use an approved browser execution environment instead of changing application code.

## Hosted acceptance procedure

Use only synthetic fixtures and an unpublished staging portal. Record the tested commit, generated bundle SHA-256, staging URL, date, browser/version, and pass/fail evidence for each item. Follow [ReadMe installation](../readme-package/INSTALLATION.md); preserve existing portal customization.

- Verify wizard-only and explorer pages independently, including PASS, PASS WITH WARNINGS, FAIL, malformed XML, file replacement, and CSV download.
- Confirm the embedded Blob worker runs under the actual portal CSP. Inspect console and network evidence; confirm validation does not send the selected file to a remote service.
- Exercise finding-to-source navigation, read-only source, Previous/Next finding, hide/show, and expand/restore.
- Test inline instances and modal triggers with the existing portal JavaScript enabled. Check focus containment, Escape, focus restoration, fresh state after reopening, and route changes/back/forward.
- Check host heading structure, 320 CSS pixels, actual 200% browser zoom, and keyboard/screen-reader behavior. Record known failures rather than interpreting a local test pass as hosted acceptance.

If CSP blocks the worker, record the failure and agree a deployment approach before adding hosted assets. No production publication is part of this checklist.

## Data and ownership

Use synthetic files only in examples, tests, and issues. Never commit customer payment files, credentials, local environment files, or private validation exports. No license has been selected; the repository owner must choose any intended reuse license.
