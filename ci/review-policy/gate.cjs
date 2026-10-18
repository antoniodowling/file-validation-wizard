'use strict';
const policy = require('./policy.json');
const SHA = /^[0-9a-f]{40}$/;
const deny = reason => ({ok: false, reason});

// Only actual submitted reviews are evidence. PR bodies and issue comments are
// deliberately absent from this interface. All inputs must be complete API reads.
function evaluate(s, p = policy) {
  if (s.active !== true) return deny('automation inactive');
  const pr = s.pr;
  if (!pr || pr.state !== 'open' || pr.draft !== false) return deny('PR closed or draft');
  if (!SHA.test(pr.head?.sha || '') || !SHA.test(pr.base?.sha || '')) return deny('invalid revision');
  if (pr.base.ref !== p.base || pr.base.repo?.full_name !== p.repository ||
      pr.head.repo?.full_name !== p.repository) return deny('unsupported base or fork');
  if (s.sameHeadPRs !== 1) return deny('head shared by multiple PRs or ambiguous');
  if (!Array.isArray(pr.labels) || !pr.labels.some(l => l.name === 'ci-ready')) return deny('ci-ready missing');
  if (pr.labels.some(l => ['merge-hold', 'dependencies-pending'].includes(l.name))) return deny('integration hold');
  if (!Array.isArray(s.files) || s.files.length !== pr.changed_files || !s.files.length) return deny('incomplete file list');
  const protectedPath = path => !path || path.includes('..') || p.protectedFiles.includes(path) || p.protectedPrefixes.some(prefix => path.startsWith(prefix));
  if (s.files.some(f => protectedPath(f.filename) || (f.previous_filename && protectedPath(f.previous_filename)))) return deny('enforcement change requires separate manual review');
  if (!Array.isArray(s.threads) || s.threads.some(t => t.isResolved !== true)) return deny('unresolved review thread');
  if (!Array.isArray(s.reviews)) return deny('review data missing');
  const reviews = s.reviews.filter(r => r.state !== 'PENDING').sort((a,b) => a.id - b.id);
  const trusted = reviews.filter(r => p.reviewers.some(u => u.id === r.user?.id && u.login === r.user?.login));
  const last = trusted.at(-1);
  if (!last || !['APPROVED', 'COMMENTED'].includes(last.state)) return deny('no current trusted completed LGTM');
  if (last.commit_id !== pr.head.sha || !last.submitted_at || !Number.isFinite(Date.parse(last.submitted_at))) return deny('stale or incomplete review');
  const body = (last.body || '').replace(/\r\n/g, '\n');
  const markers = body.match(/<!-- chatgpt-hourly-pr-review:v1 head=[0-9a-f]{40} -->/g) || [];
  if (body.split('\n')[0].trim() !== 'LGTM' || markers.length !== 1 ||
      markers[0] !== `<!-- chatgpt-hourly-pr-review:v1 head=${pr.head.sha} -->`) return deny('invalid review marker or outcome');
  // An outstanding formal changes request from any reviewer remains blocking;
  // only that same identity can supersede its own request through a later review.
  const latestByAuthor = new Map();
  for (const r of reviews) latestByAuthor.set(r.user?.id, r);
  if ([...latestByAuthor.values()].some(r => r.state === 'CHANGES_REQUESTED')) return deny('outstanding changes request');
  if (reviews.some(r => r.id > last.id && r.state === 'CHANGES_REQUESTED')) return deny('later blocking review');
  return {ok: true, reason: 'current trusted SHA-bound LGTM', head: pr.head.sha,
    base: pr.base.sha, reviewId: last.id, reviewedAt: last.submitted_at};
}

function ciEvidence(candidates, authorization, pr, p = policy) {
  if (!authorization.ok) return {state: 'failure', reason: authorization.reason};
  let reuse = false;
  for (const {run, jobs} of candidates) {
    if (!['CI pull_request labeled ci-ready', 'CI pull_request ready_for_review -', 'CI pull_request opened -', 'CI pull_request synchronize -', 'CI pull_request reopened -'].includes(run.display_title) || run.event !== 'pull_request' || run.path !== p.ciPath || run.head_sha !== authorization.head ||
        run.head_repository?.full_name !== p.repository ||
        Date.parse(run.created_at) < Date.parse(authorization.reviewedAt) ||
        !run.pull_requests?.some(r => r.number === pr.number && r.base?.sha === authorization.base && r.head?.sha === authorization.head)) continue;
    if (run.status !== 'completed') return {state: 'pending', reason: 'authorized CI still running'};
    if (!Array.isArray(jobs) || jobs.length !== p.ciJobs.length || p.ciJobs.some(n => jobs.filter(j => j.name === n).length !== 1)) {
      return {state: 'failure', reason: 'mandatory CI jobs missing or duplicated'};
    }
    const syntax = jobs.find(j => j.name === 'validate');
    const controls = jobs.filter(j => j.name !== 'validate');
    if (syntax.conclusion === 'skipped' && controls.every(j => j.status === 'completed' && j.conclusion === 'success') && run.conclusion === 'success') {
      // Explicit duplicate-event reuse: keep looking for the original, fully
      // executed suite at the same head/base after the same review. Never accept
      // a skipped suite without that original evidence.
      reuse = true;
      continue;
    }
    if (run.conclusion !== 'success' || jobs.some(j => j.status !== 'completed' || j.conclusion !== 'success')) {
      return {state: 'failure', reason: 'mandatory CI failed, skipped or cancelled'};
    }
    return {state: 'success', reason: reuse ? 'reused fully successful exact-revision CI' : 'all mandatory CI jobs passed', runId: run.id};
  }
  return {state: 'failure', reason: 'no fully executed authorized CI for current revision'};
}

async function snapshot(github, repo, number, active) {
  const {data: pr} = await github.rest.pulls.get({...repo, pull_number: number});
  const [reviews, files, associated] = await Promise.all([
    github.paginate(github.rest.pulls.listReviews, {...repo, pull_number: number, per_page: 100}),
    github.paginate(github.rest.pulls.listFiles, {...repo, pull_number: number, per_page: 100}),
    github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {...repo, commit_sha: pr.head.sha, per_page: 100})
  ]);
  const threads = [];
  let cursor = null;
  do {
    const result = await github.graphql(`query($owner:String!,$repo:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}`, {owner: repo.owner, repo: repo.repo, number, cursor});
    const page = result.repository?.pullRequest?.reviewThreads;
    if (!page || !Array.isArray(page.nodes)) throw new Error('Incomplete review threads');
    threads.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (page.pageInfo.hasNextPage && !cursor) throw new Error('Missing thread cursor');
  } while (cursor);
  return {active, pr, reviews, files, threads, sameHeadPRs: associated.filter(r => r.state === 'open' && r.head?.sha === pr.head.sha).length};
}

async function candidates(github, repo, head, excludeRunId) {
  const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {...repo, workflow_id: policy.ciWorkflow, head_sha: head, event: 'pull_request', per_page: 100});
  const result = [];
  for (const run of runs.sort((a,b) => b.id - a.id)) {
    if (String(run.id) === String(excludeRunId)) continue;
    const jobs = run.status === 'completed' ? await github.paginate(github.rest.actions.listJobsForWorkflowRun, {...repo, run_id: run.id, filter: 'latest', per_page: 100}) : null;
    result.push({run, jobs});
  }
  return result;
}

async function authorize({github, context, core, active}) {
  const repo = context.repo;
  const number = context.payload.pull_request.number;
  const s = await snapshot(github, repo, number, active);
  const a = evaluate(s);
  if (!a.ok) throw new Error(a.reason);
  if (a.head !== context.payload.pull_request.head.sha || a.base !== context.payload.pull_request.base.sha) throw new Error('PR changed since CI event');
  const e = ciEvidence(await candidates(github, repo, a.head, context.runId), a, s.pr);
  core.setOutput('run-tests', e.state === 'success' ? 'false' : 'true');
  core.setOutput('head', a.head);
  core.setOutput('base', a.base);
}

async function verify({github, context, head, base, syntaxResult, active}) {
  if (!active) {
    if (syntaxResult !== 'success') throw new Error('Bootstrap syntax suite did not pass');
    return;
  }
  const s = await snapshot(github, context.repo, context.payload.pull_request.number, active);
  const a = evaluate(s);
  if (!a.ok || a.head !== head || a.base !== base) throw new Error('Authorization changed during CI');
  if (syntaxResult === 'success') return;
  if (syntaxResult !== 'skipped') throw new Error('Mandatory test job failed or cancelled');
  const prior = ciEvidence(await candidates(github, context.repo, head, context.runId), a, s.pr);
  if (prior.state !== 'success') throw new Error('Skipped suite has no reusable successful evidence');
}

// Keep App status authentication outside Octokit's default auth hook. A per-request
// Authorization override on the ordinary workflow client is overwritten by that
// hook and cannot establish the distinct App source required by native rules.
async function postStatus({repo, sha, contextName, state, description, targetUrl, statusToken, fetchImpl = fetch}) {
  if (!statusToken) throw new Error('Dedicated enforcement App token is required; no GITHUB_TOKEN fallback');
  if (`${repo.owner}/${repo.repo}` !== policy.repository || !SHA.test(sha)) throw new Error('Invalid status destination');
  const response = await fetchImpl(`https://api.github.com/repos/${repo.owner}/${repo.repo}/statuses/${sha}`, {
    method: 'POST', redirect: 'error',
    headers: {accept: 'application/vnd.github+json', authorization: `Bearer ${statusToken}`,
      'content-type': 'application/json', 'user-agent': 'review-gate-enforcement', 'x-github-api-version': '2022-11-28'},
    body: JSON.stringify({context: contextName, state, description: description.slice(0,140), target_url: targetUrl})
  });
  if (response.status !== 201) throw new Error(`Dedicated App status publication failed (HTTP ${response.status})`);
}

async function control({github, context, active, statusToken, fetchImpl = fetch}) {
  if (!statusToken) throw new Error('Dedicated enforcement App token is required; no GITHUB_TOKEN fallback');
  const repo = context.repo;
  let prs = [];
  if (context.payload.pull_request) prs = [context.payload.pull_request.number];
  else if (context.payload.workflow_run) {
    const eventRun = context.payload.workflow_run;
    // Fetch the authoritative run, not data or artifacts from an untrusted job.
    const {data: run} = await github.rest.actions.getWorkflowRun({...repo, run_id: eventRun.id});
    if (!['.github/workflows/review-activity.yml', policy.ciPath].includes(run.path)) throw new Error('Unexpected source workflow');
    if (!['pull_request', 'pull_request_review', 'pull_request_review_comment'].includes(run.event)) return;
    prs = (run.pull_requests || []).map(r => r.number);
    if (!prs.length) {
      const associated = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {...repo, commit_sha: run.head_sha, per_page: 100});
      prs = associated.filter(r => r.state === 'open').map(r => r.number);
    }
    if (!prs.length) {
      // Review events can reference a synthetic merge SHA with no associated
      // PR in the run payload. Reconcile open PRs rather than lose invalidation.
      const open = await github.paginate(github.rest.pulls.list, {...repo, state: 'open', per_page: 100});
      prs = open.map(r => r.number);
    }
  }
  for (const number of [...new Set(prs)]) {
    let pr;
    const publish = (contextName, state, description) => postStatus({repo, sha: pr.head.sha, contextName, state, description, targetUrl: `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`, statusToken, fetchImpl});
    try {
      ({data: pr} = await github.rest.pulls.get({...repo, pull_number: number}));
      await publish('review-gate', 'pending', 'Checking current revision authorization');
      await publish('ci-required', 'pending', 'Checking current revision CI evidence');
      const s = await snapshot(github, repo, number, active);
      if (s.pr.head.sha !== pr.head.sha) throw new Error('PR changed during evaluation');
      const a = evaluate(s);
      if (context.eventName === 'pull_request_target' && context.payload.action === 'synchronize') {
        const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {...repo, workflow_id: policy.ciWorkflow, event: 'pull_request', per_page: 100});
        for (const run of runs) {
          if (run.head_sha !== pr.head.sha && run.head_branch === pr.head.ref && run.head_repository?.full_name === policy.repository &&
              ['queued','in_progress','waiting','pending','requested'].includes(run.status) &&
              run.pull_requests?.some(r => r.number === number)) {
            await github.rest.actions.cancelWorkflowRun({...repo, run_id: run.id});
          }
        }
      }
      // New commits must clear stale handoff labels. A concurrent genuine review
      // for the new head is preserved; otherwise hourly review can re-add later.
      if (context.eventName === 'pull_request_target' && ['synchronize','edited'].includes(context.payload.action) && !a.ok && s.pr.labels.some(l => l.name === 'ci-ready')) {
        await github.rest.issues.removeLabel({...repo, issue_number: number, name: 'ci-ready'});
      }
      const e = ciEvidence(await candidates(github, repo, pr.head.sha), a, pr);
      const fresh = await snapshot(github, repo, number, active);
      const freshAuth = evaluate(fresh);
      if (fresh.pr.head.sha !== pr.head.sha || fresh.pr.base.sha !== s.pr.base.sha || freshAuth.ok !== a.ok || (a.ok && JSON.stringify(freshAuth) !== JSON.stringify(a))) throw new Error('Authorization changed during evaluation');
      await publish('review-gate', a.ok ? 'success' : 'failure', a.reason);
      await publish('ci-required', e.state, e.reason);
    } catch (error) {
      if (pr) {
        await publish('review-gate', 'failure', 'API failure or ambiguous authorization');
        await publish('ci-required', 'failure', 'API failure or ambiguous CI evidence');
      }
      throw error;
    }
  }
}
module.exports = {postStatus, evaluate, ciEvidence, snapshot, candidates, authorize, verify, control};
