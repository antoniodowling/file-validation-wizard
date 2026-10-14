# Synthetic NACHA validation files

These files use invented company/account data and routing values that satisfy checksum arithmetic. Routing directory membership and real bank/account acceptance are not asserted. Do not submit these files as payments. PASS describes this public-specification candidate only; remittance strings are placeholders, not validated EDI content.

In the Wizard select **NACHA**, choose **Public specification profile (2026 review)**, then upload a file from this directory. Start with `mixed-five-sec-pass.ach`, then `effective-weekend-warning.ach` and `routing-check-digit-fail.ach` to exercise PASS, PASS WITH WARNINGS, FAIL, source navigation, and CSV export.

The 69 files cover all five SEC codes individually and together, balanced/unbalanced totals, optional fields, multiple CTX addenda, hash truncation, four record framings, and targeted invalid inputs. `manifest.json` records exact bytes, hashes, expected status, and the named failing/warning rules. The test suite verifies every fixture and requires coverage of every parser rule. Additional parser tests cover boundaries and combined-error conditions.

Regenerate from the explicit worktree root:

```sh
cd '/Volumes/CodexData/Worktrees/nacha-production-preparation/HNB File Validation Wizard'
node scripts/generate-nacha-files.mjs /private/tmp/nacha-fixture-review
```

The generator only replaces its named outputs in the selected directory. The tests prove byte-for-byte reproducibility. Malformed files intentionally violate widths, characters, sequences, or totals; do not normalize their spaces or line endings. Fixed-width trailing spaces are intentional.

## Rule-to-fixture coverage

| Rule | Named example |
| --- | --- |
| `nacha.ascii` | [ascii-fail.ach](ascii-fail.ach) |
| `nacha.framing` | [record-length-fail.ach](record-length-fail.ach) |
| `nacha.record-order` | [order-fail.ach](order-fail.ach) |
| `nacha.file-header` | [file-constants-fail.ach](file-constants-fail.ach) |
| `nacha.creation-date` | [file-date-fail.ach](file-date-fail.ach) |
| `nacha.effective-date` | [batch-date-fail.ach](batch-date-fail.ach) |
| `nacha.sec-code` | [sec-fail.ach](sec-fail.ach) |
| `nacha.sec-transaction` | [service-class-fail.ach](service-class-fail.ach) |
| `nacha.batch-required` | [batch-required-fail.ach](batch-required-fail.ach) |
| `nacha.entry-required` | [entry-required-fail.ach](entry-required-fail.ach) |
| `nacha.routing` | [routing-prefix-fail.ach](routing-prefix-fail.ach) |
| `nacha.trace` | [trace-prefix-fail.ach](trace-prefix-fail.ach) |
| `nacha.transaction-code` | [transaction-code-fail.ach](transaction-code-fail.ach) |
| `nacha.entry-amount` | [amount-fail.ach](amount-fail.ach) |
| `nacha.addenda-count` | [tel-addenda-fail.ach](tel-addenda-fail.ach) |
| `nacha.web-credit-originator` | [web-credit-id-fail.ach](web-credit-id-fail.ach) |
| `nacha.addenda-indicator` | [addenda-indicator-fail.ach](addenda-indicator-fail.ach) |
| `nacha.addenda-type` | [addenda-type-fail.ach](addenda-type-fail.ach) |
| `nacha.addenda-sequence` | [addenda-sequence-fail.ach](addenda-sequence-fail.ach) |
| `nacha.addenda-link` | [addenda-trace-link-fail.ach](addenda-trace-link-fail.ach) |
| `nacha.batch-mirror` | [batch-control-mirror-fail.ach](batch-control-mirror-fail.ach) |
| `nacha.batch-count` | [batch-control-count-fail.ach](batch-control-count-fail.ach) |
| `nacha.batch-hash` | [batch-control-hash-fail.ach](batch-control-hash-fail.ach) |
| `nacha.batch-credit` | [batch-control-totals-fail.ach](batch-control-totals-fail.ach) |
| `nacha.file-batches` | [file-control-batches-fail.ach](file-control-batches-fail.ach) |
| `nacha.file-blocks` | [file-control-blocks-fail.ach](file-control-blocks-fail.ach) |
| `nacha.file-count` | [file-control-count-fail.ach](file-control-count-fail.ach) |
| `nacha.file-hash` | [file-control-hash-fail.ach](file-control-hash-fail.ach) |
| `nacha.file-credit` | [file-control-totals-fail.ach](file-control-totals-fail.ach) |
| `nacha.blocking` | [block-padding-fail.ach](block-padding-fail.ach) |
| `nacha.creation-time` | [creation-time-isolated-fail.ach](creation-time-isolated-fail.ach) |
| `nacha.service-class` | [service-class-isolated-fail.ach](service-class-isolated-fail.ach) |
| `nacha.originator-status` | [originator-status-isolated-fail.ach](originator-status-isolated-fail.ach) |
| `nacha.odfi` | [odfi-isolated-fail.ach](odfi-isolated-fail.ach) |
| `nacha.batch-number` | [batch-number-isolated-fail.ach](batch-number-isolated-fail.ach) |
| `nacha.trace-order` | [trace-order-isolated-fail.ach](trace-order-isolated-fail.ach) |
| `nacha.trace-unique` | [trace-unique-isolated-fail.ach](trace-unique-isolated-fail.ach) |
| `nacha.batch-debit` | [batch-debit-isolated-fail.ach](batch-debit-isolated-fail.ach) |
| `nacha.file-debit` | [file-debit-isolated-fail.ach](file-debit-isolated-fail.ach) |
| `nacha.reserved` | [reserved-isolated-fail.ach](reserved-isolated-fail.ach) |
| `nacha.effective-weekend` | [effective-weekend-warning.ach](effective-weekend-warning.ach) |
| `nacha.settlement-date` | [settlement-date-warning.ach](settlement-date-warning.ach) |
