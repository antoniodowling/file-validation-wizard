# Batch NACHA differential validation

Compare a directory of NACHA files using **both** Garrett's original standalone HTML/JavaScript validator and the File Validation Wizard's current R2 origination profile. Produce a Markdown report (and optionally normalized JSON) without copying files into the application or manually uploading them one at a time.

This is a **developer-side, local-only** diagnostic utility. It does not change the customer-facing wizard, expand SEC support, or determine bank acceptance.

## One-time setup

From the `file-validation-wizard` checkout:

```sh
npm ci
```

Obtain your trusted copy of `Garretts NACHA Validator ORIGINAL.html` and place it somewhere **outside the Git repository**. It is intentionally not checked into this public repo. The reference HTML used for the original November 9 comparison had SHA-256:

```
89d1da7c7f747c0fb0e302095d32c89c3b786c4801966547cdb0858aad4303b0
```

The checksum is recorded for reproducibility, not as a general-purpose authenticity guarantee. If your source differs, investigate and use the correct `--expected-garrett-sha256` for your vetted version.

## Run the batch

```sh
npm run compare:nacha -- \
  --input /path/to/nacha-directory \
  --garrett '/path/to/Garretts NACHA Validator ORIGINAL.html' \
  --report ./reports/nacha-comparison.md \
  --json ./reports/nacha-comparison.json \
  --expected-garrett-sha256 89d1da7c7f747c0fb0e302095d32c89c3b786c4801966547cdb0858aad4303b0
```

Only `--input` and `--garrett` are required. `--report` defaults to `nacha-differential-report.md` in the current directory. The input directory is scanned **recursively**, in deterministic filename order, for `.ach`, `.nacha`, `.txt`, and `.dat` files (case-insensitive). Files with other extensions can be included with `--all-files` or restrict to the top level with `--no-recursive`. Symlinks are not followed.

The default maximum is **250 files**, **25 MB per file**, and a **2-second per-file time limit for Garrett's JavaScript**. All limits can be overridden within explicit bounds with `--max-files`, `--max-mb`, and `--timeout-ms`. Files are processed sequentially, so a malformed or unsupported file does not stop the batch.

Use `--strict` for automated gating: it exits with code 2 for any headline verdict difference, unsupported/incomplete Wizard result, or per-file execution failure. Without `--strict`, disagreements are **reported** rather than considered harness failure; processing errors exit 1. Test-runner startup failures exit 1 and do not fabricate a report.

## Interpreting the report

The Markdown report contains:

1. A summary of same/different verdicts, unsupported and incomplete cases, and run errors.
2. A file-by-file comparison table including SEC tokens observed in apparent batch headers, each validator's outcome and error/warning counts.
3. A section for each file showing **Garrett's grouped issue fields** and **Wizard's failed rule IDs**, with severity and first location.
4. A heuristic comparison of finding *themes* (e.g., routing, addenda, control totals). Themes are **not** assertions that the two validators implement an identical rule.

**SAME VERDICT means only headline agreement.** Garrett's errors/warnings count reported **occurrences**; Wizard's counts refer to **failed rules**. The counts must not be treated as interchangeable. A file can fail both validators for entirely different reasons. The report preserves enough provenance to investigate differences without claiming either engine is an oracle. For expected correctness, independently authored and source-backed assertions are still required.

**WIZARD UNSUPPORTED** means the selected profile has no validity verdict for that file; it is **not** equivalent to a failed ACH transaction. R2 currently supports CCD, PPD, CTX, WEB and TEL originations with deeper checks. Garrett's wider SEC recognition is useful for comparing format coverage but is not proof of complete SEC-specific compliance. A file can also contain several SECs; reported tokens are an aid, not independent format verification.

The report avoids raw record text, account numbers, transaction amounts and unredacted diagnostic messages. It **does include filenames, short file hashes, field names and rule identifiers**. Treat reports as internal evidence if filenames or metadata are sensitive. JSON stores the same normalized findings without NACHA content, including full file hashes.

## How it works

- **Reference engine:** The supplied HTML source is loaded locally, and its original parsing and validation functions are executed in a bounded Node VM. UI initialization is excluded; reference validation logic is not altered. Node's `vm` is **not a security boundary** for malicious JavaScript: only use a trusted, checksum-verified original file.
- **Wizard engine:** A local, non-listening Vite SSR loader imports `src/validation.ts` and `src/format-packs.ts` and calls the real `validateSource()` with the R2 profile. No HTTP server is started; no file content is sent to a remote service.
- **Comparison:** Both receive the same UTF-8-decoded content. Invalid UTF-8, per-file limits, and engine exceptions are reported as **RUN ERROR**, not PASS or FAIL.

### Developer test commands

```sh
npm run test:nacha-diff
npm run compare:nacha -- --help
```

`test:nacha-diff` exercises parsing isolation, classification, file discovery, malformed files, sanitization, Markdown/JSON generation, and a real R2 fixture smoke test when run from an installed repository. The original Garrett HTML is not committed or required for automated unit tests; the actual adapter must also be exercised against the vetted original when available.

## Privacy and safe handling

Do **not** commit customer NACHA files, derived reports, or Garrett's original HTML to GitHub. Prefer synthetic or expressly authorized test files; real origination files may contain bank account and personal information. If asking ChatGPT to review a directory, a local directory path by itself does not provide remote filesystem access. Upload an authorized ZIP of files or provide them through a connected file source; the CLI can always run directly against your own local directory without uploading its contents.
