# BAI2 upload fixtures

Choose **BAI2 — Balance and Transaction Reporting**, then **Huntington public-guide candidate (BAI2 2026 r1)**. Upload `balances-pass.bai2` for PASS, `account-total-fail.bai2` for FAIL, and `funds-unsupported.bai2` for UNSUPPORTED with no validity verdict.

The [manifest](manifest.json) pins each fixture's SHA-256, expected status/rules and provenance. `huntington-guide-sample.txt` is the exact illustrative example from the owner-supplied public guide, preserved separately from generated files. Its controls reconcile to 245520532; counts are 3/14/3/3 per account, 25 per group and 27 per file. Other fixtures use synthetic identities/references. No fixture claims bank acceptance or contains private customer records.

Regenerate synthetic fixtures and their manifest with `node scripts/generate-bai2-files.mjs`. The generator preserves the source example. See [source scope and assumptions](../../docs/BAI2_SOURCE_SCOPE.md) before interpreting results. These reporting examples are not payment instructions or complete bank conformance evidence.
