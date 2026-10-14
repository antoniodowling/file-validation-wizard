# NACHA public-source validation profile

Source review: 2026-10-14. Profile: `origination-public-2026`. Release mode: `CANDIDATE`; Product, SC, FT, rules, and fixture approvals remain false. The profile is enabled for local evaluation and testing. It does not claim full 2026 Operating Rules compliance, bank acceptance, payment authorization, or readiness for submission.

## Sources used

| Source | Use and boundary |
| --- | --- |
| [Nacha ACH File Overview](https://achdevguide.nacha.org/ach-file-overview) | General record ordering, 94-character records, blocking/padding, field formatting, trace sequencing, service classes, balanced/unbalanced files. |
| [Nacha ACH File Details](https://achdevguide.nacha.org/ach-file-details) | Shared file/batch controls, common entries, addenda and linkage, conditional WEB credit identification, TEL addenda prohibition. The public guide points to the full Operating Rules for further detail. |
| Owner-provided 2026 Basic Edition Appendix Three screenshots | Shared layouts 3.1.1/3.1.2, CCD 3.1.7 (Basic-92), CTX 3.1.9 (Basic-94), PPD 3.1.16 (Basic-105), TEL 3.1.19 (Basic-108), WEB 3.1.22 (Basic-111). Reviewed visually; no copyrighted page images are committed. |
| [First Citizens NACHA File Specifications](https://www.firstcitizens.com/content/dam/firstcitizens/pdfs/commercial/commercial-advantage/nacha-file-specs.pdf), revision 02/2024 | CTX layout and addenda count/sequence, control and routing arithmetic. Bank-assigned IDs, routing constants, blank discretionary fields, and consecutive batch policy are not imposed. |
| [Goldman Sachs ACH Payment File Structure](https://developer.gs.com/docs/services/transaction-banking/ach-file/) | Cross-check layouts, direction/account transaction codes including loan credit 52. GS-specific routing, identifiers, WEB debit-only support, date windows, and required optional fields are not general rules. |
| [US Treasury routing attribute definitions](https://www.fiscal.treasury.gov/data/FSv49/IAIv10/Library/AttributeDataDictionary.html) | ABA routing prefix ranges. Checks validate syntax/prefix/checksum, not actual bank directory membership. |
| [Nacha Company Entry Description amendment](https://www.nacha.org/rules/risk-management-topics-company-entry-descriptions) | 2026 PAYROLL/PURCHASE purpose-dependent requirements. Actual transaction purpose cannot be established from this file alone, so those semantics are outside this candidate's proof. |

Operating knowledge guides interpretation and test design. Implemented acceptance requirements are grounded in these public sources and the supplied layouts. Full licensed-rulebook comparison is deferred to production qualification, not a prerequisite for this public-source implementation.

## Implemented coverage

- Ordinary monetary debit/credit originations in any subset or mix of CCD, PPD, CTX, WEB, and TEL batches. Direction must match service class 200/220/225; TEL is debit-only. Transaction codes 22/27/32/37 and loan credit 52 are supported. WEB credits require originator identification. Other account codes, prenotes, zero-dollar remittance entries, returns/NOCs, reversals, and other SEC codes are rejected as outside this profile.
- Exactly 94 printable ASCII characters per record, preserving spaces. Consistent LF, CRLF, CR, or complete concatenated records; optional one terminal delimiter. Blank records, mixed framing, tabs, non-ASCII text, and a BOM are rejected. All-9 padding must follow file control and complete a ten-record block.
- File/batch/entry/addenda/control order, nonempty complete batches, header constants and populated required fields, true YYMMDD dates (interpreted as 2000–2099), and optional HHMM time. Effective dates on weekends generate a warning; holidays, live dates, receipt times, and bank windows are not consulted.
- Routing digits, supported ABA prefixes and checksum, batch/trace identification and ascending sequencing, file trace uniqueness, addenda indicator and linkage. TEL has no addenda; CCD/PPD/WEB permit one; CTX permits up to 9,999 with a matching entry count.
- Batch/file entry-plus-addenda counts, hash truncated modulo ten billion, debit/credit totals in exact integer cents, block/batch counts, mirrored batch controls, and reserved spaces. Debit and credit totals are not required to be equal. Dependent amount controls are withheld when amounts or transaction directions cannot be interpreted.
- Operator-populated settlement date generates a warning if valid; invalid Julian syntax/range fails. The value is not proof of actual settlement.

## Findings and limits

Each parser rule emits one aggregated result. Repeated violations contribute an occurrence count, and navigation highlights the first offending record/field. Grouped checks use context highlights. This bounds output growth for large inputs and avoids disclosing account or company values in messages. Malformed framing stops at the first bad boundary without materializing a delimiter list. Reports use the current schema-2 coverage/provenance CSV and JSON export. The worker deadline and 25 MB upload limit remain in effect; the engine also enforces an 8,000,000 decoded-unit limit and reports excess as an incomplete resource-limited run. Direct parser offsets supply NACHA locations without a second location index; viewer budgets still apply. The current engine also supplies physical source line numbers in compact and explorer result tables. Concatenated files have one physical line; their record/column locators still identify the failing record.

See the [69-file synthetic kit and rule matrix](../demo-files/nacha/README.md). The fixture manifest and tests bind every parser rule to a named error/warning example; targeted parser tests cover additional boundaries.

The profile does not verify bank routing-directory membership, account existence or eligibility, customer authorization, consent, fraud controls, real transaction purpose, cross-file duplicate identifiers, federal holidays, transmission cutoffs, MAC authentication, or embedded EDI/UN-EDIFACT/tax/healthcare remittance semantics. Field padding checks are limited to numeric syntax, reserved spaces, constants, and required values; full alphabetic-field semantic validation is deferred. These are coverage limits, not evidence of compliance. Approval gates must remain unmet until the responsible reviewers actually approve the rules/fixtures and Product/SC/FT release.

## Production qualification

Required acceptance includes comparison with the governing current Operating Rules and relevant amendments, independent business/rule review, approved fixtures, representative browser performance and recovery, actual ReadMe integration, existing accessibility checks, and required sign-offs. Local tests do not establish those outcomes. No account registration, rulebook purchase, public hosting change, or deployment is part of this implementation.
