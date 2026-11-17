# NACHA R2 ARC, BOC, POP, RCK checks — implementation handoff

Tracks [#75](https://github.com/antoniodowling/file-validation-wizard/issues/75) and depends on [#74](https://github.com/antoniodowling/file-validation-wizard/issues/74). **Proposal only; no executable implementation in this draft.**

- Add `ARC`, `BOC`, `POP`, `RCK` profiles to the SEC registry introduced in #74.
- Implement source-backed entry/addenda layout checks, permitted transaction code/service class combinations, and precise error locations.
- Reuse R2 file/batch/control checks only where valid. Preserve the existing customer-facing error/warning/results experience.
- Do **not** add user-visible validation-depth/scope labels (including “baseline”, “detailed” or “partial”), banners, disclosures, or new export fields/messages.
- Add passing and malformed synthetic fixtures for each SEC, with unchanged results for the five existing SECs.
- Compare with Garrett's HTML validator to identify gaps, but rely on authoritative Nacha specifications for expected behavior.
- Do not fabricate PASS outcomes for unsupported cases or skipped checks.

**Out of scope:** IAT/ADV/other SECs, authorization and eligibility verification, ODFI policy, complete Operating Rules certification, UI redesign.

**Ready to merge only when:** #74 is integrated, implementation/tests replace this handoff-only diff, and all #75 criteria pass.
