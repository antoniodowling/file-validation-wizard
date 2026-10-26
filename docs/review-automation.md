# Current branch-freshness policy

Successful required CI for the unchanged PR head remains eligible when main
advances. The controller supports strict and loose required checks and retains a
run's valid recorded base instead of requiring it to equal today's target SHA.
PR/head/repository/workflow, any supplied target ref, latest attempt and actual
aggregate success remain bound. Docs classification uses current target/merge
objects and snapshot changes during evaluation still fail closed.

The approved provider rollout changes only required-check freshness, preserving
required contexts/issuers, holds and other protections. No new CI lane or review
requirement is added. Refresh branches for conflicts or identified interactions
that invalidate affected proof; loose checks accept clean semantic-interaction
risk. This current owner decision supersedes earlier strict-base wording below.

## Earlier policy and acceptance records

# Current docs-only scope — explicit owner correction

All plain-text Markdown documents use the same docs-only CI and automatic merge
flow, including agent/skill instructions, governance and tracking records,
security and operational runbooks, and documentation in template/fixture,
instruction-audit and skill-maintenance folders. Common root legal/contribution
documents qualify too. Document names and directories do not select application
builds; there is no separate instruction-validation lane or mandatory review gate.

Complete immutable Git proof on both rename paths, regular non-executable modes,
UTF-8/no-binary checks, current-head/repository/issuer identity, deliberate holds
and native protection remain. Actual code, workflow/configuration, dependency,
executable/binary and mixed inputs keep their applicable validation.

This explicit owner decision supersedes the document exclusions in the earlier
policy below. Its source and provider evidence remain historical.

## Earlier policy record

# Repository CI and documentation merge policy

M4 adopts the policy proven in the Software Delivery Management, Eero and Yonio
representatives. Mandatory review gates remain removed. Ready code starts the
existing applicable CI without a submitted review, marker or label. Draft source
jobs skip before runner allocation; independent engineering review still applies
to implementation delivery. Holds, blocking objections and native protections stay.

Owner-authored same-repository prose is classified from complete immutable Git
changes using trusted target-base code. Unknown, executable, binary, instruction
and enforcement inputs retain full validation. Required results say
`Not required — documentation-only` for admitted prose; test success is never
invented. Rename/deletion paths, modes and the complete main push range are checked.

The trusted default-branch controller uses the existing status-only App and its
main-only credential environment. Candidate code never receives privileged
credentials. The App-pinned `docs-merge-policy` complements the unchanged native
substantive requirements; code needs actual required aggregate success from the
latest matching workflow/run attempt. Informational jobs do not replace proof.
Qualified docs may enable native auto-merge at the exact classified head. Strict
base, thread resolution, force/deletion protection and deliberate holds remain.
Review-related labels and timestamps do not start CI or establish eligibility.

## Suspension and rollback

Disarm affected docs-owned auto-merge requests before suspending automation.
Set `DOCS_AUTOMERGE_ACTIVE=false` and reconcile affected PRs through the trusted
controller. Retain substantive requirements and existing credentials. Restore
reviewed source/settings only against expected-current readback; never remove all
branch protection. An unsafe bypass stops further rollout. Credential or runner
failures remain explicit destination blockers.

No deployment, release, live-data access, device installation, native activation,
credential privilege expansion or scheduler amendment is authorized by this policy.

## Superseded bootstrap record

The material below describes the earlier review-before-CI bootstrap. M4 supersedes
its operational instructions; it remains historical evidence, not current policy.

# Review-gated CI bootstrap

Status: inactive infrastructure candidate adapted from the accepted Ansible pilot
at `2ed672ffbc53f035186cedbb42e6c00c4cc1141f`. Local policy fixtures are not
file-validation-wizard provider acceptance. This source change configures no App
installation, credential, environment, repository variable, rule or merge setting.

## Trust boundary

Only submitted reviews from `antoniodowling` (ID `26848379`) count. The latest
completed trusted review must reference the current full head through its
`commit_id`, begin with `LGTM`, and contain exactly one matching marker:

```text
LGTM

<!-- chatgpt-hourly-pr-review:v1 head=FULL_LOWERCASE_40_CHARACTER_SHA -->
```

Use a COMMENT review for a same-account PR: GitHub disallows self-approval.
GitHub identifies the account, not whether ChatGPT or a human submitted its
review. Bodies, issue comments, reactions and labels cannot grant authorization.
A `ci-ready` label only triggers a fresh authoritative evaluation. Stale,
incomplete, dismissed or superseded reviews, outstanding changes requests,
unresolved threads, drafts, shared heads, forks, retargets and integration holds
fail closed. Supported PRs belong to this repository and target `main`.

The trusted controller checks out `main` only, reads GitHub APIs, and never
executes PR code or consumes PR artifacts. The notification workflow has no
permissions. The ordinary controller token has contents read, PR write (needed
for stale-label removal) and Actions write (obsolete-run cancellation). Status
writes use a separate native-fetch transport with a dedicated status-only App
token; the ordinary workflow token cannot substitute for it.

Use the existing enforcement App `5363850` with metadata read and commit-status
write only. Its token request names only `file-validation-wizard`. Before
credential provisioning, restrict the `review-enforcement` environment to branch
`main` only, without tag rules. Keep the key only in environment secret
`ANTONIOPRREVIEWENFORCEMENT20261017PRIVATEKEYPEM` and the App ID in environment
variable `REVIEW_ENFORCEMENT_APP_ID`. Never expose key values in repository source,
logs, artifacts or chat. The PR validation job receives no App credential.

## Existing validation and evidence

Repository variable `REVIEW_AUTOMATION_ACTIVE` defaults to inactive when unset or
not `true`. Inactive mode and main pushes execute baseline validation normally;
this bootstrap mode does not establish review-gated enforcement.

`Validate handoff` retains job/check `validate`, runner `ubuntu-latest`, its
20-minute limit, Node from `.nvmrc`, `npm ci`, `validate:core`, ReadMe drift checks,
Chromium/Firefox/WebKit installation, the original single-worker browser tests,
and always-uploaded `browser-evidence` with 14-day retention. Policy fixtures run
before the existing commands. No deployment is added.

In active mode, trusted-main `authorize-review` must allow the exact current
head/base before `validate` is allocated. Always-running `ci-verification`
rechecks authorization and mandatory results. The controller independently reads
all three mandatory jobs (`authorize-review`, `validate`, `ci-verification`) from
the exact workflow, repository, head, base and PR event after the review.
Missing, failed, skipped, cancelled or duplicate jobs cannot supply full evidence.
A duplicate event can reuse a previous fully executed successful run at the same
revision and review; a skipped-only suite never qualifies. New full-suite failures
supersede old success. Unrelated-label run titles do not qualify. Same-head runs
queue; synchronization cancels only this PR's obsolete-head validation runs.

`.github/`, `ci/`, `tools/`, `scripts/`, `.pmo/`, `AGENTS.md`, this runbook,
`package.json`, `package-lock.json`, `.nvmrc`, `playwright.config.ts`,
`tsconfig.json`, `vite.config.ts` and `vite.readme.config.ts` require separate
owner-controlled infrastructure review. Renames from protected paths also block.
There is no override label and such infrastructure PRs remain outside unattended
integration. Use synthetic fixtures only; this public repository must never
receive private payment files or credentials.

## Integration and activation gates

1. Publish an inactive draft, independently review its exact head, and satisfy
   existing native validation before legitimate infrastructure integration. Do
   not fabricate an hourly-review marker, arm auto-merge for this infrastructure
   PR or bypass protections.
2. Preserve ruleset `24968933` and its strict-current-base `validate` check pinned
   to GitHub Actions integration `15368`. Never replace or suspend that gate.
3. After trusted source reaches `main`, separately provision the existing App's
   selected-repository installation and main-only environment. First demonstrate
   failure-only status publication, then append `review-gate` and `ci-required`
   pinned to App `5363850`. Preserve stronger native protections; require PRs,
   current base, resolved threads, and no deletion/force-push.
4. Read back actual settings/rules/environment/source identity, exercise provider
   negatives (no review, label alone, stale head, failure/skips, wrong source,
   forbidden PR credential ref, protected-path change), and verify native denial.
5. Obtain a genuine separately scheduled ChatGPT review of an ordinary synthetic
   fixture and observe full CI, App/native gates and exact-head native auto-merge.
   Ansible acceptance alone does not activate this repository. Record actual
   security-policy effects and reversal after provider changes; do not pre-record
   source work as configuration acceptance.

## Recovery and handoff

For a stale handoff, re-read the current head and original review; if still valid,
remove/re-add `ci-ready` to generate an event. Do not repeat unchanged LGTM reviews.
Dispatching trusted enforcement recomputes statuses without running the suite.
Thread resolution may require that handoff; native unresolved-thread enforcement
must remain active between asynchronous workflow events.

For emergency stop, disable each armed PR's auto-merge, remove `ci-ready` or add
`merge-hold`, then dispatch trusted enforcement to invalidate current statuses.
Disable new auto-merge requests while retaining required rules. Setting active
mode false alone restores bootstrap validation; removing the key before status
invalidation is not an emergency stop. Diagnose failures from the exact head's
status target, current review/labels/threads, mandatory job results and restricted
environment, without printing secrets.

## Prepared protected handoff capability

The prepared controller's primary protected handoff uses a separate actual
GitHub review submitted by the authorized owner, headed `PROTECTED INTEGRATION AUTHORIZED` and containing the reserved `protected-integration-authorization:v1`
marker. The ordinary hourly reviewer must never emit that marker. Main-installed
bootstrap records remain supported. Issue comments and PR descriptions cannot
supply this authorization.

`buildOperatorReview` only formats proposed review data; it submits nothing and
grants no authority. The independent operator must assess and submit the actual
review. Its `approvedBase` may preserve the original qualified CI base after main
advances; current-head, trusted-policy and ancestry checks still apply. These are
source-candidate capabilities: installation, independent bootstrap and activation
remain separate gates.
