# Validator review follow-up

Updated: 2026-10-14.

This document records the remaining work after the structural-correctness,
resource-lifecycle, provenance and usability improvements. It does not enable
production profiles or authorize deployment. The detailed implementation and
historical evidence remain in [IMPLEMENTATION_EVIDENCE.md](IMPLEMENTATION_EVIDENCE.md).

## Completed engineering scope

The hardening candidate is
`e8d56e1681a0a4da5009190445377907066768a1`, delivered through
[PR #13](https://github.com/antoniodowling/file-validation-wizard/pull/13),
merged as `1653a4c3511d1fd565775fda9fa26551b23244a3`.
It preserves the existing source-line-number feature while correcting XML and
EDI structural boundaries, run cleanup, source-display limits, result coverage,
CSV/JSON provenance, responsive layouts and keyboard focus.

[Exact-candidate CI](https://github.com/antoniodowling/file-validation-wizard/actions/runs/38587866620)
passed 185 unit tests, 99 browser cases, builds, stress-file integrity,
package checks and generated-package drift. The replacement for the former
fixed-centering assertion checks that step labels fit inside the actual pane;
the accessibility scan remains enabled. Passing these checks establishes the
implemented DEMO behavior, not complete standards conformance or bank acceptance.

The experimental 100-target discovery feature was withdrawn before publication.
It is excluded from this delivery; its original work remains in local Git
history for reference. Do not restore it without a new explicit implementation
request. Other proposed capabilities, including File X-ray, payment reconciliation
views, repair sandbox and shareable HTML reports, remain unaccepted proposals.

## Deferred work and resumption conditions

| Scope and status | Responsible role | Evidence and next action | Resumption condition |
| --- | --- | --- | --- |
| Deep pain.001.001.09 validation: blocked and excluded | API/Product and domain owners | Obtain and pin the exact XSD/MDR and applicable bank guide; agree the payment workflow; add independently verified fixtures before implementing conditional fields, actual transaction-count reconciliation and exact-decimal control sums. The existing evidence record documents unsuccessful official schema retrieval and the exclusions. | Authoritative artifacts and workflow decisions are available, with a dedicated implementation assignment. |
| Exact X12 820 rules for 004010/005010/008030: blocked; DEMO structural subset only | API/domain owners | Verify each version's envelope mappings, implementation identifiers and business rules against its exact authoritative guide. Do not infer ST03 requirements from another transaction type. | Exact authorized standards/implementation artifacts and independent fixtures are available. |
| Hosted ReadMe compatibility and source privacy: explicitly deferred | Portal maintainer | Execute the [hosted acceptance checklist](DEVELOPER_HANDOFF.md) on an unpublished staging mount, recording candidate/bundle hashes, CSP and Blob-worker behavior, routing, customization coexistence and absence of source-bearing requests. | Staging access and authorization for the hosted test are supplied. |
| Manual accessibility and workflow acceptance: explicitly deferred | Accessibility tester and product owner | Complete the [accessibility follow-ups](ACCESSIBILITY_FOLLOW_UPS.md), including screen-reader and actual zoom/device checks; assess the final workflow and record outcomes against the exact bundle. | Appropriate tester and environments are available. |
| Supported browser capacity and recovery: explicitly deferred | Front-end/performance maintainer | Extend the bounded synthetic measurements to representative and pathological workloads, process peak memory and repeated-run/GC recovery before changing provisional limits or claiming 25 MB support. See [processing limits](PROCESSING_LIMITS.md). | A bounded measurement assignment and representative synthetic workload are defined. |
| Provisional policy decisions and production promotion: review deferred; ISO/X12 stay DEMO and NACHA stays CANDIDATE | Product/domain approvers | Review rendering/admission limits and EDI multiplicity, then tie any promotion to exact specifications, rulesets, fixtures and environment acceptance. Keep fail-closed profile gates in place. | Explicit revision-bound sign-offs exist; deployment/activation needs separate authorization. |

No executing successor is assigned to these deferred items. The roles above
identify the inputs and acceptance responsibilities; they are not evidence that
work has started or approval has occurred. Missing external evidence continues
to gate the corresponding readiness claim even after Git integration.

## Delivery and preservation boundaries

Git publication and integration of the completed hardening changes and this
follow-up are approved. Production deployment, profile activation, release,
paid standards acquisition and customer-file collection are outside this scope.
The application keeps file contents browser-local and transient.

Cancelled discovery history, unrelated local changes, ignored artifacts and
existing stashes must be preserved. Git integration is distinct from hosted
acceptance and production approval. Continue future work from the current target
in a separate task worktree, using the exact remaining scope above.
