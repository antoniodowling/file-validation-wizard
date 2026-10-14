# Huntington BAI2 candidate scope

Profile: `huntington-bai2-public-2026-r1`. Rules/coverage revision: `huntington-bai2-candidate-1.0.0`. Export schema: 3. Mode: CANDIDATE. No production sign-offs are claimed.

## Source and preservation

The owner supplied the complete [Huntington BAI2 guide](https://developer.huntington.com/enterprisepayments/docs/bai2), metadata updated `2026-09-17T20:36:35.000Z`, as pasted text. Its UTF-8 byte SHA-256 is `83a5ccfe3eb6d0919e2cd401670df26d4a30728c0987f84c2aa4cefb8fe48b0e`. The live family page was read on 2026-10-14 and its layouts/sample corroborate that source. Future page changes require a new profile/coverage revision rather than silently changing this candidate.

The [illustrative sample](../demo-files/bai2/huntington-guide-sample.txt) is preserved separately from synthetic fixtures, with its hash in [the manifest](../demo-files/bai2/manifest.json). It is a public example, not a private customer file or independently accepted bank conformance fixture. The full guide remains owner-supplied source material and is not needed at runtime.

## Supported scope

| Area | Source requirement | Implemented behavior |
| --- | --- | --- |
| Hierarchy | 01 file header, 02 group header, 03 account summary, optional 16 detail/88 continuation, 49/98/99 trailers; multiple groups/accounts | Exactly one file; nonempty groups/accounts; owned details; correctly ordered closing trailers. Bad nesting stops dependent arithmetic. |
| Continuations | 88 can follow any record, including 88 | Assemble structured fields at carried comma boundaries, preserving physical counts/source spans. Header/trailer continuations, chains and opaque 16 text are supported. No invented requirement that every 88 begins with a transaction code. |
| File header | Sender, receiver, date/time, file ID, version 2; optional physical length/block size described as not included | Required fields populated; real YYMMDD date, HHMM including 2400, version 2. Example IDs/file ID are not hard-coded. Declared blocking/length is unsupported. |
| Group header | Originator, status 1, as-of date; optional receiver/time/currency/modifier | Required fields and optional time checked; USD/omitted currency; omitted modifier or source-documented 2. Other currencies/modifiers receive no verdict; omission does not establish reporting mode. |
| Account summary | Account number without leading zeros; optional repeated code/amount/item-count/funds fields | Numeric account ID; surrounding spaces tolerated as in sample. Summary/status code union from common and final code lists. Present item counts must be zero. |
| Detail | Required type code; optional amount, funds, references and free-form text | Correct detail-level code; exact amount arithmetic. Commas/slashes in the text field are opaque. References are preserved without invented identity/shape requirements. |
| Controls | 49 sums 03/16/88 amounts; 98 sums account controls; 99 sums group controls | Numeric summary/detail operands counted once after continuation assembly, without debit/credit netting. Exact BigInt arithmetic; malformed numeric/layout prerequisites suppress dependent totals. |
| Counts | Account records, group accounts/records, file groups/records | Physical counts include headers, trailers and attached 88 records. Guide sample accounts 3/14/3/3, group 25, file 27. Bad count syntax suppresses its dependent reconciliation. |
| Codes | Common-code list plus final table, which warns of bank variation | Frozen union of 247 codes in `src/bai2-codes.ts`; the duplicate entry for code 136 is removed, and common 040/060 retained. Known code at wrong level fails; unlisted three-digit code is unsupported. No debit/credit economic inference. |
| Findings/exports | Existing application contract | Parser-owned exact field locations or explicit record context at original UTF-16 offsets; schema-3 coverage/exclusions/check states in JSON/CSV. Historical revisions remain unchanged. |

## Candidate decisions and exclusions

The descriptive guide does not provide a complete BAI/X9 grammar. These assumptions are disclosed in every run/export:

- Printable ASCII through strict UTF-8 decoding; one slash-terminated physical record per LF/CRLF/CR line, mixed separators admitted, at most one final separator. BOMs/tabs/non-ASCII and blank physical lines fail admission. `.bai`, `.bai2`, `.txt` are picker metadata. No universal 80-character line limit is enforced; line size remains bounded by local resource policy. Concatenated/blocked transport is unqualified.
- Structured continuation follows `,/`, carrying a complete field boundary. A completed 03 tuple retains its empty funds slot before the next summary tuple, as in the guide sample; elsewhere the trailing placeholder is filled by the continuation. Scalar splits are unsupported because the guide does not define that contract. Optional trailing fields on 02/03/16 can be omitted. 16 text begins after the sixth comma; following 88 payload is opaque text.
- Calendar validation interprets YY as 2000–2099. Amounts admit an optional minus sign and at most 40 digits; counts admit 40 unsigned digits. Century/sign/size policies are candidate decisions. No dollar conversion or decimal scaling is inferred. Omitted optional amounts contribute no numeric operand.
- Nonempty funds fields, including S/V/D/Z, are unsupported: the guide supplies names without additional-field grammar. Declared physical length/block size, other version/currency/modifier values and unlisted three-digit codes also produce UNSUPPORTED, no verdict, no occurrences and all checks not evaluated.
- Syntax/nesting failures produce completed FAIL with dependent checks not evaluated. Resource/finding limits produce incomplete runs through existing worker safeguards. Physical records/fields are bounded at 100,000, individual scalar/text fragments at 1,000,000 units and results at 5,000. Existing byte/source/deadline limits remain active.
- CSV transmission, custom OpenText translations, encryption/SFTP handling, entitlements, delivery schedules, real bank/account verification, funds availability correctness, balance equations, historical duplicates, bank acceptance and production qualification are excluded.

## Validation and acceptance

[Unit tests](../tests/bai2.test.ts) cover the exact guide sample, synthetic multiple groups/accounts, summary-only files, signed/large amounts, every trailer check, field-boundary continuations after every record family, chains/text, continuation field locations, malformed/unsupported inputs, encoding, exports and allocation limits. [Browser tests](../tests/browser/bai2.spec.ts) cover selection, worker upload, PASS/FAIL/UNSUPPORTED, source navigation, JSON/CSV and stale-finding clearing in standalone and generated ReadMe mounts. Existing guide-link tests include BAI2.

`node scripts/generate-bai2-files.mjs` regenerates synthetic fixtures and their manifest while preserving the source sample. `node scripts/export-bai2-coverage.mjs` prepares only the new [coverage snapshot](coverage/bai2-candidate-1.0.0.json); existing frozen snapshots remain unchanged. Neither is a routine semantic-update mechanism after this revision is published.

Actual ReadMe CSP/customization coexistence, manual accessibility, independent BAI/X9/domain approval and bank/production acceptance remain separate from local evidence. Follow the existing [developer handoff](DEVELOPER_HANDOFF.md) and release gates; passing candidate checks does not prove those acceptance levels.

Local validation on 2026-10-14 (Node 26.5.0): `npm run validate:core` passed 783 unit tests, stress-fixture integrity, TypeScript, both builds and the ReadMe static contract. Independent review identified omitted trailing account currency; after that localized correction, 59 focused BAI2/samples/coverage tests passed and both builds were regenerated successfully. The final generated package contract passed. Across one full browser run and focused repairs/reruns, all 150 Chromium/Firefox/WebKit cases passed (141 in the full run, 3 repaired catalog cases and 6 BAI2 cases). Initial browser failures were test expectations/selectors and have passing rerun evidence. No hosted or bank acceptance is inferred. Local Markdown links and whitespace checks passed.
