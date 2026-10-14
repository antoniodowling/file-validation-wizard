# File explorer implementation

> Explorer display update (2026-10-14): full-source browsing replaces the earlier clipped source windows. The editor and fallback have no separate character or long-line cutoff, and source-window buttons are removed.

> Current report semantics: strict namespace-aware XML, scoped EDI ownership, prerequisite suppression, and schema-2 reports apply. The September design brief and evidence receipts are historical; full-source browsing is the current display contract.


The dedicated File Explorer demo and standalone preview include a read-only source explorer beside the existing workflow. A separate dedicated wizard-only demo, inline Guide instances, and link-triggered modals retain the original compact validator without the explorer. Both ReadMe demos use the same shared generated JavaScript and CSS; the explorer mount opts in explicitly with `data-file-explorer="true"`.

## Source and location contract

The canonical source is the exact string produced by the worker's strict UTF-8 decoder and passed to validation. A UTF-8 BOM is consumed by `TextDecoder` for ISO/X12. The NACHA profile retains a BOM so its ASCII/fixed-width checks reject it. Positions describe decoded text rather than original byte offsets.

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

NACHA findings supply source locations directly during parsing, avoiding a second location index. Repeated violations aggregate by rule with the first offending location and a disclosed occurrence count; parser admission budgets still apply.

Locations are keyed by each finding occurrence's run-scoped `ordinal`; schema-2 reports carry location and provenance metadata. The explorer uses a sidecar keyed by that same ordinal and opens the primary target only. Related-target metadata remains available to the mapping contract, is limited to 32 targets, and discloses truncation to non-UI consumers.

The finding detail header presents Field, Path, and Message in one row at standard widths and stacks them at narrow widths. Selecting an error applies a red source highlight, while selecting a warning applies a yellow source highlight. Previous/Next finding navigation remains available; the explorer intentionally does not provide source search, go-to-line, related-target navigation, or secondary focus/return actions.

## Structural prerequisites and historical findings

Current XML validation suppresses dependent checks when their required parent is invalid. A misspelled `CstmrCdtTrfInitn` produces the message-container finding; descendant checks and the dependent declaration advisory are not evaluated. The explorer uses the location supplied by that assessment rather than remapping descendants as if the parent were valid.

The original `multiple-errors` fixture remains unchanged. Earlier reports could show five structural errors plus an advisory for it; that historical cascade is documented in [implementation evidence](IMPLEMENTATION_EVIDENCE.md). It is not current result-count behavior. Keep historical reports tied to their original ruleset.

## Lifecycle and failure behavior

Validation completion is accepted before optional source-location enrichment. A mapper, viewer, or enrichment timeout cannot turn a completed PASS, PASS WITH WARNINGS, or FAIL into an incomplete run, and CSV export stays available. Replacing/removing a file, changing its profile, or unmounting invalidates the snapshot and ignores late worker messages. Source remains in memory only for the mount's accepted run.

The app does not add network requests, persistence, telemetry, or source-bearing URLs. Filenames, source, and findings are assigned through text APIs rather than `innerHTML`. The existing test-data-only warning still applies because other scripts on the same ReadMe page share the page context.

## Provisional resource budgets

These are conservative implementation guards, not a supported browser capacity or service-level guarantee:

| Guard | Value | Behavior beyond it |
| --- | ---: | --- |
| Full CodeMirror document | No separate character cutoff | Display the entire accepted source; CodeMirror renders the visible viewport. |
| Legacy location companion index | 5,000,000 decoded characters | For runs without schema-2 provenance, preserve validation and report unmappable locations as unavailable. |
| Related targets per finding | 32 | Mark the related-location count as truncated. |

Current schema-2 runs use parser-owned locations and bypass the legacy companion index. There are no source-window controls or viewer long-line cutoff. If the interactive editor cannot start, the fallback displays the full source. This does not establish a measured browser capacity.

The worker's existing 25,000,000-byte input limit and 10-second validation deadline are unchanged. Explorer enrichment has its own 10-second UI deadline after validation is accepted.

## Installation and acceptance boundary

`npm run build:readme` bundles CodeMirror, the location parser, and the worker into the existing ES2022 IIFE; no editor CDN, new hosted asset, backend, or dynamic import is required. Install the generated CSS, JavaScript, and dedicated-page HTML through the existing ReadMe customization flow.

Use `npm run validate:core` when browser automation is unavailable. It runs unit tests, stress-kit integrity, TypeScript/production build, ReadMe generation, and static package-contract checks without launching Playwright. `npm run validate` additionally runs the browser suite.

Real ReadMe CSP/Blob-worker behavior, portal-customization coexistence, 320-pixel/200%-zoom reflow, and manual screen-reader behavior remain acceptance checks. Local unit/build/static-package evidence does not establish hosted or accessibility approval.
