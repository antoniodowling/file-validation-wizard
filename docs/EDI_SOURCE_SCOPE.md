# EDI 820 version and transport scope

Issue #50 changes the EDI implementation ruleset to 2.1.0. Message editions and DEMO/approval flags are unchanged. This is a limited envelope validator, not complete X12 or bank conformance. The historical ruleset-2.0.0 snapshot remains immutable.

## Rule and source ledger

Sources were retrieved and independently reviewed on 2026-10-29. The public RFI pages identify their RFI/document IDs but do not provide an effective standards edition date or a licensed complete control specification. No full licensed standard is redistributed here.

Retrieved HTML SHA-256 receipts: RFI 1648 `e885633a578653dc035d33f6021f328d2edfa36cec34b077848104b6afff6f8b`; RFI 2207 `9b661150048d7177f8c7cacb928ff907d89c642d6b5f74dd8b96d406138d7e62`. These identify the reviewed retrieval, not a standards approval.

| Rule | Authority and exact source | Requirement versus implementation decision | Applicability and remaining gate |
| --- | --- | --- | --- |
| Interchange/group relationship | X12 [RFI 1648](https://x12.org/resources/requests-for-interpretation/rfi-1648-v3070-u277-bundled-w-5010-835), RFI Response | Groups must be the same version as or older than the interchange. Its concrete older-group example is 003070 within 00501. This contradicts 00501/008030 but does not establish a replacement 008030 pair. | The selected 008030 profile has no qualified pair and returns UNSUPPORTED/null verdict after otherwise successful structural checks. Exact release/control artifacts and applicable Huntington trading-partner approval remain missing. No 00803 mapping is inferred. |
| One-character CR or LF terminator | X12 [RFI 2207](https://x12.org/resources/requests-for-interpretation/rfi-2207-segment-delimiters), Document ID 5010, RFI Response; refers to X12.5 §§4.3/A.3.1 | CR and LF can be segment delimiters; partner agreements are separate. Admit each character individually for the standalone 005010 subset. | Other releases and combined CRLF/LFCR transport remain unqualified and yield UNSUPPORTED when structurally sound. This is containment, not a claim those forms are prohibited by X12. |
| Exact selected-version checks | Existing DEMO profile contract: 00401/004010 and 00501/005010 | Retain exact selected-profile checks. This is a deliberately bounded subset, not a general group/envelope compatibility matrix. | Recognizable six-digit older group releases within the selected retained interchange are UNSUPPORTED, not falsely described as source-invalid. This does not establish their full control/820 requirements. Other exact-profile mismatches retain FAIL. Full exact control artifacts and bank guides remain qualification gates. |
| Final termination and presentation spacing | Local tool transport policy, implementation revision 2.1.0 | Only space/CR/LF suffix characters are presentation whitespace, and the selected terminator itself is never stripped. Scanner spans refer to unchanged original decoded source. | A missing final delimiter fails even if earlier delimiters exist. Combined CRLF/LFCR with a newline delimiter is conservatively unsupported, including adjacent opposite newline suffixes. Tilde plus existing CR/LF presentation whitespace remains supported. |
| Failure precedence and scope | Local tool policy | Known structural/control failures remain FAIL. Scope qualification occurs only after those checks; 008030 never emits a successful version occurrence. Multiple interchanges are examined for malformed envelopes before returning unsupported. | Unsupported results discard occurrences and retain a specific executionReason in JSON with null verdict. Existing schema-2 CSV omits that reason; #51 owns the coordinated export correction. |

The independent source reviewer owns the public-source interpretation; implementation tests are evidence of behavior only. Closing the remaining source gate requires exact licensed control/release material and the applicable bank decision, not another passing synthetic test.

## Outcome matrix

| Selected profile | ISA12 / GS08 | Terminator | Otherwise structurally sound outcome |
| --- | --- | --- | --- |
| 004010 | 00401 / 004010 | tilde | Eligible for the retained DEMO subset checks |
| 005010 | 00501 / 005010 | tilde, single LF, or single CR | Eligible for the DEMO subset checks |
| 005010 | 00501 / 003070 or 004010 | tilde | UNSUPPORTED; older groups are permitted in principle but outside this exact-version subset |
| 008030 | 00501 / 008030 | tilde | UNSUPPORTED; known disputed pair cannot pass |
| 008030 | 00803 / 008030 or any other pair | admitted single character | UNSUPPORTED; no replacement pair is asserted |
| 004010 | 00401 / 004010 | CR or LF | UNSUPPORTED; this release's transport is unqualified |
| 005010 | 00501 / 005010 | combined CRLF/LFCR | UNSUPPORTED; no multi-character interpretation is inferred |
| Any | malformed ISA, missing final delimiter, nesting/count/control failure | any admitted transport | FAIL with the corresponding structural evidence |

`tests/edi-integrity.test.ts` uses literal pair expectations independent of the registry, exercises both disputed pairs, terminator/suffix/missing-terminator paths, multiple groups/transactions, complete/malformed second interchanges and CTX separation. Direct scanner tests verify original offsets. Existing resource bounds remain enforced.

CTX retains its existing independent version bypass and printable-ASCII transport boundary. Standalone CR/LF support does not qualify CR/LF within ACH payloads. ST03 guide rules, full 820 content, trading-partner acceptance and new business validation remain excluded. The 008030 sample deliberately retains the historical disputed pair to demonstrate UNSUPPORTED, not a positive conformance example.
