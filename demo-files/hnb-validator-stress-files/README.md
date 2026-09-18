# Synthetic validator upload stress kit

These files contain invented test data only. They exercise the current demo, not standards or bank acceptance. Do not submit them as payment instructions.

Use a local preview or ReadMe draft with the safeguards build. Select the profile shown below, upload one file, and press Validate. Run the standard cases first; run the two adversarial cases individually with other browser work saved. A deadline cannot guarantee recovery from browser memory exhaustion.

Record browser/version, environment, file, result/failure message, elapsed time, responsiveness, and whether the next small baseline succeeds. Keep the tab foreground for comparable timing. Browser timer throttling can delay the 10-second deadline in background tabs.

No upload is guaranteed to force a timeout on every computer. Deadline behavior has a deterministic test using a silent worker; do not enlarge files indefinitely to force one.

| File | Bytes | Select format / version | Expected behavior |
| --- | ---: | --- | --- |
| [01-xml-small-baseline-pass.xml](01-xml-small-baseline-pass.xml) | 286 | pain.001 / pain.001.001.09 | PASS under current demo checks. |
| [02-xml-empty-file.xml](02-xml-empty-file.xml) | 0 | pain.001 / pain.001.001.09 | Completed FAIL. |
| [03-xml-invalid-utf8.xml](03-xml-invalid-utf8.xml) | 227 | pain.001 / pain.001.001.09 | UTF-8 error; no validation result. |
| [04-xml-prohibited-dtd-and-entity.xml](04-xml-prohibited-dtd-and-entity.xml) | 336 | pain.001 / pain.001.001.09 | Completed FAIL for prohibited declarations. |
| [05-xml-malformed-at-end-5MB.xml](05-xml-malformed-at-end-5MB.xml) | 4,999,999 | pain.001 / pain.001.001.09 | Completed FAIL. |
| [06-xml-just-under-limit-24999999-bytes.xml](06-xml-just-under-limit-24999999-bytes.xml) | 24,999,999 | pain.001 / pain.001.001.09 | Admitted; PASS if processing completes before deadline. |
| [07-xml-exact-limit-25000000-bytes.xml](07-xml-exact-limit-25000000-bytes.xml) | 25,000,000 | pain.001 / pain.001.001.09 | Admitted; PASS if processing completes before deadline. |
| [08-xml-over-limit-25000001-bytes.xml](08-xml-over-limit-25000001-bytes.xml) | 25,000,001 | pain.001 / pain.001.001.09 | Rejected by file picker; prior selection preserved. Worker rejection is unit-tested separately. |
| [09-xml-wide-tree-50000-payment-blocks.xml](09-xml-wide-tree-50000-payment-blocks.xml) | 2,639,119 | pain.001 / pain.001.001.09 | PASS under current demo checks if processing completes; not standards-conformance evidence. |
| [10-xml-deep-nesting-5000-levels.xml](10-xml-deep-nesting-5000-levels.xml) | 85,273 | pain.001 / pain.001.001.09 | May produce ENGINE_ERROR or TIMEOUT. No fixed outcome across parser/browser versions. |
| [11-edi-820-005010-baseline-pass.edi](11-edi-820-005010-baseline-pass.edi) | 225 | 820 / 005010 | PASS under current demo checks. |
| [12-edi-820-005010-50000-transactions.edi](12-edi-820-005010-50000-transactions.edi) | 2,377,971 | 820 / 005010 | PASS under current demo checks if processing completes. |
| [13-edi-820-005010-long-element-5MB.edi](13-edi-820-005010-long-element-5MB.edi) | 5,000,226 | 820 / 005010 | PASS under current limited checks if processing completes; deliberately not a realistic payment. |
| [14-edi-820-005010-dense-250000-segments.edi](14-edi-820-005010-dense-250000-segments.edi) | 1,250,230 | 820 / 005010 | May PASS limited checks, fail in the engine, or time out. Not a valid standard file. |

manifest.json includes byte counts and SHA-256 checksums. The oversized file is rejected before worker dispatch; direct worker enforcement is covered separately in unit tests.
