# Format pack isolation baseline

This document is a work in progress for issue #59. The refactor and authoring workflow are not yet implemented.

The baseline is main commit `181dd49a67b564f6b8a3468f519370b65ab5892b`. `tests/format-pack-baseline.test.ts` captures the ordered catalog, profile metadata, and complete run, JSON and CSV output for both synthetic samples of all 17 profiles. Only `buildRevision` is normalized. These samples do not replace the issue's required broader corpus, visual baselines, or review of unsupported and incomplete cases.

Baseline validation on 2026-11-04: `npm ci`, `npm run validate:core`, and `npm run check:readme-drift` passed; Vitest reported 1,192 tests. The full Playwright run reported 119 passed and 64 failed: all 61 Firefox tests failed to launch because Firefox could not find its profile folder, and three WebKit tests failed. The three WebKit tests passed on a targeted retry. A separate Firefox retry, including with a different temporary directory, reproduced the startup failure. Cross-browser qualification remains open.

Presentation artifact SHA-256 at baseline:

- `custom-css.css`: `72e93c6b19480e65f75d93e64be3df25a6e0f5293070735fc36ccf5214928580`
- `custom-page-file-explorer.html`: `e5fda33ca0fe472918745b7b45e9f202e39dd39da670d0b51749ea5751e64b57`
- `custom-page.html`: `a4c37f4852f46472e7121ce563276cc0a675df1687f32d1cc13bd26595f09147`
- `PaymentFileValidator.mdx`: `fb9c6003db01877d64e7403164dfe6233b0d098e59725a135aa8ef97f5ebc52d`
