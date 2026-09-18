# File Explorer: Feature and Technical Brief

**Project:** `antoniodowling/file-validation-wizard`  
**Prepared:** September 18, 2026  
**Repository baseline inspected:** `main` at `2c1fd68cef92817e75b4f2fce4d9915d97b4b1a7`  
**Baseline commit:** Merge PR #3, “Fix validator modal link routing in ReadMe,” committed September 18, 2026 at 02:03:22 UTC.  
**Status:** Proposed implementation specification. No feature implementation, benchmark, hosted acceptance, or Product/SC/FT approval is claimed by this brief.

## 1. Objective and assignment boundary

Add a read-only **File explorer** to the right of the existing validation wizard on its dedicated ReadMe Custom Page. A user selects an error or warning and sees the relevant part of the source file, with a persistent highlight and an honest explanation of whether the location is exact, contextual, or unavailable.

The primary outcome is reliable navigation from an existing finding to its source, not a richer-looking validator that implies additional validation coverage.

This document specifies the work for an implementing agent. Follow the actual accompanying assignment: implement when implementation is authorized; otherwise use it to plan or review. It does not independently authorize pushing, opening a PR, merging, deploying, publishing ReadMe changes, changing portal security settings, or accessing customer files. When implementation is authorized, proceed through bounded implementation and verification without inserting an additional planning-approval gate.

Inspect the relevant current checkout before changing it. Reconcile differences from the pinned baseline without reverting newer work or assuming this document describes an uncommitted local branch. Follow applicable repository instructions and preserve unrelated changes. Ordinary module organization, library configuration, and internal naming are engineering decisions; the behavioral and safety boundaries below are not optional implementation shortcuts.

## 2. Context, evidence, and scope

### User direction and proposed defaults

The user specified a dedicated ReadMe Custom Page, an explorer to the wizard’s right, and clicking an error to navigate to it in the file. Guide-column and modal-width constraints do not govern the new workspace.

The following are proposed v1 defaults carried forward from the feature discussion: read-only source, an approximately 40% wizard / 60% explorer initial split, adjustable divider, explicit location-quality labels, search, go to line, previous/next finding, and a narrow-layout fallback. The exact split, breakpoints, resource budgets, and CodeMirror selection are recommendations, not previously measured or formally approved product decisions.

### Verified repository baseline

| Area | Observed implementation | Consequence for this feature |
|---|---|---|
| Application | TypeScript, Vite, and direct DOM rendering in `mountPaymentFileValidator()`; no application UI framework dependency in `package.json`. [R1, R2] | Extend the existing application. Do not introduce a framework migration. |
| Findings | `RuleResult` contains `ruleId`, `outcome`, `severity`, `field`, `locator`, `message`, and `ordinal`. It has no source range. `RuleEvaluation` also has no location metadata. [R3] | Add a location contract. The display `locator` is not an executable source address. |
| XML | `parseIso()` uses `fast-xml-parser`, validates syntax, parses values with trimming, and selects objects through local-name helpers. The current integration does not retain lexical ranges. [R4] | Preserve positions in the original decoded source independently of trimmed or decoded semantic values. |
| EDI | `parseEdi()` splits on the detected terminator, removes surrounding CR/LF/spaces, filters empty segments, and splits elements. `position` is a logical segment ordinal, not a character offset. [R5] | Retain raw offsets while preserving existing segment and rule semantics. |
| Worker | The UI reads an `ArrayBuffer` and transfers it to a worker. `validateWorkerRequest()` checks size, decodes strict UTF-8, and returns only the validation run on completion. [R1, R6] | The explorer needs access to that same decoded source; it cannot assume the UI retained a usable transferred buffer. |
| Lifecycle | `runGeneration` invalidates pending work. `stopWorker()` increments it and is called on successful completion as well as cancellation/failure paths. [R1] | Separate accepted-result identity from active-work cancellation. A naive freshness check can invalidate a newly completed explorer. |
| Results | Search, outcome filters including PASS, path filtering, sorting, 25-row pagination, and full-run CSV export already exist. [R1, R7] | Preserve these behaviors; navigation must use the full filtered set before pagination. |
| ReadMe | The shared entry mounts a dedicated root, inline roots, and dialogs. The deliverable is an ES2022 IIFE with bundled worker and scoped CSS. `.validator-content` currently caps its width at 1120px. [R8, R9] | Enable the workspace explicitly for the dedicated page. Expand its own width constraint without changing other embeds. |
| Coverage | Nine DEMO profiles cover PAIN.001, PAIN.008, and EDI 820. Production approvals are false. Most results are rule-level or aggregate findings. [R3, R4, R5, R10] | Do not manufacture per-payment findings, add formats, or imply production validation through the explorer. |

The exact location capabilities of the installed XML dependency, suitable viewer budgets, and hosted CSP compatibility remain engineering verification items. No tests or browser benchmarks were executed while preparing this brief.

### Included and excluded

**Include:** the dedicated-page workspace; a matching standalone development preview; source-location metadata for current executable parser families; error/warning navigation; original-source inspection; related locations; search and go to line; lifecycle cleanup; accessible responsive behavior; bounded large-file handling; tests, documentation, and regenerated ReadMe deliverables.

**Exclude:** editing, automatic fixes, transformed-file downloads, pretty-printing, a document tree, semantic payment summaries, diffing revisions, AI explanations, new validation rules or formats, production certification, remote processing, persistent source history, and new source-related CSV columns. Existing inline and modal experiences require regression protection, not an explorer redesign.

The future goal of 50+ formats motivates one shared viewer and a parser-family location interface. It does not authorize implementing ACH, BAI2, or other reference-only formats now.

## 3. Product behavior

### FE-01: Workspace and mounting

Keep the existing three-step wizard and results on the left. Put the explorer on the right in a distinct labeled region. Start near a 40/60 split, with a keyboard- and pointer-operable divider and practical minimum pane widths. Use the dedicated page’s available width rather than retaining the current 1120px content cap by accident.

The header shows the selected filename, original byte size, and **Read-only**. A persistent toolbar provides **Find in file**, **Go to line**, **Previous finding**, **Next finding**, and hide/expand controls. A compact details region shows the selected finding’s outcome, rule ID, field, existing locator, message, and location explanation. Do not invent a transaction identifier absent from the finding or parser evidence.

Each pane can scroll independently at comfortable desktop sizes. Toolbars and the selected-finding explanation must remain reachable without repeatedly returning to the top of the file. Reflow the left pane’s controls and long paths according to that pane’s available width, not just the outer viewport. Existing root-level container queries may need a workspace-specific inner container.

Use an explicit mount option, such as a proposed `enableExplorer` flag. Enable it for the dedicated ReadMe root and the standalone preview. Leave it disabled for ordinary inline and modal mounts. Do not infer workspace mode merely because an inline component happens to be wide. Do not add source information to the existing reserved URL fragment.

### FE-02: Availability and states

| State | Explorer behavior |
|---|---|
| No file, or file selected but not validated | Placeholder explaining that the source will appear after validation. No separate preview read or parser run. |
| Validation running | Clear the previous run’s source selection and show a processing state. Do not leave old content beside the new filename. |
| Completed PASS, PASS WITH WARNINGS, or FAIL | Make the same decoded source used by that run available for inspection. PASS files remain browsable even without navigable findings. |
| Completed malformed-XML FAIL | Show source when decoding succeeded. Use a verified parser-reported position where available; otherwise expose an unavailable location. |
| Incomplete validation | Preserve existing incomplete-run behavior: no completed results or CSV export. Do not show an apparently validated source preview. |
| Completed validation, explorer preparing | Keep the completed result and CSV usable while optional viewer work finishes. |
| Explorer degraded or unavailable | Show a scoped explanation and an available bounded excerpt or retry action. Preserve the completed validation result. |

Do not auto-select a finding on completion. Let the user choose; the initial source can open at the beginning. Hiding the explorer is not removing the file: preserve its accepted-run selection and position in memory and restore them when reopened.

### FE-03: Finding activation

In explorer-enabled mounts, give each error and warning a keyboard-operable action. Use **View in file** for a source target, **View context** for contextual anchors, and a clearly labeled details action for file-wide/unavailable findings. Row clicking can be a convenience, but not the only interaction.

Activation selects the finding, reveals the explorer if hidden, scrolls the target into view with nearby context, and applies a persistent range or point decoration. The explanation remains readable outside the code. Copying text or moving the caret must not erase the finding highlight.

For a missing field, highlight the nearest meaningful existing parent or boundary and explain what is absent. Never render an invented field as if it appeared in the file. For an unlocated finding, clear the previous highlight and explain the limitation without an arbitrary jump.

Multiple related targets belong to the same finding. Provide clearly labeled navigation among them without creating extra result rows or changing error counts. Any limit on displayed targets must be disclosed rather than implying that the displayed subset is exhaustive.

### FE-04: Results synchronization

Preserve PASS rows and all current filters, sorting, pagination, and export behavior. **Previous/Next finding** traverses errors and warnings in the current filtered and sorted order across all pages, excluding PASS rows. Include file-wide/unavailable findings in that sequence so they are not silently skipped; display their explanation without a false source target.

Calculate the selected row’s page using the complete visible result list, including PASS rows, before applying the existing 25-row page window. Do not calculate its page from the error/warning-only navigation list.

At sequence boundaries, disable the corresponding action rather than wrapping silently. With no selection, Next selects the first eligible finding and Previous the last. Sorting preserves the selection’s identity and updates its result-page position. A filter or results-search change that excludes it clears its selection and highlight. Manual result-page changes may retain the explorer selection; **Back to finding** restores the appropriate page and focuses that finding’s current action.

Use a stable identity within the accepted run, such as the run identity plus existing `ordinal`. Do not key selection only by `ruleId`, a displayed path, DOM row index, or filename. Multiple occurrences or future repeated rule results must remain distinguishable.

### FE-05: Source inspection

Display decoded original source text with a monospaced font and original logical line numbers. Preserve whitespace and ordering. Optional soft wrapping affects display rows only; it does not change source coordinates. Do not insert EDI line breaks at segment boundaries or pretty-print XML in v1.

Find-in-file is separate from the existing finding search. Start with literal, case-sensitive search, next/previous match, and an honest match-count or capped-count state. No regular expressions or replacement UI is required. Source search may change the visible position but not the selected finding; provide an easy return to that finding and visually distinguish search matches from its highlight.

Go to line uses original-source line numbering, validates the requested number, and reports out-of-range input. Do not silently clamp an invalid request. When an excerpt fallback limits search or navigation, state that scope and disable unsupported full-file controls.

Allow explicit user copying of selected source without line numbers, highlighting markup, or inserted annotations. Never copy automatically on finding selection. Read-only must resist typing, paste, cut, source-changing commands, and drops into the source pane. Scope keyboard shortcuts to this workspace; do not hijack ReadMe-wide navigation or ordinary browser find outside it.

## 4. Source and location contract

### FE-06: Canonical coordinate space

Let `S` be the exact decoded string passed to `validateSource()` for the accepted run. All canonical positions are **zero-based UTF-16 code-unit offsets** into `S`; all ranges are **half-open `[start, end)`**. An explicit point target has `start === end`, including a legitimate EOF target at `S.length`.

Keep this coordinate space distinct from UTF-8 bytes, Unicode code points, graphemes, parser-specific columns, and visual columns after tab expansion. Display line/column labels as one-based values derived from canonical positions and document the column convention.

Do not trim, normalize Unicode, normalize line endings, expand entities, or reserialize `S`. XML semantic values and EDI comparison values may already be normalized by existing code, but their display targets must refer to the original lexical representation.

The worker currently uses `TextDecoder("utf-8", { fatal: true })`. Preserve that decoding policy. Its default initial-BOM handling means decoded-text positions are not original byte offsets; test BOM-bearing files without changing validation semantics to accommodate the viewer. Do not describe this as a byte-for-byte binary viewer. [R6, E4]

If the viewer uses a normalized internal document, add an explicit position mapping in both directions. Test CRLF, LF, lone CR, mixed endings, tabs, non-BMP characters, combining characters, entities, and EOF. Do not assume parser or viewer columns use the same units. Derive coordinates through one tested utility rather than independently recomputing them in different UI controls.

### FE-07: Location quality and data shape

The contract must distinguish these meanings:

| Quality | Meaning and presentation |
|---|---|
| Exact | An existing lexical token, value, or field actually checked by the rule. Highlight that verified source span. |
| Context | An existing parent, segment, or boundary relevant to a missing/aggregate condition. Label it as context, not the erroneous value. |
| Parser position | Where the syntax checker reports that parsing failed. Say **Parsing stopped here**, not **The mistake starts here**. |
| File-wide | The finding applies to the file or an aggregate condition without a defensible local target. No arbitrary highlight. |
| Unavailable | No reliable mapping could be established. State this explicitly and retain the finding. |

The following is a proposed shape, not an existing repository API. Equivalent naming is acceptable; retain its distinctions:

```ts
interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

interface SourceTarget {
  readonly span: SourceSpan;
  readonly kind: "exact" | "context" | "parser-position";
  readonly label: string;
}

type FindingLocation =
  | {
      readonly kind: "located";
      readonly primary: SourceTarget;
      readonly related: readonly SourceTarget[];
      readonly relatedTruncated?: boolean;
    }
  | { readonly kind: "file-wide"; readonly explanation: string }
  | { readonly kind: "unavailable"; readonly explanation: string };
```

Keep the source snapshot and its identity at run/workspace level, not duplicated into each result. Retain existing `locator` and message fields unchanged. Extend `RuleEvaluation`, `RuleResult`, and the `result()` helper as needed, or use an equally explicit typed sidecar keyed by run-scoped finding identity. Do not attach methods, DOM nodes, or parser object graphs to worker messages.

Every error/warning in explorer mode must resolve to one of the above outcomes, including an explicit unavailable fallback. Validate finite integer bounds before applying decorations. Invalid ranges must degrade safely, not be silently clamped into a convincing but incorrect highlight. Bound related-target metadata and preserve a visible truncation indication.

## 5. Parser integration and current-rule coverage

### FE-08: Map what the current rule actually evaluated

Capture source identities during parsing or a bounded, position-preserving lexical pass associated with that same source. Do not locate findings after a click by searching for a displayed value, interpolating a `locator` as XPath, or choosing the first matching field name.

For XML, first verify the installed dependency’s actual position APIs. If insufficient, use a narrowly scoped location-aware tokenizer or equivalent source-index layer. Handle namespaces, repeated siblings, quoted attribute delimiters, comments, CDATA, processing instructions, self-closing elements, and entities. Do not implement XML structure with a general-purpose regular-expression search. A lexical companion must not become a second validator with different acceptance rules.

Map to the same occurrence selected by the existing local-name helpers. If exact semantic-to-lexical correspondence cannot be demonstrated, return contextual or unavailable metadata. Do not use this work to silently fix namespace selection, strengthen rules, or alter early-return behavior. In particular, preserve the current single-result namespace-mismatch behavior. [R4]

For EDI, replace position-losing tokenization with an equivalent offset-preserving scan, or add a source index that demonstrably mirrors it. Preserve detected delimiters, segment numbering, element values, blank-segment filtering, and current trimming semantics. An element’s ordinal and its character range are separate properties. Duplicate values in different segments must map to their actual occurrences. [R5]

### Initial XML mapping coverage

| Existing rule ID | Required mapping behavior when non-PASS |
|---|---|
| `iso.safe-declarations` | Highlight the source substring that triggered the existing detector, with accurate detector wording. Do not silently reinterpret the detector’s semantics as part of source mapping. |
| `iso.well-formed` | Convert verified structured parser error coordinates to a parser-position target. If coordinates are absent or unreliable, use unavailable; do not scrape English error messages to invent positions. |
| `iso.document-root` | Context on the existing wrong root when identifiable, or file-wide/unavailable when no usable root exists. |
| `iso.namespace-version` | Exact actual namespace attribute/value involved, including prefixed declarations; context on the root when the required declaration is absent. The displayed `/Document/@xmlns` string alone is insufficient. |
| `iso.message-container`, `iso.group-header`, `iso.payment-information` | For missing structures, anchor the nearest existing relevant parent. Never highlight an unrelated repeated element merely because its name matches. |
| `iso.message-id`, `iso.transaction-count-type` | Existing invalid/blank element or value when identifiable; missing-element parent context otherwise. Empty lexical content can require a point or element-span target. |
| `demo.xml-declaration` | Context at the beginning of the document when the declaration is absent. Do not pretend a missing declaration is present. |
| `demo.non-empty-source` | File-wide if this result is actually emitted as non-PASS. Preserve whether the current parser reaches this rule; do not add a new result on early failure. |

### Initial EDI mapping coverage

| Existing rule ID | Required mapping behavior when non-PASS |
|---|---|
| `edi.fixed-header` | Context on the existing incomplete ISA/header region, or file-wide when no defensible ISA location exists. |
| `edi.interchange-envelope`, `edi.functional-group-envelope` | Existing relevant envelope portions and related endpoints. Missing endpoints use context, not fictional closing segments. |
| `edi.transaction-set-envelope` | Aggregate or contextual information unless the current evaluated data supports a specific unmatched endpoint. Do not invent transaction pairing. |
| `edi.transaction-set-code` | Actual non-820 `ST01` occurrence(s); if no ST exists, missing-structure context or file-wide. |
| `edi.version` | The actual mismatching ISA12, GS08, and/or ST03 occurrences used by the existing check, with related targets where applicable. |
| `edi.control-numbers` | Actual compared control fields, with related opening/closing targets and context for missing fields. Preserve the current pairing semantics rather than substituting a new envelope model. |
| `edi.segment-count` | The relevant SE01 and associated ST/SE boundaries where identifiable; use context for missing endpoints. |
| `edi.payment-remittance` | File-wide/contextual for the current aggregate BPR-count check unless a specific target is genuinely supported. Do not claim which transaction is missing BPR from a global count alone. |
| `demo.non-empty-source` | Same file-wide and reachability rule as XML. |

Keep the number, order, IDs, severities, messages, locators, and overall outcomes of existing results unchanged for the same source/profile. Do not expand one aggregate error into many errors. Related locations are navigation metadata, not additional findings.

If inspection exposes an unrelated validation defect, record it separately. Do not encode stronger conclusions in the explorer or repair unrelated rules under this feature’s scope.

## 6. Worker protocol, state, and lifecycle

### FE-09: One accepted source, one accepted result

The existing path is: capture file/profile, read bytes on the page, transfer the buffer, decode in the worker, validate, receive the run, terminate the worker, render results. Extend it deliberately; the completion response currently contains no source text. [R1, R3, R6]

The preferred starting design is an opt-in explorer payload containing the same decoded `S` and compact location metadata, separate from the business `ValidationRun`. Decode once. Do not reread the file with a different API or encoding policy after validation. Avoid transferring the entire XML object graph or keeping unnecessary full-source copies. With the explorer disabled, retain a lightweight completion path without unnecessary source-view snapshots or indexes. Handle any new worker message types explicitly rather than routing them through the existing generic error branch.

Use a dedicated accepted-snapshot identity bound to the mount instance, captured file object, selected profile, and accepted run. Filenames, file sizes, and last-modified timestamps alone are insufficient identity. Any asynchronous viewer setup, indexing, search, or snippet request must carry that snapshot identity; searches also need query/request identity so a late query cannot overwrite a newer one.

**Important baseline trap:** `stopWorker()` increments `runGeneration` on successful completion. Do not compare accepted explorer work only to the live cancellation counter or attach unconditional source destruction to `stopWorker()`. Separate termination of active validation from invalidation of accepted results. [R1]

Completed validation and explorer availability are separate states. Keep optional source indexing/viewer initialization independently bounded and recoverable. If location enrichment needs substantial work, stage it after accepting the validation result rather than extending or resetting the validation deadline. A failed source-index operation must not turn a completed PASS/FAIL into `ENGINE_ERROR`, TIMEOUT, or an empty report. Existing genuine validation-engine failures retain their current meanings.

### FE-10: Invalidation and cleanup

Invalidate the accepted source, selected finding, decorations, search state, pending explorer work, and return-focus target together on successful file replacement, removal, format/version changes, reset, new validation, and unmount. Include source held by editor state, closures, indexes, timers, listeners, and any auxiliary worker. Revoke feature-created object URLs and release references. Do not claim JavaScript reference cleanup is a forensic memory wipe.

Keep file-selection behavior intact: cancelling the picker or rejecting a replacement must not accidentally bind the old source to a different selection or erase an otherwise unchanged accepted run.

Leaving the dedicated page must clear its source even if ReadMe navigation reuses DOM nodes. Integrate with existing mount/router cleanup, `pagehide`, and restoration behavior. A restored page must not resurrect discarded source state. Closing an unchanged modal still clears only that modal’s state; other instances remain independent. Do not introduce global source storage or cross-instance navigation.

Back-to-file/format accordion navigation alone is not a profile or file change. Preserve the accepted snapshot until actual invalidation. Ensure late reads, worker responses, index results, or announcements cannot restore old file state after removal or navigation.

## 7. Viewer, performance, and ReadMe packaging

### FE-11: Viewer selection

Evaluate CodeMirror 6 first. It provides an established read-only configuration pattern and viewport-based rendering; its documentation also distinguishes visible ranges within long lines. These are relevant capabilities, not evidence that a particular ReadMe installation or 25MB file will work. [E1, E2]

Use a small read-only configuration, explicit range/point decorations, scoped search/navigation, and proper disposal. Do not import a full IDE feature set. Syntax coloring is optional polish, not a prerequisite for correct navigation. Verify focusability when disabling editability, and ensure the configuration cannot mutate the source through commands or extensions.

Instantiate the viewer only when a completed source is available. Avoid replacing the whole editor on each finding click, filter change, or divider drag. Hiding, resizing, and narrow-layout transitions must preserve the accepted snapshot and restore the visible target correctly.

### FE-12: Bounded resource use

Preserve `MAX_FILE_BYTES = 25_000_000` and `VALIDATION_DEADLINE_MS = 10_000`. The byte limit remains independently enforced before decoding in the worker. Neither number is a verified explorer capacity or browser-memory guarantee. [R3, R6, D1]

Virtualization bounds rendered content, not every source string, parser tree, editor document, index, or worker-message copy. Avoid a DOM element per line/segment, unbounded decoration sets, repeated full-source lowercasing, or allocating one metadata object per character. Do not assume a file with few physical lines is small to render: minified XML and EDI may have extremely long lines.

Define and document conservative, named budgets for source indexing, related targets, search results, and excerpt size. Set actual values from representative tests rather than inventing a service-level guarantee. Expensive optional work must be cancellable or yield appropriately; a timeout callback on the same blocked thread is not sufficient protection.

Provide a deterministic degraded path before attempting work outside those budgets: a bounded original-source excerpt around the selected target, with original coordinates and explicit truncation indicators. Clip context by characters as well as lines. Never truncate the file being validated. Never render a partial excerpt as the entire file or label an incomplete search as exhaustive.

Use the existing synthetic stress kit to measure selection/read, validation, source handoff, viewer initialization, navigation, search, and cleanup separately. Include the 25MB boundaries, 50,000 XML blocks, 50,000 EDI transactions, a 5MB EDI element, 250,000 extra segments, deep XML, and a very long single line. Record which inputs actually complete validation. A fixture’s inclusion is not evidence that full viewing succeeds. [D1]

If measurements reject a full-source handoff for some accepted inputs, use a bounded worker-backed excerpt/query design or explicitly unavailable preview for those cases. Preserve validation results. Do not relax the existing file-size or deadline safeguards to conceal viewer overhead.

### FE-13: Preserve the installation contract

The production deliverable remains the existing copy/paste package: dedicated-page HTML, shared JavaScript, and shared CSS. No backend, runtime Node server, CDN editor, remotely fetched grammar/schema, new hosted assets, or server-side rendering is required or authorized. Build-time npm dependencies are distinct from deployment/runtime dependencies.

Preserve the IIFE, ES2022 target, inline worker, and CSS packaging. Avoid dynamic imports that unexpectedly create separately hosted chunks; lazy initialization need not mean network-loaded code. Add only justified dependencies and update the lockfile without unrelated upgrades. [R2, R9]

ReadMe sanitizes Custom Page HTML and directs CSS/JavaScript customization to its Appearance settings. Continue using the repository’s established installation path rather than inserting scripts into page HTML. [E3]

Edit source, build configuration, and generator/templates, then regenerate `readme-package/`. The generator currently writes `custom-page.html` itself; do not invent an existing HTML template path or hand-edit its generated output. Verify static CSS scoping and any library-injected styles, tooltips, or overlays separately. Avoid modifying global portal styles, selectors, event handling, or CSP to accommodate the viewer. [R9]

Hosted checks must include the actual portal CSP, worker startup, viewer styles, existing customization, SPA navigation, modal capture-phase routing, multiple mounts, and unavailable-JavaScript fallback. Local preview or a simulated ReadMe shell does not establish hosted compatibility. [R8, D2]

## 8. Privacy and accessibility

### FE-14: Privacy and untrusted source

Keep the existing test-data warning and validation-readiness limitations. Browser-local processing is not permission to use sensitive payment files and is not isolation from other scripts sharing the ReadMe page. The explorer exposes more source in the page, so it must not strengthen the privacy claim. [D2, D3]

Render source, filenames, locators, messages, and labels as untrusted text. Never feed file-derived content to `innerHTML`, executable templates, remote services, automatic link previews, or fetched schema/DTD resolution. The application’s existing static HTML templates do not justify inserting source text into them.

Keep source contents, filenames, searches, selected snippets, extracted values, and source-derived identifiers out of app-generated network traffic, URL fragments/queries, analytics, session replay, remote exceptions/logs, and persistent browser storage. Do not add telemetry or a shareable source URL. Do not assume other same-page instrumentation ignores a newly introduced editor; include it in hosted review.

User-initiated local copying and the existing CSV export remain available. Do not add snippets to the CSV, change its ten-column schema, or weaken its quoting, BOM, CRLF, and spreadsheet-formula protections. [R7]

### FE-15: Accessibility and reflow

Use clearly labeled regions and native controls where possible. Make finding actions, splitter adjustment, search, go to line, related-target navigation, hide/expand, and return-to-finding fully operable without a pointer. An active finding needs valid accessible selection/current-state semantics and a visible indicator beyond color.

Keep focus predictable: activating a finding can leave focus on its action while announcing the revealed location; **Focus source** explicitly enters the source region. **Back to finding** locates and focuses the current action by identity, not a stale DOM node from an earlier render. Announcements should state the finding/location and whether it is contextual, not recite the whole file or repeat every visible line.

At narrow widths or zoom, replace the side-by-side layout with **Results** and **File** views or an equivalent accessible stacked arrangement. Retain selection and position. Source text may need its own horizontal scrolling; the surrounding workspace, labels, and controls must remain usable without page-level clipping. Test 320 CSS pixels and 200% browser zoom, reduced motion, visible focus, and supported forced-color behavior.

Test VoiceOver/Safari and a Windows screen-reader/browser combination. A virtualized code pane must offer an understandable route to the selected source context; use a small labeled textual context alternative if necessary, not an off-screen copy of the entire document. Do not claim WCAG conformance solely from automated scans.

The repository’s accessibility follow-up log includes unresolved issues. Fix issues directly introduced or exposed by this workspace and record unrelated pre-existing ones separately. Do not describe this feature as resolving the entire log. [D4]

## 9. Implementation organization

Use the existing separation rather than growing all new logic inside `src/app.ts`.

| Existing surface | Expected bounded change |
|---|---|
| `src/types.ts` | Source-location/snapshot contracts and compatible worker payload extensions. |
| `src/parsers/shared.ts`, `src/parsers/iso.ts`, `src/parsers/edi.ts` | Source-aware result construction and position-preserving parser-family mappings. |
| `src/format-packs.ts`, `src/validation.ts` | Carry rule-provided locations through evaluation without altering the rule set or result classification. |
| `src/worker-request.ts`, `src/validation.worker.ts` | Same-source handoff, opt-in explorer work, typed failure boundaries, and bounded enrichment as needed. |
| `src/app.ts` | Mount option, workspace integration, finding actions, selection identity, filter/page synchronization, and cleanup. |
| New focused source/viewer modules | Coordinate mapping, source indexing, viewer adapter, and pure navigation helpers. These module paths are to be chosen, not assumed to exist. |
| `src/styles.css`, `src/main.ts`, `src/readme-entry.ts` | Dedicated workspace styling, preview enablement, explicit surface selection, and router lifecycle integration. |
| `vite.readme.config.ts`, `scripts/finalize-readme-package.mjs`, templates | Preserve self-contained packaging and correct generated installation artifacts. |
| Existing test suites and `docs/` | Extend coverage, document location semantics/limits, and record actual acceptance evidence. |

A sensible dependency order is: establish location semantics and unchanged-validation tests; add source mappings; integrate snapshot lifecycle; add the read-only viewer and linked results; then verify packaging, accessibility, and large-file behavior. Use a working vertical slice early, but do not call v1 complete with only one XML happy path and no EDI or failure-state coverage.

## 10. Acceptance and required evidence

| ID | Acceptance condition | Evidence |
|---|---|---|
| AT-01 | Dedicated page/preview gain the workspace; inline and modal mounts retain existing behavior and unique identities. | Browser checks of all surfaces, multiple instances, reserved-link routing, and unchanged presets. |
| AT-02 | Each current error/warning yields exact, contextual, parser-position, file-wide, or explicit unavailable metadata. | Unit fixtures covering every current rule ID’s reachable non-PASS paths; document justified unlocatable cases. |
| AT-03 | Repeated XML names/values and EDI elements map to the evaluated occurrence, not the first textual match. | Assertions that `S.slice(start, end)` equals the expected original lexical text and matches the intended occurrence. |
| AT-04 | Missing fields, blank values, malformed XML, EOF, and related envelope fields have honest anchors. | Unit and browser assertions for location kind, rendered wording, point/range placement, and related-target selection. |
| AT-05 | Coordinates survive UTF-8 BOM handling, CRLF/LF/CR, mixed endings, tabs, Unicode, entities, comments, CDATA, and minified files. | Canonical/parser/viewer mapping tests, plus representative browser highlights and go-to-line checks. |
| AT-06 | Existing validation semantics remain unchanged. | Compare legacy result projections and overall status before/after for the same fixture/profile, including early returns and aggregate checks. |
| AT-07 | Navigation obeys current search, path/outcome filters, sort, and pagination while excluding PASS from finding navigation. | Tests with more than 25 mixed results, identical rule IDs, unavailable targets, boundaries, and selected-row return. Use test-only synthetic result sets rather than new production rules. |
| AT-08 | New runs, replacements, removal, profile changes, unmount, and navigation cannot display stale source or findings. | Extend `tests/run-lifecycle.test.ts` fake-worker/timer cases with late source/index/search results, same-name different-content files, and successful-completion generation handling. [R11] |
| AT-09 | Source remains read-only; copying and independent source search work without changing validation state. | Keyboard, paste, cut, drag/drop, command, text-copy, search, and hide/reopen browser checks. |
| AT-10 | Explorer/index/rendering failure does not invalidate completed results or CSV export. | Inject mapper/viewer failures and budget exhaustion; verify scoped fallback and unchanged run/export. |
| AT-11 | Resource handling is bounded and the original file is never silently truncated for validation. | Stress-case results with environment, measured phases, configured budgets, fallback state, responsiveness, and recovery after removal/reselection. |
| AT-12 | New content remains local and inert. | Synthetic marker-based network inspection across selection, findings, search, failures, copy/export, and cleanup; hostile-looking XML/HTML text does not execute or create requests. |
| AT-13 | CSV behavior remains unchanged. | Existing CSV tests plus schema/output comparison with explorer on/off, all filters, and viewer failure. |
| AT-14 | Workspace controls and selected context are accessible at desktop, narrow widths, and zoom. | Automated scans plus keyboard and documented manual screen-reader/reflow evidence; clearly separate unverified checks. |
| AT-15 | Regenerated ReadMe package works under its intended host constraints without new asset hosting. | Build inspection, generated-package browser checks, and separately identified real ReadMe draft/CSP acceptance. |

Do not satisfy coverage by making every mapping unavailable. Correct exact targets are required for ordinary supported existing-value errors where the source occurrence is determinable. Context/unavailable is for genuine missing, aggregate, ambiguous, malformed, or bounded-resource cases, with tests and explanations.

The existing `npm run validate` invokes unit tests, stress-generator tests, TypeScript/standalone build, ReadMe build, and Playwright tests. Run focused tests during development and that aggregate command before handoff when the environment supports it. Do not weaken tests, rely on an unrelated running preview server, or present local/Node measurements as browser acceptance. [R2, D1]

When browser launch, hosted access, or manual accessibility verification is unavailable, finish independent authorized work and report the specific unverified acceptance rows. Do not fabricate evidence, repeatedly retry a known environmental failure without new information, or claim the feature is release-approved.

## 11. Deliverables and completion boundary

For an implementation assignment, deliver source changes, focused tests, updated dependency lockfile when necessary, regenerated `readme-package/`, and a short feature document describing source coordinates, location-quality semantics, fallback limits, and installation changes. Update existing processing/accessibility documentation where affected without overwriting its historical evidence.

The final handoff should state what was implemented, material deviations from this specification and why, exact checks run with pass/fail/unverified outcomes, measured viewer limits, remaining hosted/accessibility work, and the next concrete action for any blocker. Separate pre-existing validation defects from defects introduced by this change.

Do not push, merge, publish, or change permissions without separate authorization. Do not mark Product/SC/FT or standards approval complete. The product-level finish is: **a user can select an existing finding, inspect a verified source range or explicitly labeled context, and return to the result without changing the file, changing validation semantics, or exposing file data through new application-controlled transmission or persistence.**

## 12. Source register

Repository observations above come from live read-only inspection of the pinned revision, not an assumption that earlier attachments represent every current file. Requirements and recommendations are the proposed design; they are not claims about already implemented capabilities.

Repository: `https://github.com/antoniodowling/file-validation-wizard`  
Pinned tree: `https://github.com/antoniodowling/file-validation-wizard/tree/2c1fd68cef92817e75b4f2fce4d9915d97b4b1a7`

| Reference | Source within that revision | Relevant evidence |
|---|---|---|
| R1 | `src/app.ts` | Mount options, DOM UI, filters/pagination, file reading, run generation, worker termination, and CSV triggering. |
| R2 | `package.json` | Runtime/build dependencies and actual test/build commands. |
| R3 | `src/types.ts` | Current result/worker contracts, parser families, limits, and failure types. |
| R4 | `src/parsers/iso.ts`; `src/parsers/shared.ts` | XML checks, early returns, local-name/value helpers, and result construction. |
| R5 | `src/parsers/edi.ts` | EDI tokenization, delimiters, aggregate rules, and envelope comparisons. |
| R6 | `src/worker-request.ts`; `src/validation.ts` | Strict decoding, worker guards, completion payload, evaluation flow, and result classification. |
| R7 | `src/csv.ts` | Ten-column export, quoting, formula-prefix neutralization, BOM, CRLF, and filenames. |
| R8 | `src/readme-entry.ts` | Dedicated/inline/modal mounting, capture-phase link interception, and navigation cleanup. |
| R9 | `src/styles.css`; `vite.readme.config.ts`; `scripts/finalize-readme-package.mjs` | Existing width cap, scoped CSS generation, self-contained IIFE, and generated page HTML. |
| R10 | `src/format-packs.ts` | Nine DEMO packs, two parser families, and unapproved production gates. |
| R11 | `tests/run-lifecycle.test.ts` | Fake-worker and fake-timer coverage for stale reads, deadlines, replacement, and failure recovery. |

The following user-supplied documents informed preserved requirements and pending verification. They were not re-executed as tests:

| Reference | Supplied document | Relevant evidence |
|---|---|---|
| D1 | `PROCESSING_LIMITS.md` | Provisional safeguards, synthetic stress cases, and the limits of local measurements. |
| D2 | `INSTALLATION.md` | ReadMe installation, shared-page context, local processing, and hosted acceptance requirements. |
| D3 | `File Valdiation App Requirements Matrix.md` | Draft foundational privacy, test-data, readiness, and sign-off requirements. Original supplied filename retained here. |
| D4 | `ACCESSIBILITY_FOLLOW_UPS.md` | Existing unresolved issues and manual verification boundaries. |

External primary references consulted September 18, 2026:

| Reference | Source | Use |
|---|---|---|
| E1 | `https://codemirror.net/examples/readonly/` | Read-only versus DOM editability and focusability. |
| E2 | `https://codemirror.net/docs/guide/` | Viewport rendering, long-line visible ranges, and decoration-based display. |
| E3 | `https://docs.readme.com/main/docs/custom-page`; `https://docs.readme.com/main/docs/custom-css-and-javascript` | Custom Page HTML sanitization and supported customization surfaces. |
| E4 | `https://encoding.spec.whatwg.org/#interface-textdecoder` | Decoding, fatal errors, and BOM handling. |

Essential requirements from the supplied documents are reproduced in this brief; the receiving agent does not need access to this chat’s attachments. Consult the repository’s current documentation and installed dependency APIs during implementation, and report material drift from this baseline.
