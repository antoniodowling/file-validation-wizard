# ISO lexical and declaration corrections (issues #49 / #53)

## Scope and authority

All six existing ISO DEMO profiles retain their exact message namespaces and shallow
structural scope. No full XSD validation, transaction-count reconciliation, bank
acceptance, or approval flag is added. EDI behavior is unchanged by this ISO repair.

| Rule | Authority / decision | Implementation and evidence |
| --- | --- | --- |
| `iso.transaction-count-type` | The independent 2026-10-27 review reports each exact XSD's `Max15NumericText` as an `xs:string` restriction with `[0-9]{1,15}` and no whitespace-collapse facet. Validate parsed character data without application trimming. Fresh original-schema verification remains open below. | `src/parsers/iso.ts`; all six profiles in `tests/iso-lexical.test.ts`; optional independent schema oracle below. |
| `demo.xml-declaration` | [W3C XML 1.0 Fifth Edition](https://www.w3.org/TR/2008/REC-xml-20081126/), sections 2.6 and 2.8: processing instructions and XML declarations are distinct. Missing declaration remains advisory. | `saxes`' existing `xmldecl` event supplies document-level metadata through `parseXmlDocument` and `ValidationContext.xml`; the root-only `parseXml` API is retained. No source-prefix fallback or second parse. |

XML parsing/entity decoding and XML line-ending normalization remain authoritative.
The lexical check does not inspect raw XML markup: digit character references and
CDATA containing digits remain supported. MsgId behavior and namespace-mismatch
prerequisite reporting are unchanged; the latter belongs to issue #51.

## Reproduced before/after evidence

On the accepted pre-fix source, five existing ISO-related test files passed 66 tests.
The new six-profile matrix produced **60 failures / 114 passes**, demonstrating
whitespace acceptance and false declaration advisories. After the repair, the new
174 cases passed; the broader nine-file focused run passed **273 tests**.
These are implementation results, not a fresh schema oracle or bank approval.

Tests cover 1/15/16 digits, leading zeros, empty/alphabetic/nested/duplicate/foreign
namespace values, whitespace and character references, CDATA, declarations,
stylesheet/model processing instructions and declaration-like comments. Unsupported
XML versions/encodings and malformed declaration rejection remain covered.

## Original-source retrieval and open normative gate

On 2026-10-29, a direct publisher download for message 14346 returned HTTP 403,
including a browser user-agent and download-query variant. A distinct official
archive route, `https://www.iso20022.org/message-set/11/download`, also returned
403. The archive was located through the publisher's message catalogue. The web
retrieval service could identify the download but could not return ZIP bytes.
Further repetitive retries were stopped. No original schemas were reacquired and
no fresh exact-schema oracle result is claimed.

The six original SHA-256 values and publisher IDs from the review are pinned in
`scripts/verify-iso-numeric-type.py`. They remain review-reported hashes until that
script succeeds on the original files. This is an evidence gap, not evidence that
ISO schemas are globally unavailable. Obtain lawful publisher bytes or a
provenance-preserving copy, investigate any digest difference, then run:

```sh
python3 scripts/verify-iso-numeric-type.py /path/to/original-schemas
```

This optional developer script requires `lxml` and files named
`pain.001.001.03.xsd`, `pain.001.001.09.xsd`, `pain.001.001.13.xsd`,
`pain.008.001.02.xsd`, `pain.008.001.08.xsd`, and `pain.008.001.12.xsd`.
It checks exact hashes/namespaces, extracts the original simple type into a probe
schema, and validates boundary values with libxml2 XMLSchema independently of the
application regex. It reports processor versions, hashes and outcomes; missing
files, changed hashes or disagreements fail the command. It performs no network
requests and adds no browser/runtime dependency. Full schemas are not redistributed.

The application tests currently assert the documented review contract; they must
not be described as fresh independent original-XSD validation. Keep that part of
issue #53 open until the original-type oracle and source review are recorded.
