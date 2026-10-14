# Huntington ACK candidate: one uncustomized pipe scenario

Profile: `huntington-ack-pipe-1.0-candidate-r1`. This is a runnable local candidate based on Huntington's public [File Received ACK Flat File](https://developer.huntington.com/enterprisepayments/docs/file-received-ack-flat-file.md), updated August 10, 2026. The page explicitly calls its sample illustrative and says fields/codes may vary. These scenario choices fill in missing grammar; they are not claims that Huntington requires these rules for every customer. No owner-specific contract, bank acceptance or production qualification is established.

## Admitted grammar and local decisions

The engine provides UTF-8 decoding. This parser admits LF and CRLF (either may appear), optional final newline, blank lines and full-line `#` comments. It rejects BOMs, bare CR, tabs and other control characters. Pipes delimit fields; no quoting/escaping convention was supplied, so a literal pipe in a scalar cannot be represented. Unicode text is admitted. Whitespace-only lines are blank; record tags/constants otherwise match exactly. Sample padding in VAL severity (`ERROR  `) is trimmed for that field only.

Records follow this order:

1. Exactly one `HDR|ACK|1.0|FILE_RECEIVED_ACK|timestamp|UTC`.
2. One or more FIL records containing name/value pairs. Across records, keys are distinct and drawn from `InboundFileName`, `CorrelationId`, `OriginalFileSizeBytes`, `Transport`, `ChecksumAlgo`, `Checksum`. InboundFileName and CorrelationId are required; other pairs are optional. The optional size is nonnegative digits; other values are opaque populated text. Pair order/grouping may vary.
3. Exactly one `STA|FILE|status|qualifier`, optionally followed by `|ParserVersion|value` on that same record.
4. Zero or more `MSG|INFO/WARNING/ERROR|message` records.
5. Zero or more adjacent pairs `BAT|number|BatchRef|reference|RecordCount|count` and `STA|BATCH|status|qualifier`. Batch numbers are positive decimal strings, unique by exact spelling; ascending order is not required. Counts are nonnegative decimal strings. No BAT record requires another batch, and a file-only ACK is admitted.
6. Zero or more `VAL|WARNING/ERROR|LINE|number|Field: label|message` records. The source line is positive digits. Label/message must be populated.
7. Exactly one CTL containing each of `DeclaredRecordCount`, `ReceivedRecordCount`, `DeclaredHash`, `ReceivedHash` once, in any pair order, with nonnegative digit values.
8. Exactly one final `TRL|END|timestamp`. Comments/blank lines may follow the final data record.

Status is RECEIVED, ACCEPTED or REJECTED, with opaque populated qualifiers. Timestamps are real Gregorian calendar UTC times in `YYYY-MM-DDTHH:mm:ss[.sss]Z` form (one to three fraction digits); seconds 00–59, no offset alternatives/leap-second representation. Trailer time cannot precede header time when both parse successfully.

Unknown versions, statuses, tags, FIL keys, alternate delimiters or a different selected profile are UNSUPPORTED and receive no format verdict. Malformed syntax inside this scenario fails its syntax checks. MSG/VAL severity outside their local sets fails syntax. Findings are aggregated by rule with a count and first source row span; optional absent checks are not applicable. Structural failure suppresses reported disposition.

## Meaning and deliberate exclusions

`REJECTED` and a syntactically valid `VAL|ERROR` are bank-reported outcomes, not malformed ACK syntax. A valid rejection ACK can pass format validation. The optional `reportedDisposition` object preserves the file status/qualifier and complete batch status/reference pairs only after syntax succeeds. It never establishes business acceptance or payment execution.

CTL counts and hashes refer to the original submitted file, not the ACK's own records. Unequal declared/received counts or hashes are admitted syntax and may describe rejection. FIL size/checksum also describe the original file. This parser does not have original bytes and does not verify any of those assertions. The sample's abbreviated `c7b8...9f` checksum is admitted opaque text; no invented SHA256 64-hex rule applies. No numerical reconciliation, external correlation lookup, settlement, account, authorization or transport/security validation occurs.

## Bounds and evidence

The parser uses existing decoded-source/model/scalar limits: 8,000,000 UTF-16 units, 100,000 physical rows and 1,000,000 units per row, plus 32 fields per row and 100,000 combined modeled rows/fields/batch dispositions. Resource exhaustion is an incomplete run, not an ACK syntax verdict. Model state is linear in admitted rows/batches and findings are bounded by the eleven fixed rules. Pair maps use Map/Set and never assign untrusted keys to object prototypes. Source spans use original decoded-string offsets, preserving CRLF/comment offsets.

Focused tests cover the full sample, file-only records, rejection/errors, mismatched original controls, opaque checksums, grammar/order/fields, timestamps, unsupported profiles and resource limits. Synthetic syntax evidence is separate from any customer, hosted or bank acceptance.
