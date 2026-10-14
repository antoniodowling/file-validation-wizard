# ACH expansion source register and phase gates

Reviewed 2026-10-14. Standalone, browser-local files only. New profiles receive new revisions; the predecessor `origination-public-2026` profile, ruleset `nacha-public-1.0.0`, and its fixtures remain historical and executable. No approval or hosted acceptance is inferred from source implementation.

| Phase | Source contract and affected work | Current gate |
| --- | --- | --- |
| 0 | Existing NACHA framing, offsets, field slicing, real dates, ABA syntax/checksum, BigInt arithmetic and prerequisite suppression | Extract only existing behavior. Parser owns conditional applicability; central validation does not enumerate NACHA exceptions. |
| 1 | [Nacha overview](https://achdevguide.nacha.org/ach-file-overview), [details](https://achdevguide.nacha.org/ach-file-details), official-bank cross-checks in [source review](NACHA_SOURCE_REVIEW.md), [reversals amendment](https://www.nacha.org/rules/reversals-and-enforcement) effective 2021-06-30 | New entry types need explicit code/SEC/amount/addenda matrix and independent fixture review before completion. Original-entry identity, eligibility and deadlines require external facts and are excluded. |
| 2 | [Huntington Returns](https://developer.huntington.com/enterprisepayments/docs/nacha-returns) and authoritative general ACH layouts | Huntington table contradicts its own direction descriptions and count examples. Resolve transaction codes, variants and conditional reason/correction fields against primary rules; never inherit ordinary-origination restrictions wholesale. |
| 3 | [Huntington control totals](https://developer.huntington.com/enterprisepayments/docs/ach-control-total-flat-file) | Published 58-column fields alone do not settle encoding, framing, cardinality and required fields. Confirm contract before executable registration. No companion comparison. |
| 4 | [Huntington ACK](https://developer.huntington.com/enterprisepayments/docs/file-received-ack-flat-file) | Page explicitly calls its sample illustrative. Exact grammar, encoding, framing, delimiters/escaping, versions, vocabulary and trailer rules needed. Keep unavailable until confirmed. Bank-reported rejection must not become document-format failure. |

## Amendment applicability

[Nacha upcoming changes](https://www.nacha.org/content/summary-upcoming-rule-changes) reviewed as of 2026-10-14: March and June 2026 fraud monitoring requires external operational evidence, not standalone-file proof. [PAYROLL/PURCHASE](https://www.nacha.org/rules/risk-management-topics-company-entry-descriptions) effective 2026-03-20 is purpose dependent. Actual purpose is unknown without owner declarations. September 2026 IAT and funds-availability amendments do not broaden these five SECs or establish settlement acceptance. January 2027 character changes, 2027 IAT/limit changes and March 2028 R90 must not be applied early.

## Shared foundation acceptance

The fixed-record helper stops at the first malformed boundary, preserves spaces and original offsets, supports consistent LF/CRLF/CR or complete concatenation, and accepts at most one terminal delimiter. Resource admission remains 25 MB and 8,000,000 decoded units with bounded findings/viewer and worker deadline. Parse prerequisite failures remain not evaluated. Missing conditional checks are not applicable only when the parser establishes their absence. Legacy snapshots are frozen and are not regenerated into new conformance evidence.

Phase 2’s confirmed source gate and unsent specification-owner questions are recorded in [ACH_RETURNS_SOURCE_GATE.md](ACH_RETURNS_SOURCE_GATE.md). No Returns executable profile is available.

Phase 3’s transferred layout and unconfirmed wire-contract questions are recorded in [HUNTINGTON_ACH_TOTALS_SOURCE_GATE.md](HUNTINGTON_ACH_TOTALS_SOURCE_GATE.md). No Huntington control-total profile is available.
