# Mixed warning-and-error FAIL examples

These two synthetic upload files exercise existing rules. Each produces **FAIL with exactly one ERROR and one WARNING**, alongside passing checks. An error determines the overall FAIL result; it does not suppress an independent advisory when the parser can still evaluate it.

| File | Select format / exact profile | ERROR | WARNING |
| --- | --- | --- | --- |
| [pain.001.001.09-fail-with-warnings.xml](pain.001.001.09-fail-with-warnings.xml) | PAIN.001 / `pain.001.001.09` (`pain-001-09`) | `iso.message-id`: empty MsgId | `demo.xml-declaration`: declaration omitted |
| [nacha-r2-fail-with-warnings.ach](nacha-r2-fail-with-warnings.ach) | NACHA / Expanded entries and declared healthcare — candidate (2026 r2), `nacha-origination-expanded-public-2026-r2` | `nacha.healthcare-addenda`: declared healthcare CCD entry lacks required addenda | `nacha.effective-weekend`: effective date 261017 is a Saturday |

The XML retains valid syntax, namespace and container so the declaration advisory remains evaluable. A namespace/container failure would stop dependent checks instead. The ACH fixture retains 94-column records and valid controls; only the effective date changes from its existing synthetic error fixture. The weekend advisory does not determine bank holidays, cutoffs or acceptance.

[manifest.json](manifest.json), revision `mixed-findings-fixtures-1.0.0`, records SHA-256, byte counts, exact profiles, expected severities/rules, source fixture hashes and derivation steps. Existing source fixtures and published coverage revisions remain unchanged. [Focused tests](../../tests/mixed-findings.test.ts) check hashes, mixed findings, worker execution, source locations and exports; [browser tests](../../tests/browser/mixed-findings.spec.ts) check upload and both severity filters with overall FAIL.

These are local synthetic demonstrations, not real payment instructions, independent conformance fixtures or bank/Production acceptance evidence. Preserve spaces, line endings and hashes.
