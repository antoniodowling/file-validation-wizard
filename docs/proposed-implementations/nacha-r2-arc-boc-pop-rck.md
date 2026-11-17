# NACHA R2 baseline check-conversion SECs — implementation handoff

Tracks [#75](https://github.com/antoniodowling/file-validation-wizard/issues/75) and depends on [#74](https://github.com/antoniodowling/file-validation-wizard/issues/74). **Proposal only; no executable implementation in this draft.**

- Add profiles for `ARC`, `BOC`, `POP`, `RCK` to the SEC registry introduced in #74.
- Implement only source-backed structural field layouts, permitted transaction code/service class combinations, and applicable addenda validations with precise error locations.
- Reuse R2 common framing/control checks where valid. Label these profiles **baseline structural validation**, not full compliance or authorization checks.
- Include passing and malformed synthetic fixtures for each SEC and unchanged regression results for the five existing SECs.
- Differential-check Garrett's HTML validator for coverage gaps, but use authoritative Nacha specifications for expected behavior.

**Out of scope:** IAT/ADV/other SECs, authorization and eligibility verification, ODFI policy, complete Operating Rules certification, UI redesign.

**Ready to merge only when:** #74 is integrated, implementation/tests replace the handoff-only diff, and all #75 criteria pass.
