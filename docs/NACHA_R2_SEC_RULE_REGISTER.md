# NACHA R2 rule register: CIE, ARC, BOC and POP

Reviewed **2026-11-17**. Tracks [issue #75](https://github.com/antoniodowling/file-validation-wizard/issues/75) and [draft PR #77](https://github.com/antoniodowling/file-validation-wizard/pull/77).

## Delivery status and counting convention

**Executable independent definitions and tests are implemented. Production R2 integration is blocked on [#74 / PR #76](https://github.com/antoniodowling/file-validation-wizard/pull/76).** PR #76 was inspected before implementation and again after testing: head `d90cb5ed17193997e36ce709a5454aad00fc5133` contains a handoff document, without a registry. This PR does not implement a competing registry or make the four codes selectable in the current parser.

| Inventory | Count | Status |
| --- | ---: | --- |
| New Wizard rule IDs | 4 | Implemented in independent batch hooks; tested |
| Existing IDs used by those hooks | 11 | Implemented for the new layouts; tested |
| Other shared/conditional existing IDs documented for integration | 36 | Existing implementation retained; registry wiring pending |
| Existing IDs inapplicable to valid entries in this cohort | 5 | No substitute passing result; still relevant to other SECs in a mixed file |
| Candidate restrictions excluded or deferred | 12 | Individually listed below; not additional Wizard IDs |

There are 52 existing R2 IDs including the pack's `nacha.non-empty-source`: 11 + 36 + 5 accounts for all of them. **47 existing IDs are mapped for reuse, but only 11 are invoked by the independent hooks.** The other 36 are not newly integrated. External business requirements are listed separately and are not counted as implemented rules.

Implementation: [`src/parsers/nacha-r2-additional-sec.ts`](../src/parsers/nacha-r2-additional-sec.ts). Tests: [`tests/nacha-r2-additional-sec.test.ts`](../tests/nacha-r2-additional-sec.test.ts). Synthetic files: [`tests/fixtures/nacha-r2-sec`](../tests/fixtures/nacha-r2-sec).

## Authority and access limitations

The governing authority is the **2026 Nacha Operating Rules and Guidelines**, including applicable amendments. The authenticated, current subscription edition was **not accessible**. The official [2026 online product page][Subscription] requires a subscription code. No account was created and no purchase was made.

A third-party-hosted January 15, 2026 print export labelled *2026 Nacha Operating Rules Online* was downloaded and inspected for relevant clauses. It is corroboration, **not verified access to the current official edition**. Some wide tables are clipped. The export is not committed or redistributed. SHA-256: `1f7e2bae1130996cdfbdcf227fe3f13934ef537e1eee64f2f29d5f6d7ed0c7c0`.

| Key | Source actually consulted | Use and limitation |
| --- | --- | --- |
| R2026 | [2026-labelled print export][Mirror]; canonical [Appendix One][A1], [Appendix Two][A2], [Appendix Three][A3] | Relevant sections reviewed, not full-book/current-supplement certification: A1.4; A2.5/R19/R25/R26/R35/R36; A3.1.5/6/8/14 and A3.2.2. |
| ND | Nacha Developer Guide [details][Details] and [overview][Overview] | Official public descriptions, shared structures, ordinary direction and service classes; detailed new layouts cross-checked elsewhere. |
| NR | [Nacha ISO rejected-items guide, August 2023][Reject] | Printed pp.86–88, R19/R25/R26/R35/R36. Historical R36 WEB listing is not applied to WEB or used to change existing rules. |
| NM | [Nacha ISO returns guide, August 2023][Returns] | Printed p.45 identifies CIE field swap and POP subdivisions inherited from the original entry. Not a substitute for forward-entry inclusion requirements. |
| NA | [Nacha Payment Initiation API documentation][API] | Printed p.3 identifies mandatory CIE 22-character payer ID; p.2 identifies service-provider name. API product restrictions are not universal file rules. |
| N18 | [Nacha-authored Supplement #2-2018, bank-hosted][Supplement] | Indexed text, pp.19–22, detailed R26 edits and addenda limits. Direct re-fetch returned 404; historical corroboration only. |
| FR | [FedPayments Reporter fundamentals][FedEDI], slide22; [FedACH return-input instructions][FedReturns], p.4 | CIE single addenda, check serial and POP terminal field identity/necessity. Return-input instructions do not independently establish all forward requirements. |
| FT | [Treasury 2016 proposed rulemaking][Treasury], pp.20–21 | Explains original forward POP subdivisions. Historical structural corroboration, not a new 2026 rule. |
| WP | [Worldpay EMD V2.30, July 2025][Worldpay], printed pp.408–409, tables5-5/5-6/5-8 | Conversion serial, optional names/discretionary data and POP positions. Its inconsistent CIE table is not followed. |
| NT | [Northern Trust ACH return-code reference][NorthernTrust], R26 | Indexed bank-authored corroboration of blank/zero ID/serial/terminal errors; direct fetch unavailable. |
| REV | [Nacha Reversals and Enforcement][Reversals] | Official declaration and retained SEC/company ID/amount; original matching remains external. |
| OFF | [GIB ACH submission documentation][Offsets], balanced-file section | Evidence of same-batch internal offsets in customer submissions. Bank policy, not a general Nacha exemption. |

KeyBank's indexed toolkit and Santander's indexed import guide were comparative corroboration only: live URLs redirected/failed. No bank's checking-only product restriction, offset naming convention or blank discretionary-field policy becomes a universal ERROR.

## Record interpretation

Positions are **one-based inclusive columns** in a 94-character record. `BH` = type-5 Batch Header; `ED` = type-6 Entry Detail; `AD` = type-7 addenda.

| SEC | ED40–54 | ED55–76 | ED77–78 | Forward addenda |
| --- | --- | --- | --- | --- |
| CIE | Individual name, required; 15 characters | Payer ID known to biller, mandatory; 22 characters | Optional discretionary data | Zero or one, type 05 |
| ARC | Check serial, mandatory; 15 characters | Optional name/reference | Optional discretionary data | None |
| BOC | Check serial, mandatory; 15 characters | Optional name/reference | Optional discretionary data | None |
| POP | Serial40–48; city49–52; state53–54, all mandatory | Optional name/reference | Optional discretionary data | None |

Sources: NM p.45; NA p.3; WP pp.408–409; FR; R2026 A1.4 and A3 cited subparts. `Required` and `Mandatory` retain source classifications; both require population here, without claiming identical ACH-operator rejection treatment.

## Four new rules implemented

**Unknown entry types and unresolved bank-offset roles make dependent SEC checks incomplete, with no PASS or ERROR from those checks.** The direction warning identifies the offset ambiguity. Aggregation must preserve incomplete evidence even if another occurrence passes.

| SEC code | Rule ID | Rule name | Requirement | Enforcement, including positions | Source | Severity | Exceptions | Test cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CIE | `nacha.cie-identification` | Biller-recognized payer ID | Supply a payer ID; an all-space or all-zero field is invalid. | ED55–76 nonblank and not entirely `0`. Name is separately ED40–54. | NA p.3; NM p.45; N18/NT R26; R2026 A2.5/R26, A3.1.8 | ERROR | Preserve alphanumeric content, punctuation, leading zeros and internal spaces. Type/role uncertainty suppresses evaluation. | Blank/22 zeros fail; full22-character `000…A` and `INV-1/2` pass; missing name fails separate existing rule. |
| ARC, BOC, POP | `nacha.check-serial` | Source check serial | Supply a serial; all spaces or all zeros are invalid. | ARC/BOC ED40–54; POP ED40–48. Reject wholly blank/zero-filled field. | FR p.4; WP tables5-5/6/8; N18/NT R26; R2026 A3.1.5/6/14 | ERROR | No digits-only, positive-integer, uniqueness or source-match inference. | Blank/full-width zeros fail; full15/9 characters, `A-123`, leading zeros pass; POP city/state remain separate. |
| ARC, BOC, POP | `nacha.check-amount-limit` | Conversion amount ceiling | Applicable conversion amount is at most $25,000.00. | ED30–39 integer cents compared with `2_500_000n`. | NR p.86/R19; R2026 A2.5/R19 | ERROR | Exactly ceiling passes. Nonnumeric amount/type/role uncertainty is incomplete. CIE has no such ceiling. | 1 and2,500,000 cents pass;2,500,001 and9,999,999,999 fail; zero prenote allowed; zero monetary amount fails shared rule. |
| POP | `nacha.pop-terminal` | Terminal city/state | Both fields populated and not all zeros. | Independently inspect ED49–52 and53–54; locate actual failing field. | FT pp.20–21; FR p.4; WP table5-8; N18/NT R26 | ERROR | Abbreviations allowed; no unsupported alphabetic-only regex/state allowlist. Actual location is external. | Blank/all-zero city/state each fail; `NYC1` and nonblank two-character state pass presence check. |

The zero test deliberately means the **entire fixed-width field**, matching the stated edit condition. It does not strip spaces to invent a stronger prohibition: a short `0` followed by permitted padding does not fail this particular check. This is not verification that the ID is genuine; tests fix the boundary explicitly.

## Eleven existing IDs reused in executable hooks

Hooks emit into the current parser-style `check`/`incomplete` interface. File/batch arithmetic stays with #76's integration. No redundant SEC-specific versions of these IDs are added.

| SEC code | Rule ID | Rule name | Requirement | Enforcement, including positions | Source | Severity | Exceptions | Test cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| All four | `nacha.entry-required` | Required entry fields | Populate account and CIE name at their actual positions. | ED13–29 all four; ED40–54 CIE; no required conversion name at55–76. | ND; NM; R2026 A3.1.5/6/8/14 | ERROR | Optional names may be blank; uncertain CIE type/role makes its name incomplete. | Empty account/CIE name fail; blank conversion names pass. |
| All four | `nacha.field-padding` | Alphanumeric alignment | Existing left justification on correct field boundaries. | Account13–29; CIE/ARC/BOC40–54,55–76; POP40–48,49–52,53–54,55–76; discretionary77–78. Nonblank field may not start with space. | ND overview; [existing review](NACHA_SOURCE_REVIEW.md); NM/WP boundaries | ERROR | Blank optional fields allowed. Uncertain SEC layout suppresses specific partitions. No blank-only77–78 rule. | `AB` discretionary passes; leading blank city/name fails at own columns. |
| All four | `nacha.entry-amount` | Amount by type | Monetary amount positive; prenote zero. | ED30–39 numeric; existing `ACH_ENTRY_TYPES` determines zero/positive. | NR/R19; [expanded register](ACH_ORIGINATION_EXPANDED.md) | ERROR | Unknown type incomplete. Zero remittance amount does not make the SEC/code valid. | Positive payment/zero prenote pass; zero payment/positive prenote fail; unknown type cannot PASS. |
| All four | `nacha.sec-transaction` | SEC/service direction | CIE ordinarily credit, conversion ordinarily debit; monetary reversals allowed. Service220/225 must match direction. | ED2–3, BH2–4, BH54–63. Service200 allowed. Remittance24/29/34/39/54 not valid for these SECs. | ND; NR R35/R36; REV; existing type sources | ERROR; WARNING for ambiguous mixed200 offset | Unknown service/type/malformed reversal incomplete. No `OFFSET` name exemption or new checking-only/loan ban. | Ordinary wrong-direction batch fails; declared reversal passes; mixed200 warns;220 debit/225 credit fails. |
| All four when declared | `nacha.reversal-marker` | Reversal declaration | Declared reversal marker uppercase. | BH54–63 includes `REVERSAL`; detect case-insensitively to prevent evasion. | REV | ERROR | No marker: absent, not PASS. Original purpose/history external. | `REVERSAL`, `XXREVERSAL` pass; `reversal` fails. |
| All four when declared or code 55 | `nacha.reversal-transaction` | Monetary reversal | Reversal monetary; loan debit55 requires marker. | ED2–3 and BH54–63, existing type meanings. | REV; NR/R35; expanded register | ERROR | Unknown type/malformed marker incomplete. Account's actual nature not inferred. | CIE reversal27/37/55 pass; reversal prenote and unmarked55 fail. |
| All four | `nacha.addenda-indicator` | Addenda presence | Indicator agrees with records; qualified conversion entries require0. | ED79 equals actual0/1; require0 for ARC/BOC/POP. | ND; R2026 A1.4/A2.5/R25; FR | ERROR | On ambiguous offsets generic mismatches still fail; SEC interpretation incomplete. |1 without records,2/space,0 with records, conversion1 fail. |
| All four | `nacha.addenda-count` | Addenda limit | CIE maximum1; conversion maximum0. | Count adjacent type-7 rows per ED; locate at ED79. | FR slide22; N18/R25; R2026 A1.4 | ERROR | Same cap for prenotes; return/NOC formats outside forward hook. | CIE0/1 pass,2 fail; conversion attached addenda fail even with indicator0. |
| CIE with addenda | `nacha.addenda-type` | Payment type | CIE forward addenda type 05. | AD2–3 exactly `05`. | R2026 A3.1.8; N18/NR R25 | ERROR | Absent addenda: no PASS. Conversion addenda fail count/indicator without passing layout checks. |05 passes;98/99/XX fail and suppress dependent layout. |
| CIE type 05 | `nacha.addenda-sequence` | Addenda sequence | Start 0001; retain shared sequential numbering. | AD84–87 numeric, equals adjacent index starting1; cap separately restricts CIE. | ND; R2026 A1.5/A3.1.8; NR/R25 | ERROR | Non05 incomplete; no record inapplicable. | First0001 passes;0002/non-numeric fails; second sequential record still fails count. |
| CIE type 05 | `nacha.addenda-link` | Parent linkage | Addenda identifies preceding entry. | AD88–94 numeric and equals ED88–94. | ND; NM; R2026 A3.1.8; NR/R27 | ERROR | Unknown parent sequence/non05 incomplete. | Correct link passes; altered suffix fails at AD88–94; invalid parent cannot PASS. |

## Existing shared R2 rules retained for registry integration

This section inventories **existing behavior, not a fresh requalification of every existing R2 restriction**. It documents the current parser and its source register. These checks are not reimplemented by the four SEC hooks. They must continue to run through PR #76's shared parser after integration; until then, the selectable R2 pack does not admit these four SECs. `ALL` means CIE, ARC, BOC and POP. Positions are one-based and inclusive: `FH` = file header, `BH` = batch header, `ED` = entry detail, `BC` = batch control, `FC` = file control.

Source keys below link to existing reviewed-source documentation; they do **not** claim this PR reviewed the licensed 2026 pages referenced by that earlier work. [B](NACHA_SOURCE_REVIEW.md) = existing base source review; [E](ACH_ORIGINATION_EXPANDED.md) = existing expanded source/fixture matrix; [R](ACH_ORIGINATION_R2.md) = existing R2 source review. Shared public references are [Nacha file overview](https://achdevguide.nacha.org/ach-file-overview) and [Nacha file details](https://achdevguide.nacha.org/ach-file-details). Current executable definitions are in [`src/parsers/nacha.ts`](../src/parsers/nacha.ts), with original/expanded/R2 metadata in the three `src/nacha*-coverage.ts` files. Where a test below describes an existing fixture, it is legacy regression evidence; applying that shared check to the new cohort remains dependent on registry integration.

**Inventory:** 42 base parser IDs + 5 expanded IDs + 4 R2 IDs = **51 parser IDs**; the configured `nacha.non-empty-source` rule makes **52 existing IDs**. Eleven are reused directly by the hooks and documented in the executable-rule table. The table below lists **36 other retained IDs**. The following table lists **5 existing IDs inapplicable to supported entries in this new cohort**. Thus 11 + 36 + 5 = 52; these counts do not imply 52 independently new rules or 52 checks executed on every file.

| SEC | Rule ID | Rule name | Requirement in plain English | Enforcement, including positions | Source | Severity | Exceptions / applicability | Test cases |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ALL | `nacha.framing` | Fixed record framing | Each record has 94 characters. The parser also imposes consistent input separators. | Full records; accepts concatenation or consistent LF/CRLF/CR with at most one terminal separator; rejects blank/short/long records. | [B](NACHA_SOURCE_REVIEW.md); overview | ERROR | Uniform separators and terminal-delimiter limits are retained parser policies, not newly established Nacha mandates. Failure stops field checks. | Existing `record-length-fail`, `crlf-pass`, `cr-pass`, `concatenated-pass`; mixed separators fail. |
| ALL | `nacha.ascii` | Admitted character set | Records use the parser's printable-ASCII input subset. | Every record column 1–94 must match U+0020–U+007E. | [B](NACHA_SOURCE_REVIEW.md); actual parser | ERROR | Retained encoding policy; this PR does not establish printable ASCII as the entire Nacha character repertoire. Failure stops downstream checks. | Existing `ascii-fail`, `bom-fail`; ordinary ASCII fixture passes. |
| ALL | `nacha.record-order` | Record sequence | A complete file contains ordered headers, entries/addenda, controls and padding. | Record type at column 1: one FH, nonempty 5/6/7/8 batches, one FC, then all-9 padding. | [B](NACHA_SOURCE_REVIEW.md); overview | ERROR | Envelopes must be trustworthy before field checks; orphan addenda/entries and missing controls fail. | Existing `order-fail`; valid multi-batch file passes. |
| ALL | `nacha.blocking` | Ten-record blocks | Complete the file in blocks of ten records. | Total record count, including 94-character all-9 padding, must be divisible by ten. | [B](NACHA_SOURCE_REVIEW.md); overview | ERROR | Count includes padding, which must follow FC. | Existing `block-padding-fail`, `padding-fail`; ten-record file passes. |
| ALL | `nacha.file-header` | Header constants and identifiers | Supply the retained header constants, routing destination and origin identifier. | FH 2–3=`01`; 35–40=`094101`; 34 uppercase letter/digit; 4 blank; 5–13 routing checksum/prefix; 14–23 nonblank. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Immediate origin is not forced to be a routing number; this PR does not requalify every destination policy. | Existing `file-constants-fail`; arbitrary populated origin identifier passes. |
| ALL | `nacha.creation-date` | File creation date | Creation date must be an actual calendar date. | FH 24–29 six digits `YYMMDD`; parser interprets years as 2000–2099. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Century interpretation is retained parser behavior; no live-date comparison. | Existing `file-date-fail`; leap-day boundary valid/invalid. |
| ALL | `nacha.creation-time` | File creation time | Optional creation time is blank or valid. | FH 30–33 four spaces or numeric `HHMM`, hours 00–23 and minutes 00–59. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Blank is permitted. | Existing `creation-time-isolated-fail`; blank and 2359 pass, 2400 fails. |
| ALL | `nacha.service-class` | Service class value | Use one of the retained origination service classes. | BH 2–4 must be `200`, `220` or `225`; direction reconciliation is separate. | [B](NACHA_SOURCE_REVIEW.md); overview | ERROR | Do not introduce a CIE-only-220 or conversion-only-225 requirement. ADV/280 remains out of scope. | Existing `service-class-isolated-fail`; 200/220/225 value tests. |
| ALL | `nacha.sec-code` | Batch profile selection | Select the SEC profile from each batch's own header. | BH 51–53; current parser admits only CCD/PPD/CTX/WEB/TEL, so four-SEC admission depends on #76 integration. | [B](NACHA_SOURCE_REVIEW.md); #74/#76 | ERROR for current unsupported code; integration pending | This table records required reuse, not completed activation. Unknown SEC must not make unevaluated SEC checks pass. | Existing `sec-fail`; pending parser-level mixed legacy/new SEC selection after #76. |
| ALL | `nacha.batch-required` | Required batch identifiers | Company name, company identifier and entry description are populated. | BH 5–20, 41–50 and 54–63 use a nonblank check. | [B](NACHA_SOURCE_REVIEW.md), [E](ACH_ORIGINATION_EXPANDED.md); details | ERROR | R2 permits declared reversals; this is presence checking, not external identifier verification. Existing check does not reject all-zero values. | Existing `batch-required-fail`; populated identifiers and reversal batch pass. |
| ALL | `nacha.effective-date` | Effective entry date | Effective date must be an actual calendar date. | BH 70–75 numeric `YYMMDD`, interpreted in 2000–2099. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | No processing window, holiday or settlement determination. | Existing `batch-date-fail`; valid dates pass. |
| ALL | `nacha.effective-weekend` | Weekend advisory | Flag a valid effective date on Saturday/Sunday for review. | BH 70–75 parsed calendar weekday. | [B](NACHA_SOURCE_REVIEW.md); actual parser | WARNING | Invalid prerequisite date produces incomplete evaluation; weekend is an advisory, not proof the file is prohibited. | Existing `effective-weekend-warning`; weekday passes; malformed date is incomplete. |
| ALL | `nacha.settlement-date` | Operator settlement field | A populated settlement field must have valid Julian syntax; its presence warrants review. | BH 76–78 blank or three digits in 001–366. Valid nonblank value additionally warns. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR for syntax/range; WARNING for valid populated value | Blank permitted; field presence does not establish settlement. | Existing `settlement-date-invalid-fail`, `settlement-date-warning`; blank passes. |
| ALL | `nacha.originator-status` | Originator status | Preserve the existing origination status requirement. | BH 79 must be `1`. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Existing admitted-profile restriction, not a new claim about every governmental or specialized ACH originator. | Existing `originator-status-isolated-fail`; `1` passes. |
| ALL | `nacha.odfi` | Originating routing prefix | ODFI identifier must have the retained routing-prefix syntax. | BH 80–87 eight digits, not all zero; prefix ranges 00–12, 21–32, 61–72 or 80. | [B](NACHA_SOURCE_REVIEW.md), Treasury source cited there | ERROR | No directory membership lookup; eight digits do not contain the ninth checksum digit. | Existing `odfi-isolated-fail`; accepted nonzero prefix passes. |
| ALL | `nacha.batch-number` | Batch numbering | Preserve numeric, positive, strictly increasing batch numbers. | BH 88–94 parsed integer greater than prior batch number; initial comparison is zero. | [B](NACHA_SOURCE_REVIEW.md); actual parser | ERROR | Gaps permitted. Positive-first restriction is retained behavior, not newly verified authority. | Existing `batch-number-isolated-fail`; increasing gaps pass; zero/duplicate/decrease fail. |
| ALL | `nacha.transaction-code` | Recognized transaction type | Interpret the existing R2 code dictionary before dependent checks. | ED 2–3: 22/27/32/37/52/55 monetary; 23/28/33/38/53 prenote; 24/29/34/39/54 remittance. | [E](ACH_ORIGINATION_EXPANDED.md); `nacha-entry-types.ts` | ERROR for current unrecognized code; hook reports dependent checks incomplete | Recognition alone does not make a code valid for a SEC. Registry integration must preserve unevaluated status for unresolved account-code combinations; no new GL code prohibition is researched here. | Existing `transaction-code-fail`; recognized code families; unknown code suppresses dependent hook PASS. |
| ALL | `nacha.routing` | Receiving routing syntax | Receiving routing number must satisfy numeric, prefix and checksum checks. | ED 4–12 nine digits; 4–11 nonzero permitted prefix; weighted 3/7/1 checksum divisible by ten. | [B](NACHA_SOURCE_REVIEW.md); details; Treasury source cited there | ERROR | No bank existence/directory verification. | Existing `routing-numeric-fail`, `routing-prefix-fail`, `routing-check-digit-fail`; known synthetic routing passes. |
| ALL | `nacha.trace` | Trace structure | Preserve 15-digit trace with matching ODFI and positive suffix. | ED 80–94 numeric; 80–87 equals BH 80–87; ED 88–94 greater than zero. | [B](NACHA_SOURCE_REVIEW.md); actual parser | ERROR | Positive-suffix restriction is retained implementation, not newly verified in this PR. | Existing `trace-prefix-fail`, `trace-sequence-fail`; matching prefix/positive suffix passes. |
| ALL | `nacha.trace-order` | Trace sequence order | Preserve strictly increasing suffixes within each batch. | ED 88–94 numeric greater than previous suffix, initial value zero; resets per batch. | [B](NACHA_SOURCE_REVIEW.md); overview; actual parser | ERROR | Gaps permitted; zero-first implication retained and not requalified. | Existing `trace-order-isolated-fail`; ascending nonconsecutive suffixes pass. |
| ALL | `nacha.trace-unique` | In-file trace uniqueness | Entry traces may not repeat within the admitted file. | Exact ED 80–94 string tracked across all batches. | [B](NACHA_SOURCE_REVIEW.md); overview | ERROR | No historical or cross-file duplicate detection. | Existing `trace-unique-isolated-fail`; same suffix with different ODFI prefixes differs. |
| ALL | `nacha.batch-mirror` | Matching batch identifiers | Control identifiers match their batch header. | BC 2–4=BH 2–4; BC 45–54=BH 41–50; BC 80–94=BH 80–94. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Exact field equality; control finding uses a contextual location. | Existing `batch-control-mirror-fail`; unchanged mirror passes. |
| ALL | `nacha.batch-count` | Batch record count | Batch count equals its entry and addenda records. | BC 5–10 numeric equals count of records 6 and 7 in that batch. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Header/control/padding excluded. | Existing `batch-control-count-fail`; CIE addenda contributes one record after integration. |
| ALL | `nacha.batch-hash` | Batch routing hash | Batch hash equals the prescribed truncated routing-prefix sum. | BC 11–20 numeric equals sum of ED 4–11 modulo 10,000,000,000. | [B](NACHA_SOURCE_REVIEW.md), [E](ACH_ORIGINATION_EXPANDED.md); details | ERROR | R2 marks incomplete if a prefix is nonnumeric; numeric prefix still contributes even if checksum fails. | Existing `batch-control-hash-fail`, `hash-wrap-pass`; nonnumeric prefix is incomplete. |
| ALL | `nacha.batch-debit` | Batch debit total | Debit total equals interpretable debit entry amounts. | BC 21–32 numeric compared with exact integer-cent sum of ED 30–39 for known debit codes. | [B](NACHA_SOURCE_REVIEW.md), [E](ACH_ORIGINATION_EXPANDED.md); details | ERROR | Incomplete when any amount/direction cannot be interpreted. Debits need not equal credits. | Existing `batch-debit-isolated-fail`; valid unbalanced batch passes. |
| ALL | `nacha.batch-credit` | Batch credit total | Credit total equals interpretable credit entry amounts. | BC 33–44 numeric compared with exact integer-cent sum of ED 30–39 for known credit codes. | [B](NACHA_SOURCE_REVIEW.md), [E](ACH_ORIGINATION_EXPANDED.md); details | ERROR | Same prerequisite as batch debit total; no balancing requirement. | Existing `batch-control-totals-fail`; valid credit-only batch passes. |
| ALL | `nacha.reserved` | Reserved control fields | Shared reserved control fields contain spaces. | BC 74–79 and FC 56–94 all spaces. Existing CTX ED 75–76 branch remains CTX-only. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Do not treat CIE discretionary 77–78 as reserved; SEC-specific layouts govern entry fields. | Existing `reserved-isolated-fail`; spaces pass; new-hook CIE populated discretionary data passes. |
| ALL | `nacha.file-batches` | File batch count | File count equals complete batches. | FC 2–7 numeric equals parsed complete batch count. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Trusted envelopes required. | Existing `file-control-batches-fail`; mixed batch file counted correctly. |
| ALL | `nacha.file-blocks` | File block count | File count equals complete ten-record blocks. | FC 8–13 numeric equals total records / 10; requires count divisible by ten. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Padding included; complements `blocking`. | Existing `file-control-blocks-fail`; correctly padded file passes. |
| ALL | `nacha.file-count` | File entry/addenda count | File count equals all entry and addenda records. | FC 14–21 numeric equals sum of actual batch records 6/7. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Batch/file headers, controls and padding excluded. | Existing `file-control-count-fail`; multi-batch count passes. |
| ALL | `nacha.file-hash` | File routing hash | File hash equals truncated sum of routing prefixes across batches. | FC 22–31 numeric equals sum of actual batch hashes modulo 10,000,000,000. | [B](NACHA_SOURCE_REVIEW.md), [E](ACH_ORIGINATION_EXPANDED.md); details | ERROR | Incomplete if any required routing prefix is nonnumeric. | Existing `file-control-hash-fail`, `hash-wrap-pass`; malformed-prefix suppression. |
| ALL | `nacha.file-debit` | File debit total | File debit total equals all interpretable debit amounts. | FC 32–43 numeric compared to exact sum of actual entry debit cents. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Incomplete if any amount/direction is uninterpretable; equality to credit total not required. | Existing `file-debit-isolated-fail`; unbalanced mixed file passes. |
| ALL | `nacha.file-credit` | File credit total | File credit total equals all interpretable credit amounts. | FC 44–55 numeric compared to exact sum of actual entry credit cents. | [B](NACHA_SOURCE_REVIEW.md); details | ERROR | Same prerequisite as file debit total. | Existing `file-control-totals-fail`; valid multi-batch credits pass. |
| ALL, conditionally | `nacha.description-case` | Standard descriptor case | Preserve uppercase validation for declared standardized descriptors. | BH 54–63 recognizes existing marker substrings case-insensitively, requires uppercase field; PAYROLL must start at54. | [R](ACH_ORIGINATION_R2.md); actual parser | ERROR | Runs only for recognized declarations. Existing substring/suffix behavior is not newly qualified for four SECs here. | Existing R2 `origination-payroll-case-fail`, `origination-healthcare-case-fail`; uppercase REVERSAL valid. |
| ALL, conditionally | `nacha.description-sec` | Existing descriptor compatibility | Preserve existing R2 descriptor checks without representing them as newly researched four-SEC rules. | Current code requires declared HCCLAIMPMT to be CCD; PAYROLL entries PPD credits; PURCHASE entries WEB/TEL debits (BH51–63/ED2–3). | [R](ACH_ORIGINATION_R2.md); actual parser | Existing ERROR behavior; no new enforcement added | Known SEC/type required; purpose and standing authorization unverified. Existing PAYROLL/PURCHASE assumptions are separate review work, including #69, which this PR does not modify. Integration must explicitly decide applicability; this hook does not execute this ID. | Existing R2 descriptor regression fixtures; no new SEC inference from absent descriptor. |
| ALL | `nacha.non-empty-source` | Source contains data | Selected source contains at least one character. | Configured pack rule over whole source after parser context admission. | `src/format-packs.ts`; [B](NACHA_SOURCE_REVIEW.md) | ERROR | Tool policy, not a separate Nacha record rule. No invented PASS when framing prevented context. | Existing `empty-fail`; complete synthetic file contains data. |

### Existing IDs not applicable to accepted four-SEC entries

These remain active where appropriate in CCD/PPD/CTX/WEB/TEL batches of a mixed file. Their absence from CIE/ARC/BOC/POP evaluation must remain not-applicable (or incomplete if prerequisites are unknown), never a synthetic PASS.

| SEC | Rule ID | Rule name | Requirement / enforcement, including positions | Source | Severity | Exceptions / applicability | Test cases |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WEB only; none of the four | `nacha.web-credit-originator` | WEB credit originator | For WEB credit, ED40–54 identifies the consumer originator. CIE uses a different layout and its own ID requirement. | [B](NACHA_SOURCE_REVIEW.md); Nacha details | ERROR when applicable | WEB debit is not applicable; unknown WEB type incomplete. | Existing `web-credit-id-fail`; CIE batch must not trigger or PASS this check. |
| CTX only; none of the four | `nacha.ctx-remittance` | CTX remittance syntax | Reassembled type 05 payload columns4–83 checked for X12 BPR/BPS and envelope references/counts. | [E](ACH_ORIGINATION_EXPANDED.md) | ERROR when applicable | Not a CIE X12 validator; unsupported CTX syntaxes retain existing handling. | Existing CTX payload regressions; CIE optional type 05 must not run CTX grammar. |
| Healthcare CCD only; none of the four | `nacha.healthcare-addenda` | Healthcare addenda | Declared HCCLAIMPMT CCD non-prenote requires ED79=1 and associated addenda. | [R](ACH_ORIGINATION_R2.md) | ERROR when applicable | Prenote exception; unknown type incomplete. | Existing healthcare pass/missing/prenote fixtures; non-CCD not-applicable here. |
| Healthcare CCD only; none of the four | `nacha.healthcare-trn` | Healthcare reassociation | Declared healthcare CCD payload4–83 checked for complete TRN segment with trace type1, trace and originator ID. | [R](ACH_ORIGINATION_R2.md) | ERROR when applicable | Prenotes exempt; missing/uninterpretable payload incomplete; not full835 validation. | Existing healthcare TRN failure; CIE payload must not run healthcare grammar. |
| Valid remittance CCD/CTX or liveCTX; none of the four | `nacha.remittance-required` | Required remittance | ED79/addenda existence checked for known zero-dollar remittance codes or non-prenote CTX. | [E](ACH_ORIGINATION_EXPANDED.md) | ERROR when applicable | CIE/ARC/BOC/POP do not acquire remittance eligibility from a code alone. Their valid monetary/prenote entries do not require addenda under this ID. | Existing remittance-required failures; four-SEC prenotes with no addenda must not synthesize PASS. |

## Twelve restrictions deliberately excluded or deferred

These are decisions, **not registered or passing Wizard rules**. Rejected assumptions are not portrayed as Nacha mandates.

| Ref | SEC | Candidate check / Wizard ID | Requirement and decision | Field | Source/exception | Severity/status | Test/review scenario |
| --- | --- | --- | --- | --- | --- | --- | --- |
| X01 | CIE | Complete X12 payload validation; no ID | CIE information described as X12 segments; complete authoritative syntax/usage contract not obtained. Check outer structure only. | AD4–83 | R2026 A3.2.2; FR | Deferred, no semantic PASS | Optional blank and plausible `N1` example; no claim arbitrary text semantically valid. |
| X02 | ARC/BOC/POP | Checking-only codes; no ID | Bank lists 27/28 do not establish a universal 37/38 ban. | ED2–3 | Bank guides vs generic meanings | Eligibility not file-verifiable; no new ERROR | Savings direction tests do not prove check eligibility. |
| X03 | All four | Fixed service class by SEC; no ID | No proved CIE220-only or conversion225-only mandate. | BH2–4 | ND; REV | Rejected assumption | Normal entries in200 pass; actual220/225 direction conflicts fail. |
| X04 | All four | Digits-only ID/serial; no ID | No positive-number/uniqueness/numeric-only requirement established. | ED40–76 as applicable | NM, NA, WP | Rejected assumption | Letters, punctuation, leading zeros preserved. |
| X05 | ARC/BOC/POP | Mandatory receiver name; no extra ID | Names are optional. | ED55–76 | WP; R2026 A3.2.2 | Rejected assumption | Blank names pass; Garrett has generic false positive. |
| X06 | All four | Blank-only discretionary data; no ID |77–78 is optional ODFI-defined data. | ED77–78 | WP; R2026 A3.2.2 | Rejected assumption | `AB` passes. |
| X07 | POP | Alphabetic city/USPS allowlist; no ID | No qualified stronger restriction than presence/nonzero field. | ED49–54 | FT, FR, WP | Stronger rule deferred; location external | `NYC1`/`ZZ` pass presence only. |
| X08 | ARC/BOC/POP | Unconditional MICR account regex; no ID | Source-capture formatting depends on original capture/corrections; NOC implications unresolved. | ED13–29 | R2026 A3.2.2/Article2 | Applicability deferred, no new hard regex | Numeric synthetic fixture accounts; existing presence/padding retained. |
| X09 | All four | Automatic `OFFSET` exemption; no ID | Name/balancing total cannot prove bank-internal offset. | Mixed batch | OFF bank policy only | WARNING plus incomplete, never exemption | Opposite mixed200 entry with blank serial/ID and aggregate over25k avoids false SEC-field ERROR. |
| X10 | CIE | Mandatory biller in discretionary header; no ID | Described semantics do not override optional inclusion. | BH21–40 | R2026 A3.2.2 | No general ERROR; identity external | Blank discretionary header remains allowed. |
| X11 | All four | SEC-name descriptor/BOC phone in header; no ID | No general mandate for literal `CIE`/`ARC`/`BOC`/`POP` description or BOC phone here. | BH54–63 | ND; R2026 phone obligation concerns notice | Rejected assumption | Freeform `PAYMENT` permitted by new hooks. |
| X12 | CIE | All-zero name prohibition; no ID | R26's cited name edit lists other SECs; keep CIE nonblank requirement only. | ED40–54 | N18/NT R26 | Rejected assumption |15 zero name not rejected by new ID rule. |

General-ledger codes 42/43/47/48 are **not claimed prohibited by Nacha**. They are outside the unchanged shared R2 type table; these hooks mark dependent checks incomplete. Registry integration must preserve truthful unsupported/incomplete handling or separately qualify them, without silently changing the old five SECs.

## Requirements not verifiable from this file alone

| SEC | External requirements investigated | Retained file evidence | Why no file-only ERROR/PASS |
| --- | --- | --- | --- |
| CIE | Consumer instruction/bill-payment relationship; payer/payee account classification; service-provider identity; identifier correctness in biller records; delivery of remittance information | Fields, code and outer addenda | Population does not prove identity, authority or correct posting. NA/ND; R2026 Article2.5.4. |
| ARC | Notice; collection channel; eligible signed check; MICR capture and original amount/serial; retention; duplicate paper presentment/returns | Serial, ceiling, routing syntax, totals | Original check, notice and history absent. R2026 Article2.5.1; [Nacha return guidance][Authorization]. |
| BOC | Notice/copy; actual back-office conversion; source eligibility; identity procedures; working service phone; retention and presentment | Conversion fields and arithmetic | Operational evidence absent. R2026 Article2.5.2; phone need not be encoded here. |
| POP | Notice/authorization; point-of-purchase context; eligible source; capture; voiding/returning check; receipt; transaction/location/prior use | Serial, terminal fields, ceiling | Receipt and check absent. POP source need not itself be completed/signed; do not infer signature failure. R2026 Article2.5.10; FR/FT. |
| All four | Reversal reason/deadline/original SEC-company-ID-amount match; cutoffs/holidays; bank acceptance; account existence; cross-file duplicates | Marker, monetary type, dates/current-file controls | REV needs original/history evidence; no invented business-authorization PASS. |

## Garrett comparison: discovery only

The supplied `Garretts NACHA Validator ORIGINAL.html` was read completely; pure `parse`/`validate` functions were executed locally against all 13 fixtures and four additional probes. Its generic entry map and `defFor` do not implement CIE/POP field differences.

| Probe | Garrett observed result | New independent hooks |
| --- | --- | --- |
| CIE zero ID; ARC zero serial; BOC $25,000.01; POP blank city | No errors for each malformed fixture | Intended new ERROR with exact field location |
| Ordinary CIE debit / ARC credit | No SEC-specific error | Wrong-direction ERROR absent reversal/offset ambiguity |
| CIE two addenda / POP type 05 | No SEC cap error | Addenda-count ERROR |
| Blank optional ARC/BOC/POP name | One generic required-name error each | Accepted by new layout hooks |

Garrett's synthetic Immediate Origin warning is outside this SEC comparison. Source anchors: `SEC_CODES`, `defFor`, `validateField`, `closeEntryChecks`, entry/addenda branches. Expected results come from the source register, not Garrett's behavior.

## Tests and remaining integration

**102 focused tests pass. Full suite: 48 files / 1,294 tests pass**, including all 1,192 pre-existing tests. TypeScript and production build pass. Build retains the bundle-size warning; no UI/bundle source changed. Thirteen synthetic ACH fixtures have reconciled controls. “Valid” means passing the implemented checks, not bank acceptance/full Rules certification.

Tests cover malformed fields; transaction/addenda restrictions; amount boundaries; prenotes/reversals; mixed200 offsets/unknown siblings; incomplete prerequisites; LF/CRLF/CR/concatenated locations; nine SECs together; unchanged CCD/PPD/CTX/WEB/TEL. They explicitly demonstrate that active R2 still rejects the four new SECs pending #76. Test-only dispatch is not production integration.

To finish #77 after #76:

1. Adapt the four named definitions to the actual registry and select per batch after shared framing/order checks. Do not create a competing registry.
2. Wire correct fields/addenda limits and existing/new IDs. Keep old five-SEC findings unchanged; merge these 11 hook checks into shared execution without duplicates.
3. Retain incomplete evidence across aggregation, even alongside a passing occurrence. Inapplicable/absent callbacks never create PASS. CIE payload semantics remain unevaluated.
4. Retain shared routing/count/hash/money controls; resolve unqualified account-type handling. Do not silently expand disputed `description-sec` behavior or PR #69.
5. Add four IDs to R2's normal inventory/metadata and four SECs to its pack only with dispatch. Run end-to-end engine tests and CI. No customer scope/depth labels, coverage notices or export fields.

**Merge blockers:** #76 registry and production dispatch; end-to-end inventory/applicability/engine validation after wiring; authoritative review if broader unresolved format/account-type coverage is desired. Official current 2026 Rules qualification has not been established. Keep PR #77 draft. No existing production rule was changed in this phase.

[Subscription]: https://www.nacha.org/products/2026-nacha-operating-rules-guidelines-online-resource
[Mirror]: https://static1.squarespace.com/static/685035b3f9e5372375f4defb/t/69695b504d1cd9149ff18f25/1768512336133/2026%2BNacha%2BOperating%2BRules%2BOnline.pdf
[A1]: https://nachaoperatingrulesonline.org/section/2026-nacha-operating-rules/2026-nacha-operating-rules_180
[A2]: https://nachaoperatingrulesonline.org/section/2026-nacha-operating-rules/2026-nacha-operating-rules_190
[A3]: https://nachaoperatingrulesonline.org/section/2026-nacha-operating-rules/2026-nacha-operating-rules_200
[Details]: https://achdevguide.nacha.org/ach-file-details
[Overview]: https://achdevguide.nacha.org/ach-file-overview
[Reject]: https://www.nacha.org/system/files/2023-08/NACHA_ISO20022_Guide_pain.002_reject%2008-09-23.pdf
[Returns]: https://www.nacha.org/system/files/2023-08/NACHA_ISO20022_Guide_camt.053_returns%2008-09-23.pdf
[API]: https://www.nacha.org/sites/default/files/2020-03/Payment%20Initiation%20Documentation%203.2.20.pdf
[Supplement]: https://www.unibank.com/assets/files/AUn7tIkC/NACHARuleSupplement2-2018.pdf
[FedEDI]: https://www.frbservices.org/wp-content/uploads/fedpayments-reporter-fundamentals.pdf
[FedReturns]: https://frbservices.org/binaries/content/assets/crsocms/forms/ach/return-instructions.pdf
[Treasury]: https://public-inspection.federalregister.gov/2016-28671.pdf?1480427186=
[Worldpay]: https://docs.worldpay.com/assets/pdf/Worldpay_EMD_File_Reference_Guide_V2.30.pdf
[NorthernTrust]: https://web-xp2i-pws.ntrs.com/online_support/inforpt/ach_return_codes.htm
[Reversals]: https://www.nacha.org/rules/reversals-and-enforcement
[Offsets]: https://dashboard.gibank-api.com/assets/doc/services/transactions-ach.html
[Authorization]: https://www.nacha.org/rules/differentiating-unauthorized-return-reasons
