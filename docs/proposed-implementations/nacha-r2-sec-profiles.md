# NACHA R2 SEC profile registry — implementation handoff

Tracks [#74](https://github.com/antoniodowling/file-validation-wizard/issues/74). **Proposal only; no executable implementation in this draft.**

- Introduce R2-specific SEC profile metadata for existing `CCD`, `PPD`, `CTX`, `WEB`, `TEL` (entry layouts, addenda bounds, applicable rules).
- Replace hard-coded R2 SEC dispatch in `src/parsers/nacha.ts` without changing existing five-code outcomes or earlier packs.
- Report evaluated coverage depth and unevaluated/unsupported conditions accurately in R2 results and exports. Do not equate unsupported checks with PASS.
- Preserve R2's independence from retired original/R1 profiles (coordinate #65).
- Test identical outcomes for existing fixtures, unsupported SEC behavior, and machine-readable scope.

**Out of scope:** Implementing more SEC codes, new NACHA rules, UI redesign, changes to legacy profiles.

**Ready to merge only when:** code and tests replace this handoff-only diff and all #74 acceptance criteria pass.
