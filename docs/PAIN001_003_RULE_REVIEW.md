# PAIN.001.001.03 rule review

Reviewed 2026-11-18 against `181dd49a67b564f6b8a3468f519370b65ab5892b`.
The retained `.03` profile in draft PR #66 has the same ISO parser, adapter,
coverage and pack-rule predicates as that baseline.

The `.03` correction uses ruleset **2.3.0**; the other five ISO profiles keep
their existing behavior and **2.2.0** provenance. Published snapshots and source
fixtures remain historical evidence. This record does not establish full ISO
conformance, Huntington acceptance, hosted compatibility or release approval.

## Authoritative evidence

| Source | Use |
| --- | --- |
| [Original ISO `.03` XSD](https://www.iso20022.org/message/14316/download), obtained through the [ISO archive](https://www.iso20022.org/catalogue-messages/iso-20022-messages-archive?search=pain.001.001.03) | Exact message namespace, structure, occurrence counts and scalar types. |
| [Payments Initiation V03 message set](https://www.iso20022.org/message-set/11/download), *Payments — Maintenance 2009*, September 2009, printed pp.710–718 | Message structure and semantics, including MsgId identification/uniqueness and transaction-count meaning. |
| [W3C XML 1.0](https://www.w3.org/TR/2008/REC-xml-20081126/), §§2.1, 2.8; [Namespaces in XML](https://www.w3.org/TR/2009/REC-xml-names-20091208/) | Well-formedness, optional XML declarations and expanded element names. |
| [W3C XML Schema Datatypes](https://www.w3.org/TR/xmlschema-2/), §§4.3.1–4.3.3, 4.3.6 | Character-based length limits and preserved `xs:string` whitespace. |
| [OWASP XML guidance](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html) | Defensive DTD rejection; a tool policy rather than a universal ISO prohibition. |

The original `.03` XSD contains **45,859 bytes**. Its SHA-256 is
`6bb5c6f24250ab807f31f6164142bafd6d43bad8d162a926e258ff4c11e128af`, matching
the previously recorded digest. The XSD is not redistributed. The
[source receipt](evidence/pain001-03-2026-11-18/source-receipt.json) records
the independent verification and its limited scope.

## Decisions for all 11 registered checks

| Rule | Basis | Disposition |
| --- | --- | --- |
| `iso.safe-declarations` | Tool policy for untrusted XML. | Keep the protective block and `tool-policy` classification. |
| `iso.well-formed` | W3C XML syntax and namespace bindings. | Keep ERROR. Unsupported XML versions/encodings retain their separate input-support outcome. |
| `iso.document-root` | Global `Document` element. | Keep ERROR; record exact-schema support. |
| `iso.namespace-version` | Exact `.03` target namespace. | Keep ERROR for selected-profile mismatch; prefixes can vary. |
| `iso.message-container` | One `CstmrCdtTrfInitn` under `Document`. | Keep ERROR; its predicate does not validate all additional children. |
| `iso.group-header` | One `GrpHdr` under the message. | Keep ERROR. |
| `iso.message-id` | One `MsgId : Max35Text`, 1–35 XML characters. | Add the missing maximum. Preserve the existing nonblank requirement as an explicit local data-quality policy. |
| `iso.transaction-count-type` | One `NbOfTxs : Max15NumericText`, `[0-9]{1,15}`. | Keep the untrimmed lexical check. It does not reconcile transactions. |
| `iso.payment-information` | One or more `PmtInf` children. | Keep ERROR for absence; this does not validate payment contents. |
| `demo.non-empty-source` | Generic input handling, evaluated after parsing. | Retain executable behavior in this correction. Exclude it from substantive PAIN-rule counts; an earlier empty-input preflight is separate cleanup. |
| `demo.xml-declaration` | W3C recommends a declaration but permits omission. | Keep WARNING/advisory severity. Clarify `.03` wording: declaration presence does not prove an explicit encoding attribute. |

The six unchanged structural/numeric checks above have exact-schema support and
can be classified as scoped `iso-schema` checks. The MsgId rule additionally
contains the existing nonblank policy; its evidence must state both bases.

### MsgId boundaries and policy

The baseline only checked one scalar, nonblank value, so 36 characters passed.
The correction counts decoded Unicode characters, including spaces, rather than
UTF-16 storage units or a trimmed value. The existing blank-value ERROR is
preserved; deciding its eventual bank/profile severity is outside this repair.

The original XSD accepts whitespace-only `Max35Text`. This is a lexical fact:
it does not prove that such an identifier fulfills the MDR's identification and
agreed-period uniqueness purpose, or that a bank accepts it. The current
single-file rule does not establish cross-file uniqueness.

## Independent verification and baseline observations

The [oracle output](evidence/pain001-03-2026-11-18/oracle-output.json) records
**21 independent original-type cases**: 11 for `Max15NumericText` and 10 for
`Max35Text`, using lxml 6.1.1/libxml2 2.14.6. The latter includes empty text,
spaces, 35/36 characters and supplementary Unicode characters. To reproduce,
place the hash-matching publisher file at `<schema-directory>/pain.001.001.03.xsd`:

```sh
python3 scripts/verify-iso-numeric-type.py <schema-directory> \
  --version pain.001.001.03 --include-message-id
```

Without `--version`, the utility still requires all six original schemas.
Missing files, changed hashes and disagreements fail the command. The `.03`
receipt therefore resolves only that profile's source/type evidence in #53.

The [57 baseline probes](evidence/pain001-03-2026-11-18/baseline-probes.json)
compare the unchanged parser plus pack rules with the complete original XSD.
They are baseline review evidence, not correction-test or browser evidence.
All 20 count-focused probes agreed on the checked lexical/cardinality property.
Eleven deliberately selected cases passed every registered check while failing
the XSD; this is not a production error rate.

## Bounded follow-up scope

The bounded correction is tracked in [issue #81](https://github.com/antoniodowling/file-validation-wizard/issues/81).
Required payment content and transaction-count reconciliation are tracked in
[issue #80](https://github.com/antoniodowling/file-validation-wizard/issues/80).

| Gap demonstrated in the baseline | Proposed next work |
| --- | --- |
| Missing `CreDtTm`/`InitgPty`; empty `PmtInf`; no `CdtTrfTxInf` | Add exact-version required-field and nested-content checks with independent fixtures. |
| Reordered children, unexpected elements, extra foreign-namespace children | Add qualified sequence/content validation rather than weakening namespace matching. |
| Declared transaction count differs from the actual transactions | Add a separate semantic reconciliation rule. XSD validation alone does not establish this equality. |
| Control sums and detailed payment conditions are not evaluated | Define separate scoped rules; do not make optional fields mandatory without applicable evidence. |

The [Huntington guide](https://developer.huntington.com/enterprisepayments/docs/iso-pain001)
currently has examples whose namespace omits `.03`. Correct or version those
examples; keep exact profile matching. Bank/rail-specific requirements need
their own applicable source and must not be inferred from a generic example.

For testing, a current PASS means the implemented XML, version and selected
field checks passed. It does not validate the complete payment message or
reconcile its totals. Application test/build results belong to the exact
implementation commit's PR receipt and are separate from the source oracle.


## Follow-up: required structure and demo-rule retirement (ruleset 2.4.0 draft)

This **supersedes the older 2.3.0 current-runtime count and warning disposition**
earlier in this historical document. The original-XSD oracle receipts and 2.3.0
coverage snapshot remain unchanged. This change is a draft stacked on PR #82.

### Disposition of the prior 11 checks

- Remove `demo.non-empty-source` for .03: the XML parser already rejects empty
  input. For an entirely blank file, `iso.well-formed` now supplies a specific
  error instead of an unreachable duplicate check.
- Remove `demo.xml-declaration` for .03: an XML declaration is optional under
  XML 1.0. Its omission should not degrade PASS to PASS WITH WARNINGS.
- Keep `iso.well-formed` (`xml-syntax`) and `iso.safe-declarations`
  (`tool-policy`) unchanged in principle.
- Retain and classify the seven original `iso.*` structure/lexical checks
  as scoped `iso-schema` checks. `iso.message-id` combines the exact .03
  Max35Text limit with an explicitly identified nonblank quality policy.
- Leave the other five historical ISO profiles and EDI behavior unchanged.

### Twelve new .03 checks

| Rule ID | New required check | Scope / qualification |
| --- | --- | --- |
| `iso.creation-date-time` | `GrpHdr/CreDtTm` must be present and populated | Full ISODateTime lexical facets deferred |
| `iso.initiating-party` | `GrpHdr/InitgPty` is required | No invented requirement for optional nested party fields |
| `iso.payment-information-id` | Each `PmtInf` needs a 1–35-character `PmtInfId` | Exact .03 Max35Text |
| `iso.payment-method` | Each `PmtInf` needs `PmtMtd` (CHK, TRF, TRA) | PaymentMethod3Code |
| `iso.requested-execution-date` | Each `PmtInf` needs populated `ReqdExctnDt` | Full ISODate lexical facets deferred |
| `iso.debtor` | Each `PmtInf` needs `Dbtr` | No unconditional nested party-name requirement |
| `iso.debtor-account` | Each `PmtInf` needs `DbtrAcct/Id` with IBAN or Othr | Basic choice checks, not full account conformance |
| `iso.debtor-agent` | Each `PmtInf` needs `DbtrAgt/FinInstnId` | Basic structural checks |
| `iso.credit-transfer-transactions` | Each `PmtInf` needs at least one `CdtTrfTxInf` | Qualified transaction scope |
| `iso.credit-transfer-identification` | Each transaction needs `PmtId/EndToEndId` (1–35 chars) | Not full transaction schema |
| `iso.credit-transfer-amount` | Each transaction needs `Amt`, with one InstdAmt or EqvtAmt branch | Full decimal/currency facets deferred |
| `iso.transaction-count-reconciliation` | `GrpHdr/NbOfTxs` equals actual qualified transactions | No PASS where prerequisite transaction scope is missing |

Exactly 21 checks are registered for .03: two XML safety/syntax, seven retained
structure/lexical and twelve new. Changes do not assert full ISO schema
conformance, ordering, bank/rail conditions, optional control-sum reconciliation,
payment acceptance or cross-file uniqueness. In particular `CtrlSum`,
`Cdtr` and `CdtrAcct` are not made universally mandatory.

### Authority

- Original ISO .03 XSD: https://www.iso20022.org/message/14316/download
  (45,859 bytes; recorded SHA-256
  `6bb5c6f24250ab807f31f6164142bafd6d43bad8d162a926e258ff4c11e128af`).
  PR #82 independently verified the original schema and its positive fixture.
- Exact-version structure/type cross-reference:
  https://pain001.com/message-spec-pain.001.001.03/
  and https://pain001.com/message-spec-pain.001.001.03-types-2/
- Huntington ISO PAIN.001 guide:
  https://developer.huntington.com/enterprisepayments/docs/iso-pain001
  (family-level guidance, not a substitute for the exact original .03 XSD).
- Optional XML declaration: https://www.w3.org/TR/2008/REC-xml-20081126/

### Evidence and release gates

The synthetic positive in `tests/fixtures/pain001-03-schema-valid.xml` was
independently checked against the exact original publisher XSD in PR #82.
`tests/pain001-03-required.test.ts` adds field omissions, malformed nested
content, multi-block transaction counts, optional creditor cases, and
prerequisite non-evaluation regressions. Two new upload examples appear in
`demo-files/pain.001.001.03-*.xml`; all data is synthetic.

Current proposed immutable snapshot:
`docs/coverage/pain001-03-ruleset-2.4.0.json`.
Rebuild the snapshot at a **fresh path**, compare byte-for-byte, run
`npm run validate:core`, regenerate the ReadMe package, verify drift, and run
targeted browser tests. Obtain independent source and exact-head code review
before merging. These checks are **not yet claimed to have passed** on the new
stacked branch. No merge, deployment or publication is authorized by this draft.
