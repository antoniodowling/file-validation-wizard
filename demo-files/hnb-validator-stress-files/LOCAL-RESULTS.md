# Local measurements

Runtime: Node v26.5.0 on darwin. Each input ran through the bundled validation worker in a fresh Node worker thread with a deliberately restricted 256 MB V8 old-generation heap and a 10000 ms parent watchdog.

These are single-run diagnostic measurements, including worker startup. They are not browser benchmarks, peak-memory measurements, ReadMe acceptance, or a supported performance guarantee. The UI file-picker rejects the oversized file; the harness directly submits it to verify the separate worker gate.

| File | Elapsed ms | Observed outcome |
| --- | ---: | --- |
| 01-xml-small-baseline-pass.xml | 42 | PASS |
| 02-xml-empty-file.xml | 22 | FAIL |
| 03-xml-invalid-utf8.xml | 27 | INVALID_ENCODING |
| 04-xml-prohibited-dtd-and-entity.xml | 21 | FAIL |
| 05-xml-malformed-at-end-5MB.xml | 41 | FAIL |
| 06-xml-just-under-limit-24999999-bytes.xml | 1243 | HARNESS_WORKER_ERROR (ERR_WORKER_OUT_OF_MEMORY) |
| 07-xml-exact-limit-25000000-bytes.xml | 1398 | HARNESS_WORKER_ERROR (ERR_WORKER_OUT_OF_MEMORY) |
| 08-xml-over-limit-25000001-bytes.xml | 18 | FILE_TOO_LARGE |
| 09-xml-wide-tree-50000-payment-blocks.xml | 175 | PASS |
| 10-xml-deep-nesting-5000-levels.xml | 23 | ENGINE_ERROR |
| 11-edi-820-005010-baseline-pass.edi | 17 | PASS |
| 12-edi-820-005010-50000-transactions.edi | 99 | PASS |
| 13-edi-820-005010-long-element-5MB.edi | 18 | PASS |
| 14-edi-820-005010-dense-250000-segments.edi | 92 | PASS |

The near-limit text-node XML files exceeded the artificial 256 MB heap cap. That does not prove they will exhaust a browser, but demonstrates why byte size and fast completion alone do not establish a safe memory envelope. The 5,000-level XML returned ENGINE_ERROR. No case hit the watchdog; timeout behavior is covered by a deterministic silent-worker lifecycle test.
