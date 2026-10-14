# Huntington standalone control-total candidate

Profile `huntington-control-total-public-2026-r1`; ruleset `huntington-control-total-candidate-1.0.0`. CANDIDATE, all approvals false.

[Huntington's source](https://developer.huntington.com/enterprisepayments/docs/ach-control-total-flat-file.md), updated 2026-09-18, was successfully retrieved on 2026-10-14. It specifies origin 1–10, company 11–26, credit cents 27–38, debit cents 39–50 and transmission date CCYYMMDD 51–58. Credit/debit fields omit decimals, right justify and zero fill; names are uppercase. The candidate checks field syntax and a real Gregorian date. Integer cents remain twelve-digit strings and cannot lose precision.

Candidate admission is one 58-column printable-ASCII record, with no BOM and an optional single LF, CRLF or CR terminal delimiter. This is a disclosed executable scenario rather than an assertion that Huntington universally mandates that transport encoding/framing. Multiple records receive UNSUPPORTED/no verdict. Malformed candidate records receive FAIL; malformed boundaries/characters suppress dependent field checks.

Origin retains a possible leading blank. Company-name equality, the 16/23-position truncation question, totals equality, and date equality with a companion NACHA file are excluded from this standalone profile. Actual transmission dates/collection windows are also external facts. No companion upload, submission, funds, bank acceptance or Production activation is performed.

Evidence: `tests/huntington-control-totals.test.ts`; deterministic synthetic fixture kit. Engineering evidence does not supply Product/SC/FT/rules/fixture approval or hosted ReadMe acceptance.
