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
