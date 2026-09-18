# File explorer implementation

The dedicated File Explorer demo and standalone preview include a read-only source explorer beside the existing workflow. A separate dedicated wizard-only demo, inline Guide instances, and link-triggered modals retain the original compact validator without the explorer. Both ReadMe demos use the same shared generated JavaScript and CSS; the explorer mount opts in explicitly with `data-file-explorer="true"`.

## Source and location contract

The canonical source is the exact string produced by the worker's strict UTF-8 decoder and passed to validation. A UTF-8 BOM is consumed by `TextDecoder`, so positions describe decoded text rather than original byte offsets.

- Offsets are zero-based UTF-16 code units.
- Ranges are half-open `[start, end)`; a point can use `start === end`, including end of file.
- Displayed lines and columns are one-based. Columns count UTF-16 code units from the original logical line start.
- The viewer normalizes line endings internally only when CodeMirror requires it and uses tested mappings back to canonical offsets. Copy returns original-source line endings.

Every non-PASS result receives one of these location outcomes:

- **Exact:** a lexical token or value that the rule evaluated.
- **Context:** an existing parent, segment, or boundary near missing or aggregate data.
- **Parser position:** the position reported by the XML syntax checker; this is described as where parsing stopped.
- **File-wide:** no single target truthfully represents the aggregate finding.
- **Unavailable:** a reliable mapping could not be established or the index budget was exceeded.

Locations are a run-scoped sidecar keyed by the result `ordinal`; the CSV schema and validation messages remain unchanged. Related targets are limited to 32 and disclose truncation.

## Known limitation: cascading structural findings

A missing or misspelled parent element can cause several descendant rules to report missing data even when similarly named descendants appear in the source. For example, `CstmrCdtTrfInit` instead of `CstmrCdtTrfInitn` prevents the validator from recognizing the message container, so `GrpHdr`, `MsgId`, `PmtInf`, and `NbOfTxs` are all absent from their required paths. These findings describe distinct unmet structural requirements, but they may share one root cause and must not be interpreted as five independent source defects.

The explorer may highlight a similarly named descendant as **context** when it exists under the unrecognized parent. That highlight helps explain the cascade; it does not mean the descendant was evaluated as though its parent path were valid.

Possible future treatments include grouping dependent findings under a parent/root-cause finding, suppressing descendants until their required parent is recognized, or explicitly labeling them as consequential findings. Any change would alter visible result counts, CSV output, navigation, and validation semantics, so it requires a deliberate product and rule-contract decision rather than a source-viewer-only change.

## Lifecycle and failure behavior

Validation completion is accepted before optional source-location enrichment. A mapper, viewer, or enrichment timeout cannot turn a completed PASS, PASS WITH WARNINGS, or FAIL into an incomplete run, and CSV export stays available. Replacing/removing a file, changing its profile, or unmounting invalidates the snapshot and ignores late worker messages. Source remains in memory only for the mount's accepted run.

The app does not add network requests, persistence, telemetry, or source-bearing URLs. Filenames, source, findings, and search values are assigned through text APIs rather than `innerHTML`. The existing test-data-only warning still applies because other scripts on the same ReadMe page share the page context.

## Provisional resource budgets

These are conservative implementation guards, not a supported browser capacity or service-level guarantee:

| Guard | Value | Behavior beyond it |
| --- | ---: | --- |
| Full CodeMirror document | 5,000,000 decoded characters | Show a bounded original-source excerpt. |
| Location companion index | 5,000,000 decoded characters | Preserve validation and report location as unavailable unless a bounded mapping is possible. |
| Longest full-view line | 250,000 decoded characters | Use excerpt mode to avoid an extreme single-line editor document. |
| Excerpt context | 12,000 decoded characters | Show explicit start/end scope and truncation. |
| Related targets per finding | 32 | Mark the related-location count as truncated. |
| Literal source-search matches | 10,000 | Show a capped count rather than claiming completeness. |

The worker's existing 25,000,000-byte input limit and 10-second validation deadline are unchanged. Explorer enrichment has its own 10-second UI deadline after validation is accepted.

## Installation and acceptance boundary

`npm run build:readme` bundles CodeMirror, the location parser, and the worker into the existing ES2022 IIFE; no editor CDN, new hosted asset, backend, or dynamic import is required. Install the generated CSS, JavaScript, and dedicated-page HTML through the existing ReadMe customization flow.

Use `npm run validate:core` when browser automation is unavailable. It runs unit tests, stress-kit integrity, TypeScript/production build, ReadMe generation, and static package-contract checks without launching Playwright. `npm run validate` additionally runs the browser suite.

Real ReadMe CSP/Blob-worker behavior, portal-customization coexistence, 320-pixel/200%-zoom reflow, and manual screen-reader behavior remain acceptance checks. Local unit/build/static-package evidence does not establish hosted or accessibility approval.
