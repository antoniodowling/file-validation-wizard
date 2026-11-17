# NACHA R2 SEC profile registry — implementation handoff

Tracks [#74](https://github.com/antoniodowling/file-validation-wizard/issues/74). **Proposal only; no executable implementation in this draft.**

- Introduce an R2-specific SEC profile registry for the existing `CCD`, `PPD`, `CTX`, `WEB`, `TEL` behaviors: applicable checks, entry layouts and addenda constraints.
- Replace hard-coded R2 SEC dispatch in `src/parsers/nacha.ts` without changing existing five-code outcomes, rule IDs, finding locations or earlier packs.
- Preserve accurate internal rule applicability and unsupported handling. Never mark a check PASS unless it ran.
- **No customer-visible validation-scope or depth reporting.** Do not introduce “baseline”, “detailed” or similar labels, notices, extra result fields, warnings, or export messages. No UI redesign.
- Maintain R2 independence from retired original/R1 profiles (coordinate #65).
- Test unchanged output for existing fixtures and accurate unsupported SEC behavior.

**Out of scope:** More SEC codes, new NACHA rules, UI/reports redesign, or changes to legacy profiles.

**Ready to merge only when:** code and tests replace this handoff-only diff and all #74 criteria pass.
