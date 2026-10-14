# Synthetic ACH candidate fixtures

57 deterministic files for the four executable candidate revisions: ACK single pipe scenario, standalone Huntington control totals, ordinary network Returns/COR and expanded origination r2. No customer data, actual submission, bank acceptance or independent business-fixture approval is represented.

`manifest.json` records profile, expected status, byte count, SHA-256, finding IDs and expected reported disposition where present. Generate with `node scripts/generate-ach-candidates.mjs`. The generator explicitly declares expected statuses before checking the runtime. Historical `nacha`/`nacha-expanded` kits and their manifests remain unchanged.

Use the matching selected candidate/profile to upload a file. `ack-rejected-pass.txt` deliberately passes format checks while reporting REJECTED and an original-file VAL ERROR. Its original counts/hashes differ intentionally. `ack-html-qualifier-pass.txt` and `ack-formula-qualifier-pass.txt` test safe text rendering and CSV formula neutralization. The sample checksum remains opaque, because the original file is unavailable.

Returns sample controls independently total their supported transaction families. The specialized return/refused-NOC examples receive UNSUPPORTED and no verdict, because their exact layouts remain unqualified. CTX reply count syntax is checked without asserting original-count preservation/coherence. Control totals use a disclosed single-record framing policy; no companion matching is performed. Healthcare r2 examples check the declared HCCLAIMPMT/TRN condition and prenote exemption, without inferring undeclared real purpose.
