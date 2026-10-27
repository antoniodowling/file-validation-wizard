# File Format Validation Wizard

A browser-local demo for exploring and validating payment-file formats. The wizard includes:

- a focused catalog of PAIN.001, PAIN.008, ASC X12 EDI 820, NACHA origination, ACH Returns, Huntington control totals, File Received ACK, BAI2, and CSV Wire;
- nine ISO/X12 profiles, with three versions per format;
- six ACH candidates across four format families, including three origination revisions for CCD, PPD, CTX, WEB, and TEL;
- one Huntington-guide BAI2 reporting candidate with multiple groups/accounts, continuations, and exact trailer controls;
- one Huntington CSV Wire candidate for 54-field domestic USD and 58-field international USD imports within its [declared scope](docs/CSV_WIRE_SOURCE_SCOPE.md); and
- a read-only file explorer on the dedicated explorer page. Findings link to the source or nearby context; findings without a source location are labeled explicitly.

Demo results check a limited set of syntax and structure rules. They do not represent Product, SC, or FT approval and do not guarantee bank acceptance or payment readiness.

## Developer handoff

Start with [the developer guide](docs/DEVELOPER_HANDOFF.md). For copy/paste installation, use [readme-package/INSTALLATION.md](readme-package/INSTALLATION.md). This repository contains a demo, not an approved production validator.

| Path | Purpose |
| --- | --- |
| `src/` | Editable TypeScript source, styles, catalog, parsers, and rules |
| `readme-package/` | Generated, checked-in copy/paste deliverables for ReadMe |
| `demo-files/` | Synthetic starter demos, regression fixtures, and stress files; see the index below |
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

Use Node.js 22.12 or newer (`nvm use` selects the version in `.nvmrc`).

| Command | Checks |
| --- | --- |
| `npm run validate:core` | Unit tests, stress-kit integrity, TypeScript, the standalone build, ReadMe-package regeneration, and static package checks |
| `npm run validate` | Everything in `validate:core`, plus Playwright browser tests |
| `npm run check:readme-drift` | Whether `readme-package/` matches the Git checkpoint; it does not regenerate files |

Before running browser tests, install Chromium, Firefox, and WebKit with `npx playwright install`. On Linux, use `npx playwright install --with-deps` if system dependencies are missing. With `CI_MODE=lean`, the required Fast CI check classifies the complete change, checks whitespace, and builds source changes; selected synthetic fixture and CI-control changes also run their relevant checks. Documentation-only changes skip dependency installation and the build. The manually dispatched **Validate handoff** workflow retains core checks, generated-package drift detection, and all three browser projects; run it before release or handoff. A fast merge is not release qualification. Run the drift check after regeneration and committing any generated changes.

## Demo and test files

Most files in `demo-files/` are regression fixtures for automated tests. Start with the examples below for a manual walkthrough. They link to existing fixtures; the larger kits remain in their original locations.

Generated fixtures use synthetic data. The BAI2 kit also preserves the public guide’s illustrative sample separately; it is not customer data or independently accepted bank conformance evidence. PASS means that the file passes the selected profile's implemented checks. These files are not approved payment instructions.

### Starter demos

Select the format and version shown, upload a linked file, and press **Validate**. Start with the three PAIN.001 files to compare PASS, PASS WITH WARNINGS, and FAIL, then try the examples for the ACH family you are working on.

| Select format | Select version / profile | Files and expected results | Advisory checks currently implemented |
| --- | --- | --- | --- |
| PAIN.001 | pain.001.001.09 | [PASS](demo-files/pain.001.001.09-pass.xml), [PASS WITH WARNINGS](demo-files/pain.001.001.09-pass-with-warnings.xml), [FAIL](demo-files/pain.001.001.09-fail.xml), [FAIL with warning + error](demo-files/mixed-findings/pain.001.001.09-fail-with-warnings.xml) | Missing XML declaration |
| 820 (ASC X12) | 005010 | [PASS](demo-files/hnb-validator-stress-files/11-edi-820-005010-baseline-pass.edi), the small baseline from the stress kit | None implemented |
| NACHA | Expanded entries and declared healthcare — candidate (2026 r2) | [PASS](demo-files/ach-candidates/origination-healthcare-pass.ach), [PASS WITH WARNINGS](demo-files/nacha-expanded/effective-weekend-warning.ach), [FAIL](demo-files/ach-candidates/origination-healthcare-missing-fail.ach), [FAIL with warning + error](demo-files/mixed-findings/nacha-r2-fail-with-warnings.ach) | Weekend effective date; populated operator settlement date |
| ACH Returns | General network returns — public-source candidate (2026 r1) | [PASS](demo-files/ach-candidates/returns-ccd-pass.ach), [FAIL](demo-files/ach-candidates/returns-trace-fail.ach) | None implemented |
| ACH Control Totals | 58-column standalone candidate (2026 r1) | [PASS](demo-files/ach-candidates/totals-pass.txt), [FAIL](demo-files/ach-candidates/totals-date-fail.txt) | None implemented |
| File Received ACK | Single pipe-delimited scenario — candidate (1.0 r1) | [PASS](demo-files/ach-candidates/ack-received-pass.txt), [FAIL](demo-files/ach-candidates/ack-date-fail.txt) | None for ACK syntax; see disposition note below |
| BAI2 | Huntington public-guide candidate (BAI2 2026 r1) | [PASS](demo-files/bai2/balances-pass.bai2), [FAIL](demo-files/bai2/account-total-fail.bai2), [UNSUPPORTED](demo-files/bai2/funds-unsupported.bai2) | None implemented |
| CSV Wire | Huntington CSV Wire — USD candidate (2026 r1) | [Domestic PASS](demo-files/csv-wire/domestic-pass.csv), [International USD PASS](demo-files/csv-wire/international-usd-pass.csv), [FAIL](demo-files/csv-wire/amount-fail.csv), [UNSUPPORTED](demo-files/csv-wire/cad-unsupported.csv) | None implemented |

The PAIN.001 warning example omits the recommended XML declaration. Its FAIL example has a namespace mismatch, which stops validation before structural checks run. Use these examples to inspect finding locations and CSV exports as well as the result summary.

The NACHA warning example has a weekend effective entry date and is also valid under the selected r2 profile, although it is stored in the retained r1 fixture kit. It produces PASS WITH WARNINGS with no errors; it does not exercise the healthcare-specific checks.

Each **FAIL with warning + error** example produces one error and one warning together. PAIN.001 combines an empty message ID with a missing XML declaration; NACHA r2 combines missing declared-healthcare addenda with a weekend effective date. The error keeps the overall result FAIL. These are existing profile behaviors; no warning rules were added. See the [mixed-findings kit](demo-files/mixed-findings/README.md) for exact profiles and provenance.

“None implemented” means the current profile has no advisory warning rules; it does not mean warnings could never apply to that format. PASS WITH WARNINGS requires an implemented advisory rule to fire without an error. Any error makes the overall result FAIL, even if warnings are also present. PAIN.008 has the same missing-XML-declaration advisory as PAIN.001; its wiring samples are described below.

For ACK, format validity and reported disposition are separate. [ack-rejected-pass.txt](demo-files/ach-candidates/ack-rejected-pass.txt) passes format checks while reporting REJECTED for the original file. Likewise, a bank-reported WARNING inside an ACK does not itself create a validator warning or change its syntax verdict.

PAIN.008 and the other ISO/X12 versions have synthetic wiring samples in [src/samples.ts](src/samples.ts), exercised by unit tests. There is no separate PAIN.008 upload kit; the starter table covers the checked-in upload examples available here.

CSV Wire requires every field, including empty fields, to be quoted. Its candidate excludes non-USD scheduling, IBAN and ambiguous intermediary SWIFT layouts; an unsupported file receives no verdict. See [source and scope](docs/CSV_WIRE_SOURCE_SCOPE.md) for guide conflicts and candidate decisions.

### Regression fixtures

Each kit covers valid inputs, specific errors, warnings, or unsupported cases. Each manifest records expected results, SHA-256 checksums and profile or rule expectations; the existing XML/ACH/stress kits also record byte counts. Use the profile named in the kit when comparing results.

| Location | Files | Profile / purpose |
| --- | ---: | --- |
| XML files directly in `demo-files/` | 6 | PAIN.001.001.09 result presentation, malformed XML, and prerequisite handling; hashes are recorded in [synthetic provenance](tests/fixtures/synthetic-provenance.json) |
| [nacha/](demo-files/nacha/README.md) | 69 | Original **Public specification profile (2026 review)**, retained for regression and historical comparisons |
| [nacha-expanded/](demo-files/nacha-expanded/README.md) | 159 | **Expanded entry types — public-source candidate (2026 r1)**, retained alongside r2 |
| [ach-candidates/](demo-files/ach-candidates/README.md) | 57 | Latest origination r2, ordinary Returns/COR, control totals, and ACK candidates; each manifest entry names its profile |
| [bai2/](demo-files/bai2/README.md) | 22 | Huntington BAI2 candidate: 21 synthetic fixtures and one preserved public guide sample |
| [csv-wire/](demo-files/csv-wire/README.md) | 23 | Synthetic domestic/international USD CSV Wire input, failures and unsupported scenarios; separate candidate r1 and manifest |
| [mixed-findings/](demo-files/mixed-findings/README.md) | 2 | One PAIN.001.001.09 DEMO and one NACHA r2 candidate example, each producing FAIL with one error and one warning |

The remaining PAIN.001 examples cover:

- [syntax-error.xml](demo-files/pain.001.001.09-syntax-error.xml): the correct namespace with an unclosed `PmtInf` element, producing FAIL with parser-position navigation.
- [multiple-errors.xml](demo-files/pain.001.001.09-multiple-errors.xml) and [multiple-errors-resolved.xml](demo-files/pain.001.001.09-multiple-errors-resolved.xml): a broken message container and its corrected companion. The broken file also has a blank message ID and nonnumeric transaction count, but reports only the container error until that prerequisite is valid. Descendant checks and the dependent declaration advisory are skipped. The corrected companion passes the current DEMO checks; the original preserves earlier report history.

Keep all profile revisions and their fixtures. Malformed inputs, fixed-width spaces, line endings, and historical expectations are intentional; do not normalize them. The kit READMEs describe generation and comparison procedures.

### Stress files

The [14-file stress kit](demo-files/hnb-validator-stress-files/README.md) covers XML and EDI baselines, malformed encoding, byte limits, parser budgets, and incomplete runs. Its README lists the required profile and expected behavior for every file. Use it when checking processing safeguards; begin with the small baselines and follow the kit's instructions before running adversarial cases.

## Catalog and validation profiles

The display catalog is defined in `src/format-catalog.ts`; executable parsers and rules are registered in `src/format-packs.ts`. The nine ISO/X12 profiles are `DEMO`. The six ACH profiles are `CANDIDATE` revisions based on public specifications and declared scenarios. None is an approved production pack or a complete 2026 Operating Rules implementation.

For NACHA origination, r2 is the latest candidate; the original profile and r1 remain selectable. The original **Public specification profile (2026 review)** supports ordinary monetary transaction codes 22, 27, 32, 37, and 52 across the five supported SEC codes in separate batches. It accepts balanced and unbalanced files when controls reconcile, with LF, CRLF, CR, or concatenated 94-character framing. See [original NACHA scope](docs/NACHA_SOURCE_REVIEW.md), [expanded r1 scope and gates](docs/ACH_ORIGINATION_EXPANDED.md), and [origination r2](docs/ACH_ORIGINATION_R2.md) for revision-specific rules.

The other ACH candidates cover [ordinary network Returns/COR](docs/ACH_RETURNS_CANDIDATE.md), [Huntington standalone control totals](docs/HUNTINGTON_CONTROL_TOTAL_CANDIDATE.md), and [Huntington single-scenario ACK](docs/HUNTINGTON_ACK_CANDIDATE.md). Their supported checks and exclusions are recorded in [version-bound coverage](docs/coverage/ach-candidates-1.0.0.json). These four latest candidates export schema 3; the earlier profiles retain schema 2. ACK exports record reported disposition separately from the validation verdict.

BAI2 adds a seventh CANDIDATE profile, **Huntington public-guide candidate (BAI2 2026 r1)**. It checks the declared line-based USD reporting scenario, continuations, hierarchy, fields and trailer controls, with schema-3 exports. Funds availability layouts and other unqualified scenarios receive no verdict. See [source scope and assumptions](docs/BAI2_SOURCE_SCOPE.md) and [fixtures](demo-files/bai2/README.md).

To enable a production pack, provide its exact version identifiers, approved guide URL, approved rules and fixtures, and Product/SC/FT sign-offs. The registry fails closed when any of those production release gates are missing.

Selected files are read and validated in a Web Worker. The app has no backend, analytics, remote validation, history, or selected-file persistence.

## ReadMe package

ReadMe is the documentation platform that hosts the portal. The ReadMe package is the generated code and installation guide for embedding this wizard there; it is separate from this repository's `README.md`.

Run `npm run build:readme` to bundle the source and generate the six checked-in files in `readme-package/`. Edit source or templates, then regenerate; do not edit generated files directly.

- `custom-page.html` — the wizard-only ReadMe Custom Page mount;
- `custom-page-file-explorer.html` — the independent wizard-plus-File-Explorer Custom Page mount;
- `custom-css.css` — portal-scoped styles for Appearance > Custom CSS;
- `PaymentFileValidator.mdx` — a reusable inline Guide component with optional format/version presets;
- `custom-javascript.js` — the site-wide guarded application bundle for Appearance > Custom JavaScript; and
- `INSTALLATION.md` — instructions for installing and testing the package.

Error and warning rows show a one-based **Line** number or range in both dedicated demos and compact mounts. Missing-field findings identify **Context** lines; whole-file and unmappable findings are labeled explicitly. The line refers to the primary source target, which the explorer opens. Related targets may remain in report metadata; the explorer does not provide secondary-target navigation.

The same shared JavaScript and CSS support both dedicated demos, inline Guide components, and link-triggered modals. The explorer page opts in explicitly; the wizard-only page, inline instances, and modal instances keep the compact workflow. See the installation guide for page creation and linking details.

The JavaScript bundle includes the validation worker and requires no hosted validator assets or backend. Follow `readme-package/INSTALLATION.md` to install and test it in an unpublished ReadMe page.

## Processing safeguards

The worker independently enforces the 25 MB limit. Runs have a provisional 10-second deadline and distinguish incomplete execution from a completed file FAIL. The ready-to-use files are in [demo-files/hnb-validator-stress-files/](demo-files/hnb-validator-stress-files/README.md); see [processing limits and the synthetic upload kit](docs/PROCESSING_LIMITS.md) for behavior, reproducible files, and remaining browser acceptance.

See [the file explorer implementation](docs/FILE_EXPLORER.md) for coordinate semantics, location quality, full-source browsing, the legacy index budget, and the hosted acceptance boundary.

## Pre-finalization to-do

- Complete the remaining manual and hosted WCAG 2.2 AA checks in
  [`docs/ACCESSIBILITY_FOLLOW_UPS.md`](docs/ACCESSIBILITY_FOLLOW_UPS.md) before finalization.
- Verify the generated package in ReadMe staging, including Blob-worker compatibility and coexistence with the portal's existing Custom JavaScript.
- Document the smallest hosted-asset fallback only if ReadMe's content security policy blocks the embedded worker.

## Coverage and historical evidence

See [coverage and export semantics](docs/coverage/README.md) and [implementation evidence and remaining gates](docs/IMPLEMENTATION_EVIDENCE.md). The [historical September bundle receipt](docs/evidence/ruleset-2/receipt.json) records its original bundle, not later regenerated files. ISO/X12 and ACH profiles have separate coverage revisions; local test results do not establish bank acceptance or production approval.
