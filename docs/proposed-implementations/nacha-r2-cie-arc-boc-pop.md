# NACHA R2 CIE, ARC, BOC, POP — implementation status

Tracks [#75](https://github.com/antoniodowling/file-validation-wizard/issues/75), implemented in [draft PR #77](https://github.com/antoniodowling/file-validation-wizard/pull/77).

**The handoff-only draft now contains executable independent definitions, source research and tests.** See the completed [plain-English rule register](../NACHA_R2_SEC_RULE_REGISTER.md) for new/reused rules, evidence, exceptions, exclusions and integration work.

Implemented: four named SEC definitions, four new rule IDs, eleven reused rule hooks, thirteen synthetic fixtures and 102 focused tests. The full suite passes 1,294 tests; typecheck and production build pass.

**Not active in the selectable R2 pack yet.** [#74 / PR #76](https://github.com/antoniodowling/file-validation-wizard/pull/76) still contains only a registry handoff at inspected head `d90cb5ed17193997e36ce709a5454aad00fc5133`. This PR leaves that registry work intact and supplies callbacks for integration after its interface exists. Production per-batch dispatch, rule inventory wiring and end-to-end acceptance remain blocked; PR #77 remains draft.

No existing parser/pack behavior, UI, exports, other formats or PR #69 is changed. RCK, IAT, ADV and other SECs remain outside scope. The historical branch name containing RCK is retained only to preserve PR #77.
