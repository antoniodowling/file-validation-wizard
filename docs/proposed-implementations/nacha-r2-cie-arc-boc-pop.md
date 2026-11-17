# NACHA R2 CIE, ARC, BOC, POP — implementation handoff

Tracks [#75](https://github.com/antoniodowling/file-validation-wizard/issues/75); depends on [#74](https://github.com/antoniodowling/file-validation-wizard/issues/74) / [draft PR #76](https://github.com/antoniodowling/file-validation-wizard/pull/76). **This is the revised implementation scope; no executable validation code is present in this draft.**

## Problem
R2 currently validates CCD, PPD, CTX, WEB and TEL; its parser embeds SEC-specific decisions. We need a bounded new cohort to validate the registry introduced in #74 without adding more special cases to `src/parsers/nacha.ts`.

## Implementation
1. Add **CIE** as a distinct bill-payment credit profile (verify applicable transaction code, service class, layout and addenda constraints against authoritative Nacha evidence).
2. Add **ARC**, **BOC** and **POP** as related check-conversion debit profiles, sharing common checks but keeping each profile's verified exceptions and required fields separate.
3. Reuse generic R2 file/batch/control checks and the registry from #74. SEC selection is **per batch**, so mixed files apply the correct profile to each batch.
4. Implement exact source-backed record positions and clear existing-style error/warning messages with record/column locations. Avoid assuming business authorization or original-check eligibility is detectable from uploaded file alone.
5. Add positive and negative synthetic fixtures **for each SEC**, plus mixed-SEC fixtures and regression checks for existing CCD/PPD/CTX/WEB/TEL.
6. Compare representative cases against Garrett's HTML validator only for gap discovery; authoritative Nacha rules control correctness.
7. Preserve existing UI and exports. **No** new customer-facing validation-scope, depth or coverage labels, disclaimers, banners, warnings or export fields. Keep internal not-applicable/unevaluated checks correct.

## Done when
All #75 acceptance criteria pass, #74's registry is integrated, and this plan-only diff is replaced/augmented with executable implementation and tests.

## Not in this PR
**RCK** (explicitly deferred), IAT, ADV or other SECs; external authorization/check eligibility verification; bank acceptance policy; full Operating Rules certification; UI redesign.

*Historical note: the head branch name contains RCK because PR #77 was opened before the scope revision. The active scope is CIE/ARC/BOC/POP only.*
