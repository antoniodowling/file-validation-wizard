# Phase 4 — Huntington File Received ACK source gate

**Current implementation:** The owner selected one uncustomized pipe-delimited sample scenario. That executable candidate supersedes the implementation hold below; source limitations remain qualification exclusions. See [HUNTINGTON_ACK_CANDIDATE](HUNTINGTON_ACK_CANDIDATE.md). The original assessment below is retained as dated source-review history.

Assessment 2026-10-14. [Huntington’s official page](https://developer.huntington.com/enterprisepayments/docs/file-received-ack-flat-file) is accessible. It explicitly identifies its sample as illustrative and implementation dependent, gives several possible delimiter choices and describes common field/status hints. It does not establish a normative wire contract. Connected exact-title documentation search found no additional source. No account registration, purchase or external message was attempted.

No ACK parser, executable profile, placeholder dropdown option or invented conformance fixture is added. The sample’s pipe grammar, `1.0` identifier and status strings are not assumed to be Huntington’s actual versioned contract. This is a source gate for this pack, not a failure of existing validators.

## Settled semantics

Standalone document validity is separate from the bank-reported disposition. A well-formed ACK reporting REJECTED may pass format validation. Neither that PASS nor RECEIVED/ACCEPTED establishes business acceptance, authorization, funding or settlement. Original-file matching, companion uploads and cross-file reconciliation remain excluded.

The owner-approved reported-disposition metadata/UI/JSON/CSV schema-3 work depends on a confirmed ACK contract. It remains deferred with the parser. Current schema-2 exports, columns, profile IDs and frozen historical interpretation are preserved. No schema version or successful reported disposition is invented for an unavailable format.

## Specification-owner questions (prepared, not sent)

1. Identify the normative ACK specification, version identifiers and effective dates. Which versions are active, and how does a document declare its version?
2. Specify encoding/character repertoire, byte/character interpretation, BOM, permitted line endings/terminal delimiters, blank/comment lines, exact delimiters and quoting/escaping for delimiters/newlines/quotes in text.
3. Give the exact record grammar: record tags, order, repeat counts, required/optional fields, field lengths/types, blank/missing values, file/batch scope and legal combinations. Are batch ACKs part of this standalone contract?
4. Give the complete active disposition/severity/reason vocabularies, case rules and meanings. Specify how multiple scope statuses are represented without conflating them with document validity.
5. Specify timestamp format, timezone and precision; identifier constraints; count/hash/checksum syntax and trailer rules. Distinguish same-document integrity checks from unavailable original-file facts.
6. Provide approved synthetic fixtures for accepted, rejected, warning, optional-batch and malformed documents, including escaping/framing/resource boundaries and expected findings. Valid rejected ACK fixtures must be distinct from malformed ACK fixtures.

Once those sources are confirmed, the revision can implement optional reported-disposition metadata and append CSV columns using export schema 3 while preserving historical schema-2 semantics. Qualification still requires independent rule/fixture review, engineering checks, actual hosted ReadMe acceptance and genuine Product/SC/FT/rules/fixture approvals. No production deployment or activation is authorized or claimed.
