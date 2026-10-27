# File Format Validation Wizard: developer handoff

Updated 2026-10-14. This guide covers the current code, profiles, and developer workflow. Historical test results apply to their recorded checkpoints. Actual ReadMe integration, manual accessibility, standards conformance, and production approval still need separate verification.

## What to use

Edit application code in `src/` and ReadMe templates in `scripts/readme-templates/`. `npm run build:readme` generates the six checked-in files in `readme-package/` for copy/paste installation in the ReadMe portal. Do not edit generated files directly. The package is separate from the repository's `README.md`.

Use Node.js 22.12 or newer and run `npm ci` from the repository root. `npm run dev` starts the standalone preview. `npm run validate:core` runs unit tests, stress-file integrity, TypeScript, both builds, and static package checks. `npm run validate` also runs Playwright tests; install Chromium, Firefox, and WebKit first with `npx playwright install`. On Linux, use `npx playwright install --with-deps` if system dependencies are missing.

## Code map

- `src/app.ts`: wizard UI and interaction flow.
- `src/main.ts` and `src/readme-entry.ts`: standalone and ReadMe entry points.
- `src/validation.worker.ts` and `src/worker-request.ts`: browser-local validation worker, input checks, and failure handling.
- `src/validation-failure.ts`: user-facing incomplete-run messages.
- `src/finding-locations.ts`, `src/source-coordinates.ts`, and `src/parsers/edi-source.ts`: finding locations and source coordinates for each run.
- `src/explorer-controller.ts`, `src/source-viewer.ts`, `src/explorer-budget.ts`, and `src/finding-navigation.ts`: dedicated-page explorer, read-only viewer, resource limits, and result synchronization. See [the explorer contract](FILE_EXPLORER.md).
- `scripts/generate-stress-files.mjs`: reproducible synthetic upload stress kit; see [processing limits](PROCESSING_LIMITS.md).
- `src/format-catalog.ts`: display catalog.
- `src/format-packs.ts`, `src/validation.ts`, and `src/parsers/`: executable DEMO and CANDIDATE profiles, parsers, and validation rules.
- `src/file-policy.ts`, `src/outcome.ts`, `src/pagination.ts`, and `src/csv.ts`: file handling, result classification, paging, and export.
- `vite.readme.config.ts` and `scripts/finalize-readme-package.mjs`: self-contained bundle and scoped CSS generation.

## Deliver a change

1. Work on a task branch and change the source or documentation relevant to the task.
2. For application changes, run focused tests during development and `npm run validate:core` before handoff. Run browser tests when interaction or rendering changes. For documentation-only changes, check links, commands, profile names, and examples against the current source and manifests. GitHub Actions runs the full existing checks for every PR.
3. Regenerate `readme-package/` when source or template changes affect it, and commit those outputs with the change. Keep `dist/`, dependencies, and test reports out of Git.
4. For portal changes, follow [ReadMe installation](../readme-package/INSTALLATION.md) and verify the package in an unpublished draft before publishing it.

## Current scope and acceptance

The catalog has nine format families and seventeen executable profiles: nine ISO/X12 DEMO profiles, six ACH CANDIDATE profiles, one BAI2 CANDIDATE profile and one CSV Wire CANDIDATE profile. PAIN.001, PAIN.008, and EDI 820 each offer three versions. The candidate profiles are:

| Format | Version ID (for presets) | Scope |
| --- | --- | --- |
| NACHA | `origination-public-2026` | [Original public specification profile](NACHA_SOURCE_REVIEW.md), retained for regression comparisons |
| NACHA | `origination-expanded-public-2026-r1` | [Expanded entry types](ACH_ORIGINATION_EXPANDED.md), retained alongside r2 |
| NACHA | `origination-expanded-public-2026-r2` | [Latest origination candidate](ACH_ORIGINATION_R2.md), including declared healthcare checks |
| ACH Returns | `returns-network-public-2026-r1` | [Ordinary network Returns/COR](ACH_RETURNS_CANDIDATE.md); specialized layouts remain gated |
| ACH Control Totals | `control-total-public-2026-r1` | [One standalone 58-column record](HUNTINGTON_CONTROL_TOTAL_CANDIDATE.md); no companion-file matching |
| File Received ACK | `pipe-1.0-candidate-r1` | [One pipe-delimited scenario](HUNTINGTON_ACK_CANDIDATE.md); reported disposition is separate from format validity |
| BAI2 | `huntington-bai2-public-2026-r1` | [Huntington-guide candidate scope](BAI2_SOURCE_SCOPE.md); multiple groups/accounts, continuations, exact controls; unqualified funds/currency/code scenarios receive no verdict |
| CSV Wire | `huntington-csv-wire-public-2026-r1` | [Guide-backed USD import candidate](CSV_WIRE_SOURCE_SCOPE.md); 54-field USWIRE and 58-field INT, US/CA OTHER beneficiaries; non-USD/IBAN/ambiguous intermediary SWIFT cases receive no verdict |

The four latest ACH candidates, BAI2 and CSV Wire use report/export schema 3; the original NACHA profile, r1, and ISO/X12 profiles retain schema 2. A valid ACK reporting REJECTED can pass format checks. Unsupported inputs receive no format verdict. See [coverage and export semantics](coverage/README.md).

No profile establishes full standards conformance, complete 2026 Operating Rules compliance, or production approval. The profile documents list implemented checks and exclusions.

| Area | Current state | Responsible role / next action |
| --- | --- | --- |
| Source CI baseline | [Run 38625110377](https://github.com/antoniodowling/file-validation-wizard/actions/runs/38625110377) passed for `d80db8bd65069665b2067d89bdd9f4523c9e6704`, merged in PR #26 as `fc33e67941f0e3ad1eaf75d9cd81fdaa6bc41851`. It ran core validation, generated drift, and all three browser projects. | Front-end developer: check CI for the exact head of each later change. |
| Automated accessibility and layout | Strict narrow-pane, reflow, focus, and axe checks are in the browser suite. Earlier warning-contrast and layout exceptions were removed. | Front-end developer: retain strict tests; see [resolved issues and remaining manual checks](ACCESSIBILITY_FOLLOW_UPS.md). |
| Full-source explorer | Schema-2 and schema-3 runs use parser-supplied locations. The editor and fallback display the full accepted source. | Front-end developer: preserve canonical UTF-16 coordinates, lifecycle cleanup, and legacy-report compatibility. |
| Actual ReadMe integration | Unverified. Local generated-mount tests simulate the portal, including presets and routing; they do not establish actual CSP or customization coexistence. | Portal maintainer: supply an unpublished staging mount and execute the hosted procedure below. |
| Manual accessibility | Screen-reader, actual 200% zoom, and complete manual workflow acceptance remain unverified. | Accessibility tester: complete the outstanding checks in the follow-up log. |
| Supported capacity | Byte, decoded-source, structure, and deadline guards exist; representative peak memory and recovery evidence remain deferred. | Performance maintainer: follow [processing limits](PROCESSING_LIMITS.md) before claiming a supported workload. |
| Standards and production approval | Deep ISO/X12 rules and the ACH/BAI2/CSV Wire profiles' declared exclusions remain outside the implemented checks. No profile has production sign-offs. | API/Product owners: use the current profile documents above for qualification gaps. The [earlier work handoff](REVIEW_FOLLOW_UP_HANDOFF.md) and [ACH phase gates](ACH_EXPANSION_SOURCES.md) retain planning history. |

Roles identify responsibilities, not an assigned successor or approval. Passing local checks does not establish hosted compatibility, bank acceptance, full standards conformance, production approval, or WCAG conformance.

## Demo and test files

Use the [README starter set](../README.md#starter-demos) for a manual walkthrough. It lists exact browser selections and expected results for small XML, EDI, ACH, BAI2 and CSV Wire examples.

The larger kits are regression fixtures: [original NACHA](../demo-files/nacha/README.md) has 69 files, [expanded r1](../demo-files/nacha-expanded/README.md) has 159, and [the latest four ACH candidates](../demo-files/ach-candidates/README.md) have 57. Six PAIN.001 XML files sit directly in `demo-files/`. Their expected results and hashes are preserved in tests and manifests. The [BAI2 kit](../demo-files/bai2/README.md) adds 21 synthetic fixtures and one preserved public guide sample, bound to [its separate coverage revision](coverage/bai2-candidate-1.0.0.json).

The [CSV Wire kit](../demo-files/csv-wire/README.md) adds 23 synthetic input fixtures and a manifest, bound to [its separate coverage revision](coverage/csv-wire-candidate-1.0.0.json). The discovered guide URL and functional extraction are preserved in [source scope](CSV_WIRE_SOURCE_SCOPE.md); no upstream semantic version is invented.

The [mixed-findings kit](../demo-files/mixed-findings/README.md) adds two synthetic upload examples: PAIN.001.001.09 and NACHA origination r2 each report one error plus one warning, with overall FAIL. Its separate manifest pins bytes, rules, profiles and derivation without changing existing fixture/coverage revisions.

The separate [14-file stress kit](../demo-files/hnb-validator-stress-files/README.md) exercises processing limits, encoding errors, and incomplete runs. Follow its instructions before running adversarial cases. Preserve every fixture, including malformed bytes, fixed-width spaces, line endings, and earlier profile expectations.

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

Use [IMPLEMENTATION_EVIDENCE.md](IMPLEMENTATION_EVIDENCE.md) for hardening history and [coverage/README.md](coverage/README.md) for report semantics. Read the [earlier work handoff](REVIEW_FOLLOW_UP_HANDOFF.md) alongside the current profile documents; some of its planned ACH work now has executable candidates. The [September receipt](evidence/ruleset-2/receipt.json) records its original bundle hashes; do not overwrite it to represent later builds. Coverage exporters prepare named revisions and are not routine build steps. Rule changes that alter validation behavior require new revisions and snapshots; preserve published snapshots and fixture bytes.

The checked-in ReadMe package is self-contained. The nine ISO/X12 profiles remain DEMO and the six ACH profiles, the BAI2 profile and the CSV Wire profile remain CANDIDATE. Local results do not promote a profile to production. Obtain the required authoritative sources, independently approved fixtures, bank/workflow decisions, hosted verification, and sign-offs first.

## Maintenance tools and conventions

- `npm run typecheck` checks TypeScript without generating a bundle; `npm run build` includes it.
- `npm run generate:stress-files -- /private/tmp/hnb-stress-review`, `npm run generate:nacha-files -- /private/tmp/nacha-review`, and `npm run generate:nacha-expanded-files -- /private/tmp/nacha-expanded-review` produce disposable comparison kits. Preserve intentionally malformed bytes, fixed-width spaces, line endings, manifests, and historical expectations.
- `npm run generate:ach-candidate-files` rewrites `demo-files/ach-candidates/` and `docs/coverage/ach-candidates-1.0.0.json`. It has no output-directory argument; use a disposable repository copy for comparisons, and do not overwrite historical coverage during routine maintenance.
- `npm run export:coverage` and `npm run export:nacha-coverage` invoke the existing revision-preparation exporters. They write the named coverage snapshots; do not run them to silently revise published history.
- `node scripts/generate-bai2-files.mjs` regenerates synthetic BAI2 fixtures and their manifest, preserving the source sample. `node scripts/export-bai2-coverage.mjs` prepares only the named BAI2 coverage revision; do not use it to silently revise published coverage.
- `node scripts/generate-csv-wire-files.mjs` regenerates the CSV Wire synthetic kit and manifest; `node scripts/export-csv-wire-coverage.mjs` prepares its named coverage revision. Preserve published fixture/snapshot history when introducing later semantics.
- `.editorconfig` supplies basic editor conventions while excluding fixture bytes and generated artifacts from normalization. Markdown hard-break spaces are retained. There is no bulk formatting pass or new lint gate.
- Keep the legacy mapper in `src/finding-locations.ts` and its dependencies for older reports without parser-supplied locations. Current schema-2 and schema-3 runs use parser-supplied locations; see [report semantics](coverage/README.md).

## Earlier local engineering baseline

On 2026-10-14, checkpoint `9f52c59b5db66f922bf943a07ca49cc6b66a1015` passed 472 unit tests, stress integrity, TypeScript, both builds, the package contract, and 117 Chromium/Firefox/WebKit cases. All six regenerated ReadMe files matched that checkpoint byte for byte. Runtime: Node 26.5.0 / npm 11.17.0. Local narrow-pane, reflow, focus, and axe checks passed in that baseline. These results apply to that checkpoint, not later bundles.

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

Fast CI is the merge check when lean mode is active. Use the manually dispatched
Validate handoff workflow for complete release or handoff qualification.
