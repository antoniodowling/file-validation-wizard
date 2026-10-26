"use strict";
// Loaded exclusively from independently established default-branch source.
// Candidate files, artifacts, comments, labels and workflow outputs are never policy.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./integration-policy.json');
const approvals = require('./protected-integrations.json');
const SHA = /^[0-9a-f]{40}$/;
const REVIEW = 'review-gate', CI = 'ci-required', LEGACY = 'docs-merge-policy';
const TAG = 'review-integration:v1';
const ENABLE = `mutation($input:EnablePullRequestAutoMergeInput!){enablePullRequestAutoMerge(input:$input){pullRequest{id headRefOid merged autoMergeRequest{mergeMethod}}}}`;
const deny = reason => ({ok:false, reason});
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function reviewAuthorization(pr, reviews) {
  if (!SHA.test(pr.head?.sha || '') || !Array.isArray(reviews)) return deny('Missing head or review history');
  // REST listReviews only. No issue-comment or PR-body input exists here.
  if (reviews.some(r => !Number.isSafeInteger(r.id))) return deny('Incomplete review history');
  const submitted = [...reviews].filter(r => r.state !== 'PENDING').sort((a,b) => a.id-b.id);
  const trusted = submitted.filter(r => r.user?.login === policy.reviewer.login && r.user?.id === policy.reviewer.id);
  const r = trusted.at(-1);
  if (!r || !['COMMENTED','APPROVED'].includes(r.state) || r.commit_id !== pr.head.sha ||
      !r.submitted_at || !Number.isFinite(Date.parse(r.submitted_at))) return deny('Missing current completed trusted review');
  const body = (r.body || '').replace(/\r\n/g,'\n');
  // Count even malformed marker attempts, not only syntactically valid markers.
  if (body.split('\n')[0].trim() !== 'LGTM' ||
      (body.match(/chatgpt-hourly-pr-review:/g)||[]).length !== 1 ||
      !body.includes(`<!-- chatgpt-hourly-pr-review:v1 head=${pr.head.sha} -->`)) return deny('Review is incomplete, blocking or has invalid marker');
  const latest = new Map();
  for (const item of submitted) {
    if (!Number.isSafeInteger(item.user?.id)) return deny('Incomplete reviewer identity');
    // A COMMENT does not dismiss somebody's formal changes request.
    if (['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(item.state)) latest.set(item.user.id,item);
  }
  if ([...latest.values()].some(item=>item.state==='CHANGES_REQUESTED')) return deny('Outstanding changes request');
  return {ok:true,head:pr.head.sha,reviewId:r.id,reviewedAt:r.submitted_at,reason:'Actual current-head LGTM'};
}

function protectedPaths(files) {
  if (!Array.isArray(files) || !files.length) throw Error('Missing complete changed paths');
  return [...new Set(files.flatMap(f=>[f.filename,f.previous_filename].filter(Boolean)).filter(p=>
    p.startsWith('/') || p.split('/').includes('..') || policy.protectedFiles.includes(p) ||
    policy.protectedPrefixes.some(prefix=>p.startsWith(prefix))))].sort();
}
function filesDigest(files) {
  return digest(files.map(f=>[f.filename,f.previous_filename||null,f.status,f.sha||null]).sort((a,b)=>a[0].localeCompare(b[0])));
}
function policyDigest() {
  // Approval records are excluded to avoid a self-referential hash. Updating ANY
  // evaluator/profile/publisher invalidates earlier protected authorizations.
  const profile=require('./profile.json');
  let root=__dirname;
  while(!fs.existsSync(path.join(root,profile.classifier))||!fs.existsSync(path.join(root,'.github/workflows/docs-automerge.yml'))) {
    const parent=path.dirname(root);if(parent===root)throw Error('Trusted policy root is unavailable');root=parent;
  }
  return digest([
    ...['integration.cjs','integration-policy.json','controller.cjs','profile.json','status.cjs','admission.cjs'].map(name=>[name,fs.readFileSync(path.join(__dirname,name),'utf8')]),
    ...['.github/workflows/docs-automerge.yml',profile.classifier,...profile.workflows.map(w=>w.path)]
      .map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')])
  ]);
}
function protectedRecord(s, authorization, records=approvals, implementationDigest=policyDigest()) {
  const p=s.pr;
  const record=records.version===1 && Array.isArray(records.approvals) && records.approvals.find(a=>a.repository===p.base.repo.full_name &&
    a.number===p.number && a.head===p.head.sha && SHA.test(a.base||'') && a.reviewId===authorization.reviewId &&
    a.policyDigest===implementationDigest && a.filesDigest===filesDigest(s.files));
  if (!record || record.authorization?.actor!==policy.reviewer.login || record.authorization?.actorId!==policy.reviewer.id ||
      !/^https:\/\/github\.com\/antoniodowling\//.test(record.authorization?.url||'') ||
      record.supplyChainReviewed!==true || record.permissionsReviewed!==true || record.nonWeakeningReviewed!==true)
    return deny('Protected change requires independent exact-candidate bootstrap authorization');
  return {ok:true,reason:'Independently installed protected authorization',record};
}
function protectedAuthorization(s,authorization,evidence,records=approvals,implementationDigest=policyDigest()) {
  const approved=protectedRecord(s,authorization,records,implementationDigest);
  if(!approved.ok)return approved;
  const record=approved.record;
  if(evidence.state && evidence.state!=='success' || !evidence.runIds?.length ||
      !evidence.runs?.length || evidence.runs.some(r=>!SHA.test(r.testedBase||'')) ||
      (record.allowCI!==true && (!evidence.runs.some(r=>r.testedBase===record.base) ||
        !Array.isArray(record.runIds) || evidence.runIds.some(id=>!record.runIds.includes(id)))))
    return deny('Protected route needs completed independently qualified CI');
  return approved;
}
function protectedCIApproval(s,authorization) {
  const approved=protectedRecord(s,authorization);
  return approved.ok&&approved.record.allowCI===true?approved:deny('Protected CI needs separate exact-candidate bootstrap authorization');
}
async function verifyApprovedBase(github,repo,record,target,bases=[]) {
  for(const revision of new Set([target,...bases])) {
    if(!SHA.test(revision||''))return false;
    if(record.base===revision)continue;
    const {data:comparison}=await github.rest.repos.compareCommitsWithBasehead({...repo,basehead:`${record.base}...${revision}`});
    if(!['ahead','identical'].includes(comparison.status)||comparison.merge_base_commit?.sha!==record.base)return false;
  }
  return true;
}

function requirements(rules, profile, {dual=true}={}) {
  if (!Array.isArray(rules) || !profile.workflows?.length) return false;
  const checks=rules.filter(r=>r.type==='required_status_checks').flatMap(r=>r.parameters?.required_status_checks||[]);
  const required=[{context:LEGACY,integration_id:policy.enforcementAppId},
    ...profile.workflows.flatMap(w=>w.aggregates.map(context=>({context,integration_id:15368}))),
    ...(dual?[REVIEW,CI].map(context=>({context,integration_id:policy.enforcementAppId})):[])];
  return required.every(c=>checks.some(r=>r.context===c.context&&r.integration_id===c.integration_id)) &&
    rules.some(r=>r.type==='pull_request'&&r.parameters?.required_review_thread_resolution===true) &&
    rules.some(r=>r.type==='non_fast_forward') && rules.some(r=>r.type==='deletion') &&
    !rules.some(r=>r.type==='merge_queue');
}
function candidate(pr, repo) {
  if (!policy.integrationAllowlist.includes(repo.full_name)) return deny('Repository outside integration allowlist');
  if (repo.archived!==false || repo.disabled===true) return deny('Repository archived, disabled or metadata missing');
  if (repo.allow_auto_merge!==true || repo.allow_merge_commit!==true) return deny('Native auto-merge or merge commits unavailable');
  if (pr.state!=='open' || pr.draft!==false) return deny('PR closed or draft');
  if (pr.base?.ref!=='main' || pr.base.repo?.full_name!==repo.full_name || pr.head?.repo?.full_name!==repo.full_name) return deny('Unsupported base or fork');
  if (!SHA.test(pr.head.sha||'') || !SHA.test(pr.base.sha||'')) return deny('Invalid candidate revision');
  if (!Array.isArray(pr.labels) || pr.labels.some(l=>['merge-hold','dependencies-pending','NEVER-MERGE'].includes(l.name))) return deny('Integration hold');
  if (pr.mergeable!==true) return deny(pr.mergeable===false?'Merge conflicts':'Mergeability not yet established');
  return {ok:true};
}
function ownRequest(auto) {
  return auto?.enabledBy?.__typename==='Bot' && auto.enabledBy.login==='github-actions' &&
    auto.commitBody?.split('\n').at(-1)===TAG;
}
async function rulesFor(github, repo) {
  return github.paginate(github.rest.repos.getBranchRules,{...repo,branch:'main',per_page:100});
}

async function nativeChecks(github,repo,s,evidence,profile) {
  if(evidence.state!=='success')return;
  const checks=await github.paginate(github.rest.checks.listForRef,{...repo,ref:s.pr.head.sha,filter:'all',per_page:100});
  for(let i=0;i<profile.workflows.length;i++) {
    const qualified=evidence.runs?.[i];
    const {data:run}=await github.rest.actions.getWorkflowRun({...repo,run_id:evidence.runIds[i]});
    if(!qualified || run.status!=='completed' || run.conclusion!=='success' || run.run_attempt!==qualified.attempt ||
        run.head_sha!==qualified.head || run.path!==qualified.path)throw Error('CI execution changed after qualification');
    if(!Number.isSafeInteger(run.check_suite_id))throw Error('CI check suite identity missing');
    for(const name of profile.workflows[i].aggregates) {
      const expected=qualified.checkIds?.find(c=>c.name===name)?.id;
      if(!Number.isSafeInteger(expected))throw Error('Native CI check identity missing');
      const matching=checks.filter(c=>c.id===expected&&c.name===name&&c.check_suite?.id===run.check_suite_id&&c.app?.id===15368);
      if(matching.length!==1 || matching[0].head_sha!==s.pr.head.sha ||
          matching[0].status!=='completed' || matching[0].conclusion!=='success')throw Error('Native CI check provider or execution mismatch');
    }
  }
}

async function reconcileOnce({github,context,number,mode,autoMerge=false,statusToken,publish,adapter,profile}) {
  if (!['shadow','enforce','disabled'].includes(mode)) return {state:'INACTIVE'};
  const repo=context.repo, full=`${repo.owner}/${repo.repo}`;
  if(!policy.integrationAllowlist.includes(full))return {state:'REVIEW_ONLY',reason:'Repository outside integration allowlist'};
  let pr;
  // Failure to obtain authoritative PR state is a failed execution, never a
  // fresh success. Existing GitHub head-specific gates are not overwritten.
  ({data:pr}=await github.rest.pulls.get({...repo,pull_number:number}));
  if (pr.state!=='open') return {state:pr.merged?'MERGED':'CLOSED',mergeSha:pr.merge_commit_sha};
  const head=pr.head?.sha;
  if (!SHA.test(head||'')) throw Error('Invalid current head');
  const post=(contextName,state,description)=>publish({repo,sha:head,contextName,state,description,statusToken,
    targetUrl:`https://github.com/${full}/actions/runs/${context.runId}`});
  const fail=async reason=>{
    await post(REVIEW,'failure',reason); await post(CI,'failure',reason);
    if(['enforce','disabled'].includes(mode))await post(LEGACY,'failure',reason);
    return {state:'BLOCKED',reason,head};
  };
  try {
    await post(REVIEW,'pending','Reading exact-head review authorization');
    await post(CI,'pending','Checking qualified current-head CI');
    if(mode==='enforce')await post(LEGACY,'pending','Evaluating review and CI contract');
    if(mode==='disabled')return await fail('Review integration disabled after migration; native merge withheld');
    // Review history precedes full files/Git object reads and CI job requests.
    const reviews=await github.paginate(github.rest.pulls.listReviews,{...repo,pull_number:number,per_page:100});
    const review=reviewAuthorization(pr,reviews);
    if(!review.ok){
      // Invalidate a proven old-head label once; this is not an event-retry loop.
      // The connected hourly actor later supplies the actual CI-starting event.
      const stale=reviews.some(r=>r.commit_id!==head && SHA.test(r.commit_id||'') &&
        reviewAuthorization({head:{sha:r.commit_id}},[r]).ok);
      if(mode==='enforce' && stale && pr.labels.some(l=>l.name==='ci-ready')) {
        const {data:current}=await github.rest.pulls.get({...repo,pull_number:number});
        const latest=await github.paginate(github.rest.pulls.listReviews,{...repo,pull_number:number,per_page:100});
        if(current.head.sha===head && !reviewAuthorization(current,latest).ok && current.labels.some(l=>l.name==='ci-ready'))
          await github.rest.issues.removeLabel({...repo,issue_number:number,name:'ci-ready'});
      }
      return await fail(review.reason);
    }
    const {data:repository}=await github.rest.repos.get(repo);
    if(repository.full_name!==full)return await fail('Repository identity mismatch');
    const eligible=candidate(pr,repository);
    if(!eligible.ok)return await fail(eligible.reason);
    const s=await adapter.snapshot(github,number);
    if(!SHA.test(s.targetSha||''))return await fail('Current target ref identity missing');
    if(s.pr.head.sha!==head || s.pr.base.sha!==pr.base.sha || !reviewAuthorization(s.pr,s.reviews).ok ||
       reviewAuthorization(s.pr,s.reviews).reviewId!==review.reviewId) return await fail('Candidate or review changed');
    if(s.shared!==1 || s.threads.some(t=>t.isResolved!==true) || adapter.decision(s).blocked) return await fail('Shared head, unresolved thread or objection');
    const paths=protectedPaths(s.files);
    // Existing native aggregate owns affected-test applicability. An old-base
    // successful run remains usable under the accepted loose freshness policy.
    const evidence=await adapter.codeCI(github,s);
    await nativeChecks(github,repo,s,evidence,profile);
    if(paths.length) {
      const approval=protectedAuthorization(s,review,evidence);
      if(!approval.ok)return await fail(approval.reason);
      // Approval is installed by a separately reviewed main commit, which itself
      // advances main. Preserve loose freshness while proving the approved base
      // is still an ancestor and the complete trusted policy digest is unchanged.
      if(!await verifyApprovedBase(github,repo,approval.record,s.targetSha,evidence.runs.map(r=>r.testedBase)))
        return await fail('Protected approved base is not an ancestor of current target and tested bases');
    }
    const rules=await rulesFor(github,repo);
    if(!requirements(rules,profile,{dual:false}))return await fail('Existing native protection contract missing or misattributed');
    const fresh=await adapter.snapshot(github,number);
    if(adapter.binding(fresh)!==adapter.binding(s))return await fail('Candidate changed during validation');
    await post(REVIEW,'success','Actual current-head LGTM; threads and protected route verified');
    await post(CI,evidence.state,evidence.state==='success'?'Actual current-head LGTM and qualified native CI passed':evidence.description);
    if(mode==='enforce')await post(LEGACY,evidence.state,evidence.state==='success'?'Current-head review and qualified CI passed':evidence.description);
    if(evidence.state==='failure')return {state:'CI_FAILED',head};
    if(mode!=='enforce' || !autoMerge)return {state:'VALIDATED_NO_ENROLLMENT',head,ci:evidence.state};
    // Required dual checks MUST already exist before pending-CI enrollment.
    // They stop future heads inheriting eligibility even if GitHub retains auto.
    const lastRules=await rulesFor(github,repo);
    if(!requirements(lastRules,profile))return {state:'BLOCKED',head,reason:'Dual App-pinned checks not installed'};
    const last=await adapter.snapshot(github,number);
    const {data:lastRepo}=await github.rest.repos.get(repo);
    if(adapter.binding(last)!==adapter.binding(s) || !candidate(last.pr,lastRepo).ok) return await fail('Candidate changed before native enrollment');
    if(last.auto) {
      if(last.auto.mergeMethod!=='MERGE')return {state:'BLOCKED',head,reason:'Existing auto-merge uses another method'};
      return {state:'AUTO_MERGE_ARMED',head,ci:evidence.state,existing:true};
    }
    // Native optimistic concurrency. clientMutationId is a trace ID, NOT a lock.
    // Workflow-level serialization plus readback handles duplicate schedulers.
    let rejection;
    try {
      await github.graphql(ENABLE,{input:{pullRequestId:last.id,mergeMethod:'MERGE',expectedHeadOid:head,
        clientMutationId:`${TAG}:${last.id}:${head}:${review.reviewId}`,
        commitBody:`Independent exact-head review and native required checks.\n\n${TAG}`}});
    } catch(error) { rejection=error; }
    // Read back on rejection/timeout before retry; another authorized actor may
    // have won. Never fall back to mergePullRequest or an unpinned mutation.
    const after=await adapter.snapshot(github,number);
    if(after.pr.head.sha!==head)return await fail('Head changed during native enrollment');
    if(after.pr.merged===true)return {state:'MERGED',head,mergeSha:after.pr.merge_commit_sha};
    if(after.auto?.mergeMethod==='MERGE')return {state:'AUTO_MERGE_ARMED',head,ci:evidence.state,recoveredRace:!!rejection};
    if(rejection)throw Error(`Native enrollment rejected: ${rejection.status||'API error'}`);
    throw Error('Native auto-merge enrollment not verified');
  } catch(error) {
    await fail('Trusted integration evaluation failed; reconciliation required');
    throw error;
  }
}

const inFlight=new Map();
async function reconcile(args) {
  const key=`${args.context.repo.owner}/${args.context.repo.repo}#${args.number}`;
  if(inFlight.has(key))return inFlight.get(key);
  const operation=reconcileOnce(args);
  inFlight.set(key,operation);
  try{return await operation;}finally{inFlight.delete(key);}
}

async function control(args) {
  const {github,context,profile}=args;
  if(`${context.repo.owner}/${context.repo.repo}`!==profile.repository)throw Error('Unexpected repository');
  const p=context.payload||{};
  let numbers=[];
  if(p.pull_request)numbers=[p.pull_request.number];
  else if(context.eventName==='workflow_dispatch') {
    const n=Number(p.inputs?.pr);
    if(!Number.isSafeInteger(n)||n<1)throw Error('Explicit PR number required');
    numbers=[n];
  } else if(context.eventName==='schedule') {
    numbers=(await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',per_page:100})).map(p=>p.number);
  } else if(p.workflow_run) {
    const {data:run}=await github.rest.actions.getWorkflowRun({...context.repo,run_id:p.workflow_run.id});
    if(!['.github/workflows/review-activity.yml',...profile.workflows.map(w=>w.path)].includes(run.path))throw Error('Unexpected notification source');
    if(!['pull_request','pull_request_review','pull_request_review_comment'].includes(run.event))return [];
    if(args.adapter.notificationNumbers)numbers=await args.adapter.notificationNumbers(github,run);
    else {
      numbers=(run.pull_requests||[]).map(p=>p.number);
      if(!numbers.length)numbers=(await github.paginate(github.rest.pulls.list,{...context.repo,state:'open',per_page:100})).map(p=>p.number);
    }
  }
  const results=[];
  for(const number of [...new Set(numbers)]) {
    try {results.push(await reconcile({...args,number}));}
    catch(error) {results.push({state:'ERROR',number,reason:error.message});}
  }
  if(results.some(r=>r.state==='ERROR'))throw Error('One or more PR reconciliations failed; all independent candidates were attempted');
  return results;
}
module.exports={policy,REVIEW,CI,LEGACY,TAG,ENABLE,digest,reviewAuthorization,protectedPaths,filesDigest,policyDigest,
  protectedRecord,protectedAuthorization,protectedCIApproval,verifyApprovedBase,requirements,candidate,ownRequest,nativeChecks,reconcile,control};
