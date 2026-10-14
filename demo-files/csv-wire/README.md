# CSV Wire candidate input fixtures

Select **CSV Wire** → **Huntington CSV Wire — USD candidate (2026 r1)**, profile `huntington-csv-wire-public-2026-r1`. This kit contains **23 synthetic CSV input files**, not report-output CSVs, customer instructions or bank-approved conformance fixtures.

Start with [domestic-pass.csv](domestic-pass.csv), [international-usd-pass.csv](international-usd-pass.csv), [amount-fail.csv](amount-fail.csv) and [cad-unsupported.csv](cad-unsupported.csv). [mixed-rows-pass.csv](mixed-rows-pass.csv) has both qualified layouts; [quoted-comma-pass.csv](quoted-comma-pass.csv) demonstrates a comma and doubled quotes inside a name. All fields, including empty ones, are quoted and all trailing positional slots are retained.

[manifest.json](manifest.json) binds each file's SHA-256, expected outcome, targeted rules, profile and synthetic provenance to `csv-wire-fixtures-1.0.0`. Dates are on/before 2026-10-14; the guide supplies no past-date floor. Tests fix the clock for future-date boundaries. Synthetic account numbers and illustrative routing/BIC codes are used for local syntax checks only; do not transmit these files to a bank.

The remaining failures cover dates, required fields, lengths, ABA checksum, conditional address, reserved originator fields, country, international charges, debit account, field count, unquoted empty slots, unclosed quotes and BOM admission. Unsupported files cover CAD scheduling, IBAN, intermediary SWIFT, embedded newlines and headers. UNSUPPORTED has no validity verdict. Invalid UTF-8 and resource limits are tested in memory as incomplete runs.

See [source and scope](../../docs/CSV_WIRE_SOURCE_SCOPE.md), [functional source extraction](../../docs/sources/csv-wire-guide-extract.json) and [frozen coverage](../../docs/coverage/csv-wire-candidate-1.0.0.json) for precise boundaries and guide ambiguities. `node scripts/generate-csv-wire-files.mjs` prepares this revision and manifest; preserve published bytes and use a new revision for future semantic changes.
