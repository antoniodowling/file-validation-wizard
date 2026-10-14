# Phase 3 — Huntington ACH Control Total source gate

**Current implementation:** The live Markdown source was recovered on 2026-10-14. An executable standalone field/single-record candidate supersedes the implementation hold below; transport assumptions are disclosed. See [HUNTINGTON_CONTROL_TOTAL_CANDIDATE](HUNTINGTON_CONTROL_TOTAL_CANDIDATE.md). The original assessment below is retained as dated source-review history.

Assessment 2026-10-14. This is Huntington’s separate control-total format, not NACHA record type 8/9. Standalone validation is the settled scope; companion uploads, original-NACHA matching and cross-file reconciliation are excluded. No executable profile or placeholder is added while its contract remains unconfirmed.

The transferred source assessment identifies this [official page](https://developer.huntington.com/enterprisepayments/docs/ach-control-total-flat-file) and layout:

| Field | One-based columns | Width | Transferred contract |
| --- | --- | --- | --- |
| Origin | 1–10 | 10 | Origin identifier |
| Company name | 11–26 | 16 | Company name |
| Credit total | 27–38 | 12 | Integer cents |
| Debit total | 39–50 | 12 | Integer cents |
| Date | 51–58 | 8 | CCYYMMDD |

The layout alone does not confirm the complete wire contract. The page failed in the web reader; its advertised Markdown endpoint returned HTTP 403. Connected documentation search returned no result for the exact title. A bounded official-domain search found no accessible additional contract. These are retrieval/confirmation limitations, not proof that Huntington has no specification. No login, CAPTCHA, account registration, paid access or external message was attempted.

## Specification-owner questions (prepared, not sent)

1. Identify the normative layout/version and effective date. Are the 58 positions bytes or decoded characters? Specify encoding, permitted character repertoire and BOM handling, especially for company names.
2. Is a standalone document exactly one record or may it contain multiple? Specify separators (LF/CRLF/CR/none), permitted terminal delimiter, blank-line handling, concatenation, header/trailer presence and padding. Specify whether each field is mandatory, its alignment/pad character and allowed identifier vocabulary.
3. Confirm that both totals are unsigned 12-digit integer cents, whether zero/blank totals are allowed, and the date’s calendar/meaning. Identify any requirements that depend on a companion NACHA; those will be excluded from standalone validation, not reported as checked.
4. Supply authoritative synthetic PASS/failure/warning examples and expected findings for these rules. Fixture approval and actual hosted ReadMe acceptance remain separate from source confirmation.

The phase is source gated, locally checkpointed and unavailable in the dropdown. No guessed ASCII/single-record/newline contract, illustrative fixture or conformance verdict is emitted. Once confirmed, shared fixed-record helpers and exact BigInt arithmetic can serve the implementation without changing admission/resource limits. No bank acceptance, authorization, submission or deployment occurred.
