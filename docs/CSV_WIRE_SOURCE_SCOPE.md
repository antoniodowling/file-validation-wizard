# Huntington CSV Wire candidate scope

Profile/version: `huntington-csv-wire-public-2026-r1`. Rules/coverage revision: `huntington-csv-wire-candidate-1.0.0`. Mode: CANDIDATE. Export schema: 3. No production or bank acceptance is claimed.

## Authoritative source and revision

The [Huntington CSV Wire guide](https://developer.huntington.com/enterprisepayments/docs/wires-payments-automation) was located and read on 2026-10-14 through actual portal links: File Format Guides → BAI2 → SWIFT MT103 → MT940 → MT942 → ISO PAIN.001 US Fedwire → ISO PAIN.001 SWIFT → CSV Wire. Its slug was not guessed. The portal rendering reported “Updated 20 days ago”; an exact update timestamp and upstream semantic version were not verified. This profile is a dated local candidate revision, not an invented bank format version.

The [functional source extraction](sources/csv-wire-guide-extract.json) preserves all 54 domestic and 58 international field definitions, mandatory/optional flags, validation comments, format key and observed ambiguities. Its UTF-8 byte SHA-256 is `6fe82ba05375d5deb999713ed82b33b89347c6cbebbb3f8eae274d342c2a17cb`, embedded in run provenance. This is the digest of the local extraction, not an upstream HTML/Markdown digest. No full-guide archive or precise upstream revision is claimed. The source is not fetched at validation time.

Country membership uses the 249 ISO 3166-1 alpha-2 codes from [IANA's public-domain table](https://data.iana.org/time-zones/tzdb/iso3166.tab), locally read on 2026-10-14 and corroborated against the live table. The source header identifies 2025-07-01 and the 2024-02-29 ISO list. The original file digest is recorded in [the frozen code list](../src/parsers/csv-wire-countries.ts). Routing prefix/checksum logic reuses the existing local ACH utility; this does not establish live directory membership.

## Supported layouts and rules

| Area | Guide requirement | Candidate behavior |
| --- | --- | --- |
| Rows | One payment per row; USWIRE domestic and INT international | Exactly 54 USWIRE or 58 INT positional fields, including all trailing empty slots. Multiple/mixed qualified rows admitted; no totals/header/trailer invented. No automatic column mapping. |
| Quoting | Every field wrapped in double quotes | Every field, including empty fields, quoted. Commas inside fields are content. Doubled quotes escape a quote as a candidate convention. Source spans include original field quotes/escapes; lengths count decoded content. |
| Text | Cx printable-character maxima; M/O/N/A flags | Every C-field maximum, mandatory nonblank value and N/A empty field checked against its actual position. No trimming/normalization of submitted values. Domestic charges and both originator blocks remain empty. |
| Dates | Real YYYYMMDD; domestic and INT USD at most 30 days ahead | Capture UTC reference day once per run; verify calendar date and upper bound with integer day arithmetic. The date occurrence records the reference day in JSON/CSV. No past-date floor is invented. |
| Amounts | Domestic N18.2, international credit/debit N18.3; decimal point/digits and fewer than 18 significant figures | Exact lexical checks without floating-point conversion. At most 2/3 fractional digits, at least one on each side of point; leading zeros excluded and trailing fractional zeros counted as significant. Zero admitted because the guide specifies no positive minimum. International debit remains mandatory even if credit is provided. |
| Debit account | Mandatory 11-digit debit account | Exactly 11 digits, within the guide's C34 field. No actual account, entitlement or ownership lookup. |
| Domestic beneficiary | OTHER; name/account; city/country conditional on either address line | Exact OTHER and mandatory nonblank fields. Address line 1 or 2 requires city and country. All populated country fields use the frozen uppercase ISO list. |
| Domestic banks | Primary ABA; optional ABA intermediaries, valid 9-digit routing | Local routing shape, eligible nonzero prefix and checksum for primary and used intermediary codes, including the second intermediary. Optional code/type are paired as a disclosed candidate decision. Bank-populated descriptive fields do not acquire undocumented dependencies. |
| International subset | Credit currency; OTHER/IBAN; mandatory address/country, primary SWIFT/BIC, charges BEN/OUR | USD only; beneficiary country US or CA and account type OTHER. Mandatory fields and BEN/OUR checked. Primary BIC requires 11-character syntax and recognized country; populated bank country matches BIC characters 5–6. Optional ABA intermediary pairs admitted. |
| FX fields | Optional decimal FX rate with fewer than 10 significant figures; C16 contract ID | Rate syntax/significant digits and ID length checked. No fractional scale invented. FX Desk authorization, rate availability, contract existence and debit/credit conversion are excluded. |
| Reporting | Existing application contracts | Schema-3 coverage, exclusions and check states, JSON/CSV downloads, parser-owned UTF-16 source offsets or explicit row/file context. Repeated violations aggregate by rule with the first failing location and count; field values are not echoed in messages. |

## Ambiguities and unsupported scenarios

The explicit all-fields-quoted rule conflicts with both guide samples, which use bare empty slots; their debit account placeholders also contradict the numeric 11-digit rule. The candidate follows the explicit prose/table requirements. Those examples are not imported as passing conformance evidence.

International scheduling uses CAD +1 business day and other non-USD currencies +2 business days, without defining the bank calendar, timezone or holiday policy. IBAN-country applicability and the `S34` account format are not fully specified. International intermediary SWIFT/BIC is described as **13** characters, while the primary BIC requires **11**. No unsupported interpretation is silently substituted.

Non-USD international rows, IBAN account types, international beneficiary countries beyond US/CA, international intermediary SWIFT codes, unknown payment/header/custom-layout types and embedded field line breaks receive UNSUPPORTED: no verdict, no occurrences and all checks not evaluated. A syntactically malformed quoted/header input can fail admission before its scenario can be identified. An unsupported row makes the complete file unsupported, including when other rows are qualified.

Encoding and line framing are candidate decisions because the guide does not specify them: printable ASCII through strict UTF-8 decoding, no BOM/tabs/controls, comma separators, LF or CRLF (mixed admitted), optional one final separator, no blank rows or bare CR. Input is never normalized. Unicode text, alternative delimiters, spreadsheet conversion, customized import maps, encrypted/blocked transports and transmission integration are unqualified. Character/framing violations produce completed FAIL; invalid UTF-8 produces the existing incomplete decode failure.

Limits remain 25 MB uploaded bytes, 8,000,000 decoded units and the existing worker deadline. This parser adds at most 100,000 retained row/cell nodes, 64 cells per row and 1,000,000 original source units per field; resource exhaustion is incomplete, not a format verdict. No new dependency, network request, retention, storage, telemetry or account access was introduced. Selected-file processing and source navigation remain local.

Bank directories, valid real accounts, bank-populated names/addresses, authorizations, sanctions, FX economics, settlement, cutoff/business-day eligibility, duplicates, payment execution and bank acceptance are excluded. Passing the candidate does not establish complete CSV Wire conformance.

## Evidence and maintenance

The [23-file synthetic kit](../demo-files/csv-wire/README.md) contains domestic, international USD, mixed-row and quoted-content passes; malformed/field failures; and explicit unsupported cases. [Unit/integration tests](../tests/csv-wire.test.ts) cover fixture hashes, UTC boundaries with a fixed clock, exact decimal limits, conditional fields, routing/BIC rules, original CRLF coordinates, check suppression, worker decoding/resources and schema-3 exports. [Browser tests](../tests/browser/csv-wire.spec.ts) exercise input CSV upload, both mounts, PASS/FAIL/UNSUPPORTED, navigation, JSON/CSV downloads, replacement/decoding failures, request monitoring and screenshot attachments. Browser tests use synthetic data only.

`node scripts/generate-csv-wire-files.mjs` prepares this synthetic kit/manifest. `node scripts/export-csv-wire-coverage.mjs` prepares only [this coverage snapshot](coverage/csv-wire-candidate-1.0.0.json). They are revision-preparation tools; future semantic changes need a new profile/coverage/fixture revision. Do not overwrite historical snapshots or fixture bytes to relabel later behavior.

The current README starter rows/index, developer handoff, coverage semantics and BAI2 fixture/scope references were checked against the merged BAI2 implementation. BAI2 remains a separate 22-file kit (21 synthetic and one public illustrative sample), CANDIDATE, with schema-3 exports and its existing exclusions. Its frozen source, coverage and fixture revisions are unchanged. Coverage prose was clarified so schema-2 predecessors are distinguished from the newer BAI2/CSV Wire schema-3 candidates.

Local source/build/browser evidence, exact-head CI and independent engineering review are delivery evidence. Actual ReadMe CSP/customization coexistence, manual accessibility acceptance, independently approved bank fixtures, bank conformance and Production acceptance remain separate. No ReadMe publication, deployment or release is part of this change.

Local validation on 2026-10-14 (Node 26.5.0): `npm run validate:core` passed 836 unit tests, stress-kit integrity, TypeScript, both builds and the static ReadMe package contract. After adding the source-digest assertion, the 52-test focused CSV Wire suite passed. All 12 focused CSV Wire/guide-link browser cases passed across Chromium, Firefox and WebKit in both mounts; one additional Chromium run saved the previously missing HTML/screenshot artifact. Fixture regeneration was byte-identical, and affected Markdown links and whitespace checks passed. These are local results; exact-head CI and independent review are reported separately in delivery evidence.
