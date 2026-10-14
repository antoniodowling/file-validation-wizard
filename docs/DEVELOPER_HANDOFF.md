# Developer handoff

Updated for developer handover on 2026-10-14. This guide describes current local behavior. Historical receipts remain bound to their original checkpoints; hosted, manual, standards, and production acceptance remain separate gates.

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

## Current scope and acceptance

BAI2 is now an executable CANDIDATE with [source-defined scope and disclosed assumptions](BAI2_SOURCE_SCOPE.md), parser `src/parsers/bai2.ts`, [new coverage](coverage/bai2-candidate-1.0.0.json), [fixtures](../demo-files/bai2/README.md), unit tests and standalone/generated-mount browser tests. Nine ISO/X12 DEMO profiles and six ACH candidates remain preserved; BAI2 adds the seventh candidate. Hosted/standards/production acceptance remains separate. The historical baseline below predates these additions.

The catalog contains PAIN.001, PAIN.008, EDI 820, NACHA origination, Returns, control totals, ACK and BAI2. NACHA retains three origination candidates; Returns/control totals/ACK each have a declared executable candidate scenario. None establishes full standards compliance or production approval. See [original NACHA scope](NACHA_SOURCE_REVIEW.md), [expanded entry types](ACH_ORIGINATION_EXPANDED.md), [origination r2](ACH_ORIGINATION_R2.md) and [ACH candidates](ACH_EXPANSION_SOURCES.md).

| Area | Current state | Responsible role / next action |
| --- | --- | --- |
| Local engineering baseline | On 2026-10-14, checkpoint `9f52c59b5db66f922bf943a07ca49cc6b66a1015` passed 472 unit tests, stress integrity, TypeScript, both builds, the package contract, and 117 Chromium/Firefox/WebKit cases. All six regenerated ReadMe files matched that checkpoint byte for byte. Runtime: Node 26.5.0 / npm 11.17.0. | Front-end developer: run relevant checks after changes; this baseline does not certify later bundles. |
| Automated accessibility and layout | The earlier warning-contrast exception and layout expected-failure annotations were removed. Local narrow-pane, reflow, focus, and axe checks pass in that baseline. | Front-end developer: retain strict tests; see [resolved issues and remaining manual checks](ACCESSIBILITY_FOLLOW_UPS.md). |
| Full-source explorer | Current runs use parser-owned schema-2 locations. The editor and fallback display the full accepted source. Source-window controls were removed. | Front-end developer: preserve canonical UTF-16 coordinates, lifecycle cleanup, and legacy-report compatibility. |
| Actual ReadMe integration | Unverified. Local generated-mount tests simulate the portal, including presets and routing; they do not establish actual CSP or customization coexistence. | Portal maintainer: supply an unpublished staging mount and execute the hosted procedure below. |
| Manual accessibility | Screen-reader, actual 200% zoom, and complete manual workflow acceptance remain unverified. | Accessibility tester: complete the outstanding checks in the follow-up log. |
| Supported capacity | Byte, decoded-source, structure, and deadline guards exist; representative peak memory and recovery evidence remain deferred. | Performance maintainer: follow [processing limits](PROCESSING_LIMITS.md) before claiming a supported workload. |
| Standards and production approval | Deep ISO/X12 rules and scenarios beyond declared ACH/BAI2 candidate coverage remain unqualified. No profile has production sign-offs. | API/Product owners: follow the [remaining-work handoff](REVIEW_FOLLOW_UP_HANDOFF.md), [ACH gates](ACH_EXPANSION_SOURCES.md) and [BAI2 scope](BAI2_SOURCE_SCOPE.md). |

Roles identify responsibilities, not an assigned successor or approval. Passing local checks does not establish hosted compatibility, bank acceptance, full standards conformance, production approval, or WCAG conformance.

## Automated checks

`.nvmrc` selects Node 22.12.0, the minimum supported runtime, and `package.json` declares Node >=22.12.0. With nvm installed, run `nvm use` before `npm ci`. The GitHub Actions workflow uses `.nvmrc`, installs locked dependencies, runs core checks, checks generated drift, and runs Chromium, Firefox, and WebKit serially. Browser reports and axe attachments are retained for 14 days. Older PR #7 results are preserved in the historical section below; consult exact-head CI for future delivery.

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

## Evidence and revision maintenance

Use [IMPLEMENTATION_EVIDENCE.md](IMPLEMENTATION_EVIDENCE.md) for the hardening implementation history, [REVIEW_FOLLOW_UP_HANDOFF.md](REVIEW_FOLLOW_UP_HANDOFF.md) for its outstanding scopes, and [coverage/README.md](coverage/README.md) for report semantics. The [September receipt](evidence/ruleset-2/receipt.json) records its original exact bundle hashes; do not overwrite it to represent later builds. Coverage exporters are revision-preparation tools, not routine build steps. Future semantic changes require new revisions/files; preserve published snapshots and fixture bytes.

The checked-in ReadMe files are regenerated and remain self-contained. The nine ISO/X12 profiles remain DEMO and the two NACHA revisions remain CANDIDATE, with revision-bound production gates. Do not promote pain.001.001.09 or any X12 profile from these local results. Obtain the specifically listed authoritative artifacts, independent fixtures, bank/workflow decisions, hosted acceptance and sign-offs first.

## Maintenance tools and conventions

- `npm run typecheck` checks TypeScript without generating a bundle; `npm run build` includes it.
- `npm run generate:stress-files -- /private/tmp/hnb-stress-review`, `npm run generate:nacha-files -- /private/tmp/nacha-review`, and `npm run generate:nacha-expanded-files -- /private/tmp/nacha-expanded-review` produce disposable comparison kits. Preserve intentionally malformed bytes, fixed-width spaces, line endings, manifests, and historical expectations.
- `npm run export:coverage` and `npm run export:nacha-coverage` invoke the existing revision-preparation exporters. They write the named coverage snapshots; do not run them to silently revise published history.
- `.editorconfig` supplies basic editor conventions while excluding fixture bytes and generated artifacts from normalization. Markdown hard-break spaces are retained. There is no bulk formatting pass or new lint gate.
- Keep the legacy mapper in `src/finding-locations.ts` and its dependencies: [report semantics](coverage/README.md) intentionally retain compatibility for runs without schema-2 provenance. Current schema-2 runs use parser-supplied locations.

## Superseded handoff checklist

The following superseded text combines September validation results with the earlier single-candidate catalog description. It is retained as historical evidence, not current defect status.

The catalog contains PAIN.001, PAIN.008, EDI 820, and one executable NACHA public-specification candidate. The nine existing ISO/X12 profiles retain their limited validation and demo approval status. The NACHA candidate has no production sign-offs and does not establish full 2026 Operating Rules compliance. Other reference-only catalog placeholders have been removed. See [NACHA sources and validation scope](NACHA_SOURCE_REVIEW.md) and the [synthetic fixture kit](../demo-files/nacha/README.md). Passing local checks does not establish bank acceptance, standards conformance, production approval, or WCAG conformance.

| Check | Current evidence | Responsible role / next action |
| --- | --- | --- |
| Core validation | 2026-09-18: 102 unit tests, stress-file integrity, TypeScript, standalone build, ReadMe build, and static package contract passed. Local runtime: Node 26.5.0 / npm 11.17.0. | Front-end developer: run `npm run validate:core` after relevant changes. |
| Generated artifacts | Regeneration matched checked-in `readme-package/`; `npm run check:readme-drift` passed. | Front-end developer: commit generated changes with source changes. |
| Browser interactions | [Final PR CI](https://github.com/antoniodowling/file-validation-wizard/actions/runs/35379281626) passed on Linux with Node 22.12.0: all 90 cases accepted, including seven expected layout failures (83 ordinary passes). [PR #7](https://github.com/antoniodowling/file-validation-wizard/pull/7) merged as `440cd2a` on 2026-09-18. | Front-end developer: run `npm run test:e2e`; expected failures remain open defects, not acceptance. |
| Automated accessibility | Expanded scans cover Upload, invalid-extension errors, PASS, PASS WITH WARNINGS, FAIL, malformed XML, and worker-startup failure. Full axe reports are attached to browser results. | Front-end developer: address any new violations. Only A11Y-001 warning controls/chips have a documented contrast allowance; a green test is not accessibility conformance. |
| Known layout defect | HANDOFF-UI-001: format controls misalign by about 18–20 pixels when the format label wraps in the narrow explorer pane. A dedicated expected-failure browser test preserves this finding. | Front-end developer: fix in the separately scoped CSS pass, then remove the expected-failure annotation. |
| Linux narrow-layout defect | HANDOFF-UI-002: CI found 384px page width at a 375px viewport and inline overflow in Firefox/WebKit on Linux. Geometry assertions are expected failures only on those platform/browser combinations; other checks remain strict. Initial CI: [run 35378744374](https://github.com/antoniodowling/file-validation-wizard/actions/runs/35378744374). | Front-end developer: fix in the separately scoped CSS pass, then remove those expected-failure annotations. |
| Known accessibility defects | Warning contrast (A11Y-001) and format-list reflow (A11Y-003) remain open. | Front-end developer: fix and verify before finalization; see [accessibility follow-ups](ACCESSIBILITY_FOLLOW_UPS.md). |
| Actual ReadMe integration | Not verified. No staging URL has been supplied for this checkout. Local package tests simulate host mounts and routing but do not establish portal compatibility. | Portal maintainer: supply an unpublished staging URL and verify the checklist below. |
| Manual accessibility | Screen-reader, actual 200% browser zoom, complete 320px workflow, and explorer keyboard acceptance remain unverified. | Accessibility tester: complete the outstanding checks in the follow-up log. |
| Production profiles | Not approved; demo limits remain in effect. | API/Product owners: supply approved rules, fixtures, guides, and required sign-offs before enabling production profiles. |

Role assignments above identify responsibilities; they do not imply a named person has accepted ownership. Historical run counts and temporary screenshot references are not current acceptance evidence. [Design QA](design-qa.md) is historical context only.
