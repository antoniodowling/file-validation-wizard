# Validator hardening — ruleset 2

Starting checkpoint: 440cd2afdb07d16942ef12db80077f235e4cadfb. This work implements the owner's 240-question review locally. All profiles remain DEMO; checks passed means only the published checks passed.

## Requirement-to-evidence plan

| Scope | Implementation and evidence |
| --- | --- |
| A/E: outcomes, coverage, provenance | Versioned checks/coverage and portable CSV/JSON; prerequisite and non-vacuous verdict tests |
| B/D: XML interpretation and locations | Strict namespace-aware adapter; original UTF-16 spans; structural mutation regressions |
| C: EDI ownership | Explicit groups/transactions; delimiter, count, control, membership and version regressions |
| F: resources/lifecycle | Run ownership, bounded 12,000-unit source windows, disposal and stale callback tests |
| G: UX/accessibility/discovery | Container reflow, committed selection, focus, location confidence, synthetic samples; generated browser checks |
| H: evidence/deeper capability | Pinned sources, independent structural fixtures, exact-version deep checks where sourced; browser measurements and acceptance receipt |

## Provisional decisions (owner review deferred)

1. **Source windows:** cap every rendered source window at 12,000 UTF-16 units, including fallback and oversized targets. Full-file CodeMirror virtualization alone does not bound a long line or fallback. Alternatives: retain the 5M model or add a generalized virtual file system. Consequence: large source is paged and highlights may be clipped explicitly. Reverse by changing one budget after browser measurements. Confidence: high for allocation bound, provisional for usability.
2. **XML boundary:** use pinned saxes 6.0.0 with namespaces and XML 1.0 enforced. Reject DTD before model construction; allow inert PI/comment/CDATA. Alternatives: browser DOM (unavailable in workers), existing permissive parser, schema engine. Keep lexical spans separate from normalized text. Reverse through adapter replacement. Confidence: high for strict syntax, no XSD conformance claim.
3. **EDI scope:** one interchange with multiple groups/transactions; no recovery after malformed envelope ownership. ST03 release equality is removed because a profile-specific implementation-guide artifact is absent. Multiple interchanges are unsupported, not a validity judgment. Alternative: guess guide requirements or implement broader scope. Reverse with sourced profile revisions. Confidence: high for honesty of coverage; independent X12 domain review deferred.
4. **Admission:** provisional decoded-character, node, depth, segment and scalar budgets supplement the 25MB byte cap and watchdog. Exhaustion is INCOMPLETE with no validity verdict. Alternatives: timeout alone or streaming every rule. Reverse limits after measured browser acceptance. Confidence: moderate; no supported memory envelope claimed.

## External gates

No hosted ReadMe URL/CSP acceptance, manual screen-reader/zoom evidence, bank-specific implementation guide, domain approval, or production sign-off is available. None is inferred from local tests. Source files stay browser-local; no telemetry or persistent source storage is introduced.

## Primary-source retrieval and deep-profile boundary

- XML 1.0 Fifth Edition: https://www.w3.org/TR/2008/REC-xml-20081126/ and Namespaces 1.0 Third Edition: https://www.w3.org/TR/2009/REC-xml-names-20091208/ reviewed for document grammar, expanded names and normalization.
- W3C suite release 20130923: https://www.w3.org/XML/Test/xmlts20130923.zip downloaded. `tests/fixtures/w3c/manifest.json` pins the archive and 21 selected files by SHA-256, preserves upstream expectations and identifies exclusions. Two document positives and nineteen syntax/namespace negatives pass the adapter. This is a supported-subset regression sample, not full W3C conformance certification.
- Official ISO archive identifies pain.001.001.09 / CustomerCreditTransferInitiationV09 under Payments Initiation V10: https://www.iso20022.org/catalogue-messages/iso-20022-messages-archive?search=pain.001. Its XSD link is https://www.iso20022.org/message/14346/download. Local retrieval returned HTTP 403, including a second download-form attempt. No schema bytes were received or pinned; a third-party mirror was not substituted as authoritative evidence.
- Consequently exact-version schema/cardinality/conditional payment rules, actual transaction and control-sum reconciliation remain **not implemented and excluded**, pending the authoritative schema plus message-definition/usage rules that define their semantics. pain.001.001.09 remains the first deep-profile candidate, not production-supported. Bank payment-method/workflow scope, required optional fields, duplicate scope, control-sum currencies, bank guide revision, independent conformant fixtures and domain review remain specifically unresolved. No Huntington rule is inferred from another bank or from generic ISO.
- Independent X12 820 implementation guides for 004010/005010/008030 were not supplied. Envelope checks are explicitly DEMO structural expectations. In particular ST03 is not asserted to equal the release. Domain sign-off and exact artifacts gate a production or X12-conformance claim, not the implemented local safety fixes.

## Historical fixtures

The old `multiple-errors` XML fixture has an incorrect message container. Ruleset 2 now correctly emits its primary container failure and suppresses four misleading descendant errors and the dependent advisory. The original fixture remains unchanged for historical interpretation; updated tests prove suppression. Generated-registry fixtures and in-app samples remain wiring evidence only. The literal structural mutations in `tests/hardening.test.ts` plus pinned W3C cases independently challenge parser behavior. No human/domain fixture approval is claimed.

## Delivered local behavior and remaining gates

| Review questions | Delivered evidence / exact boundary |
| --- | --- |
| 1–12, 73–90, 104–112 | Coverage snapshot for all nine exact profiles; schema-2 CSV/JSON, stable rule IDs plus revision, separate check states and occurrence results, explicit unsupported/no-verdict state, non-vacuous outcome regression. Resource/engine failures remain explicit incomplete UI failures with exports disabled. |
| 13–35 | Pinned strict saxes adapter, expanded names, scalar/cardinality guards, DTD policy outside inert lexical content, prerequisite suppression; 21 pinned W3C cases and targeted mutations. |
| 36–50, 206–218 | Existing DEMO structural subset corrected. Deep pain.001.001.09 remains blocked on exact authoritative schema/MDR retrieval (403) and missing bank/workflow decisions. Count reconciliation, decimal control sums, conditional payment fields and full schema validation are excluded, not silently claimed. |
| 51–72 | Explicit groups and transactions, trustworthy nesting, final termination, each envelope's control/count/version checks and transaction-local BPR. Complete multiple interchanges unsupported; malformed subsequent envelopes fail. X12 mappings/content remain DEMO pending primary artifacts. |
| 91–103 | Original half-open UTF-16 spans from the validation structures; exact/context/parser-stop distinction, neutral context highlight, exposed explanations, previous/next affected occurrence, 32-related-target truncation disclosure. |
| 113–140 | RunController owns worker/generation/timers/accepted run, read invalidation and announcements; revalidation/enrichment regression; bounded source/fallback and clear-source tests; provisional structural budgets and no memory-zeroization promise. |
| 141–171 | Actual pane container queries, deliberate accessible table scrolling, 320–400px stacked options, committed-search guard, Continue/results/hide/remove focus, completion does not hide controls the user moved to, warning contrast allowance removed. |
| 172–183 | W3C upstream expectations/hashes and source revision; literal structural negatives and synthetic fixture provenance. Human review and independent standards-conformant payment positives remain a production gate. |
| 184–205 | Rebuilt shared ReadMe bundle; generated-mount/browser/privacy and accessibility checks; local repeated-run performance/heartbeat/available-JS-heap measurements. Actual ReadMe CSP/routing/host behavior, manual screen-reader/zoom and full process-memory envelope remain deferred. |
| 219–229 | Executable profiles lead; explicit reference-browsing toggle; support before version selection; local synthetic PASS/FAIL samples per profile; exact-version coverage guide and honestly labeled general family link. |
| 230–240 | Small adapter/controller modules preserve worker/local-only architecture; no framework/backend or wider catalogue; exact source-derived build hash, retained legacy-report interpretation and clean checkpoint delivery. |

`tests/fixtures/synthetic-provenance.json` pins synthetic fixtures/test sources separately from W3C inputs. Synthetic positives intentionally prove only the published structural subset, not executable payment completeness.

## Final local validation receipt

See [machine-readable receipt](evidence/ruleset-2/receipt.json) for exact JavaScript/CSS SHA-256 values and the acceptance boundary. [Final 30% wizard-pane screenshot](evidence/ruleset-2/split-30-percent-chromium.png) was inspected visually; step labels, summary, filters and source details remain readable. Table scrolling is deliberate and keyboard-labeled. Splitter Home/End (30%/70%) and expanded coverage are tested without page or pane overflow.

- Broad Vitest checkpoint: **151 passed**. Subsequent changes received focused validation (51 hardening/lifecycle/CSV/sample tests, 24 final lifecycle/coverage tests, and 14 stress-policy tests). These overlapping counts are not added into a claimed aggregate final-suite run. All checks actually run passed after the described repairs.
- TypeScript, standalone build, regenerated ReadMe package and static package contract passed. The 14-file stress-kit integrity check passed; expected metadata now matches RESOURCE_LIMIT behavior, with original payload bytes/checksums preserved.
- Full three-browser checkpoint: **93/96 passed**, with the same stale single-element highlight assertion failing in all three browsers. After correcting that assertion and final discovery/focus work, **30/30 affected cases passed**. Final layout/summary bundle received **9/9 affected cases** across Chromium, Firefox and WebKit. The unchanged entire suite was not repeated. No expected-failure or contrast exception remains in the browser tests.
- Generated mount tests cover 320/375/400/1440 CSS pixels, pane splitting, unsupported search/committed selection, local samples, focus, provenance downloads and source cleanup. Prior full-run automated axe scans passed without the former warning contrast allowance. This is local automated evidence, not WCAG certification or hosted acceptance.
- Local browser measurements are committed beside the receipt. They measure wall time to interactive finding selection, main-thread heartbeat gaps and exposed JS heap estimates for 295 / 300,195 / 295 decoded-unit runs. Source DOM is empty after every removal. Heap readings are unavailable in Firefox/WebKit and coarse in Chromium; neither process peak memory nor GC recovery is proven. These small synthetic runs do not establish a supported 25MB workload or a performance guarantee.

The sandbox initially prevented Chromium Mach-port startup. The approved local browser run resolved that environment failure without application workarounds. No source-bearing request, backend, persistence, push, PR, deployment or publication was introduced.

## Deferred-work custody — 2026-10-14 cleanup

Source task: `01a0b81e-fc05-7921-b026-8c8b58a89578`, assigned on 2026-09-19 from source task `01a0b7f3-0639-7911-9b18-1041c5c6158e`. The original assignment allowed missing hosted, specification and manual evidence to gate the affected claim while safe local work continued. Stored original history was reconciled through the owner's 2026-10-14 cleanup request and later explicit GitHub merge hold. No successor was created by this task or verified as owning the outstanding scopes below. These records preserve future work; cleanup does not start it.

| Outstanding scope and status | Responsible party / coverage | Existing evidence and concrete next action | Resumption condition |
| --- | --- | --- | --- |
| Deep pain.001.001.09 schema/cardinality, conditional payments, counts and exact-decimal sums — blocked and excluded | API/Product owners for artifacts/workflow decisions; no successor | Primary-source retrieval section above; obtain and pin the exact XSD/MDR and applicable Huntington guide, then define the intended payment workflow and implement only sourced rules with independent fixtures. | Exact artifacts available, bank/workflow decisions recorded, dedicated implementation assignment. |
| Independent X12 820 version/implementation rules for 004010/005010/008030 — blocked; DEMO envelope subset only | API/domain owners; no successor | Coverage snapshot and structural tests above; verify ISA12/GS08 mappings and ST03 semantics against each exact base/implementation artifact before changing rules. | Authorized primary artifacts and independent reviewed fixtures available. |
| Hosted ReadMe CSP/Blob worker, routing/customization coexistence and source non-transmission acceptance — explicitly deferred | Portal maintainer; no successor | `docs/DEVELOPER_HANDOFF.md` hosted procedure and `docs/evidence/ruleset-2/receipt.json`; supply an unpublished staging mount and run the checklist against its exact bundle hash. | Staging access supplied; no Production publication is authorized by cleanup. |
| Manual screen readers, actual 200% zoom/device acceptance — explicitly deferred | Accessibility tester; no successor | `docs/ACCESSIBILITY_FOLLOW_UPS.md`; execute the remaining manual checks and record browser/device, exact bundle, outcomes and failures. | Tester and suitable environments available. |
| Process peak memory, GC recovery and representative browser envelope — explicitly deferred | Front-end/performance maintainer; no successor | Existing bounded synthetic browser measurements; measure representative and pathological workloads before increasing provisional limits or claiming 25MB support. | Workload definition and a separate measurement assignment. |
| Provisional rendering/admission/EDI scope decisions and production promotion — owner review deferred; DEMO remains enforced | Owner/API/Product approvers; no successor | Decisions above and revision-bound release gates in `src/format-packs.ts`; assess each decision and obtain specification/ruleset/fixture/acceptance revision sign-offs before promotion. | Explicit review/sign-offs; activation/deployment requires separate authorization. |
| GitHub integration of this task — held by owner on 2026-10-14 | Current chat, blocked at merge; no successor | Cleanup may prepare/publish the task PR and report exact checks. The owner directed: "DO NOT MERGE ANYTHING INTO GITHUB YET stop before that". | Owner explicitly releases the GitHub merge hold; exact-head gates then rechecked. |

The record, coverage snapshots, fixtures, generated bundles and September acceptance receipts are tracked in this task branch. The active task worktree is retained while its PR is unmerged, so no sole-copy deferred artifact is retired. The source review worktree is a reference, not a worktree created or retired by this task. No deployment, release, migration or production activation was part of the local implementation or cleanup delivery.

Cleanup reconciliation preserves the already-integrated line-number capability from main `52154df6713ef0e7f4320cf9eb0e55c5cd374a9c`, including line summaries on compact mounts without sending decoded source to those mounts. The local combined candidate passed 185 unit tests, stress integrity, TypeScript, standalone/ReadMe builds and the package contract. A full local three-browser run passed 96/99 cases; the remaining three shared an obsolete fixed-centering assertion, replaced with pane-containment geometry while retaining the axe scan. The three repaired browser cases passed in the focused Chromium/Firefox/WebKit follow-up. September receipts remain historical receipts for their original exact bundles.

Installation reported the existing `source-map-js` 1.2.1 development/build dependency advisory GHSA-68fv-2mgg-jv7q (indexed source-map offset denial of service). The same locked version exists on the pinned main baseline. This cleanup does not invoke a blanket audit fix or claim the advisory is resolved; a targeted build-dependency maintenance assessment is optional separate work. Payment parsing remains browser-local and does not use this build dependency to interpret uploaded source.
