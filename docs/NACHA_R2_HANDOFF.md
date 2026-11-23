# Transfer the consolidated NACHA Origination ruleset

Use the exact source SHA recorded in the pull request for [issue #89](https://github.com/antoniodowling/file-validation-wizard/issues/89). The active validator ID is `nacha-origination-expanded-public-2026-r2` and the preset version is `origination-expanded-public-2026-r2`.

## Runtime files

| File | Transfer |
| --- | --- |
| `src/parsers/nacha.ts` | Copy the R2 parser. It keeps the existing `parseNacha(source, pack)` interface and evaluates 51 parser checks. |
| `src/nacha-origination-r2-coverage.ts` | Copy the consolidated coverage and exclusions for all 52 checks. |
| `src/format-packs.ts` | Apply the NACHA hunks to your registry. Replace the R2 declaration with the self-contained pack and its `nacha.non-empty-source` check. Remove the original pack and `EXPANDED_NACHA_PACK` from the definitions and registry. Keep your repository's other pack declarations and registrations. |
| `src/format-catalog.ts` | Apply the NACHA entry hunk to your catalog. Expose one option labeled **NACHA Origination** and map it to the existing R2 ID. Preserve your other catalog entries. |
| `src/coverage.ts` | Apply the NACHA coverage and provenance hunks. Route `NACHA_FIXED` to R2 and remove original/R1 imports and dispatch. |
| `src/types.ts` | Narrow `NachaVersionIdentifiers.profile` to the R2 literal. |
| `src/validation.ts` | Apply the NACHA admission guard for direct validation calls. The worker already looks up its requested ID through the enabled-pack registry. |
| `src/samples.ts` | If you expose built-in NACHA samples, route the `NACHA_FIXED` sample selection to the existing R2 pair. |
| `src/app.ts` | Apply the two NACHA help and results hunks as appropriate for your UI. Use the single catalog entry and the R2 result copy. Review your own preset links, tests, and any custom mappings for retired version IDs. |

Remove `src/nacha-coverage.ts` and `src/nacha-expanded-coverage.ts` after removing their imports. Keep archived reports, fixture bytes, and manifests. The original and R1 schema-4 evidence lives in `docs/coverage/nacha-retired-report-schema-4.0.0.json`. Regenerate the active coverage snapshot from your registry with `npm run export:coverage` if your repository publishes it.

## Shared dependencies

Keep compatible copies of `src/parsers/nacha-entry-types.ts`, `src/parsers/fixed-record.ts`, and `src/parsers/ach-remittance.ts`. CTX remittance uses the X12 implementation in `src/parsers/edi.ts`, `src/parsers/edi-source.ts`, and `src/parsers/shared.ts`. Retain the shared types (including `ParserOutput` from `src/parsers/iso.ts`) and errors and limits from `src/resource-policy.ts`. These shared implementations already exist at the transfer base. Preserve them when applying the NACHA hunks, and bring over any missing dependencies from the same source commit. The built-in R2 sample pair reads `demo-files/nacha-expanded/mixed-entry-types-pass.ach` and `demo-files/nacha-expanded/prenote-amount-fail.ach`.

If you use the ReadMe integration, apply the NACHA preset instructions in `scripts/readme-templates/INSTALLATION.md`. Run `npm run build:readme` from your customized source and use its generated bundle. The bundle from this PR contains this repository's UI.

## Baseline and verification

The baseline was fetched from `origin/main` at `181dd49a67b564f6b8a3468f519370b65ab5892b`. All 1,192 unit cases and 122 Chromium/WebKit cases passed. The focused R2 tests and export capture passed before the refactor. `tests/nacha-r2-baseline.test.ts` pins the JSON and CSV reports from 237 existing fixtures, including 106 PASS, 124 FAIL, four PASS WITH WARNINGS, and three UNSUPPORTED runs. The comparison normalizes the source-dependent build revision. The rest of each report, including rule inventory, messages, severities, check states, and locations, is compared byte for byte.

Transfer the baseline test and its four fixture directories (`demo-files/nacha/`, `demo-files/nacha-expanded/`, `demo-files/ach-candidates/`, and `demo-files/mixed-findings/`) if they are missing locally. Run the R2 parser and coverage tests, worker admission tests, and your browser tests for selection, presets, validation and both export buttons.

Draft #66 also touches profile registration and catalog selection. It covers more families than this change. Drafts #69, #70, #73, and #79 change NACHA checks or warnings, and #85 changes the origination extensions. Their behavior is outside this transfer. Reconcile those changes against R2 when they are reviewed. Review #76 and #77 after the consolidation, in the order specified by #89.
