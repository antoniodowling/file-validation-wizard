"use strict";
// Read-only, main-owned source admission. It runs before candidate checkout.
const gate=require('./integration.cjs');
const profile=require('./profile.json');
async function authorize({github,context,mode,workflowPath}) {
  if(context.eventName==='pull_request' && context.payload.action==='labeled' && mode!=='enforce')
    return {run:false,reason:'Deferred label notification'};
  if(mode!=='enforce' || context.eventName!=='pull_request')return {run:true,reason:'Existing non-PR or inactive source contract'};
  const workflows=workflowPath?profile.workflows.filter(w=>w.path===workflowPath):profile.workflows;
  if(workflows.length!==1)throw Error('Exact configured source workflow required for CI admission');
  const repo=context.repo,number=context.payload.pull_request?.number;
  if(`${repo.owner}/${repo.repo}`!==profile.repository || !Number.isSafeInteger(number))throw Error('Unexpected admission destination');
  const {data:pr}=await github.rest.pulls.get({...repo,pull_number:number});
  const reviews=await github.paginate(github.rest.pulls.listReviews,{...repo,pull_number:number,per_page:100});
  const authorization=gate.reviewAuthorization(pr,reviews);
  if(!authorization.ok)return {run:false,reason:authorization.reason};
  const {data:repository}=await github.rest.repos.get(repo);
  if(!gate.candidate(pr,repository).ok || pr.head.sha!==context.payload.pull_request.head.sha ||
      pr.base.ref!==context.payload.pull_request.base.ref)return {run:false,reason:'Candidate changed or is ineligible'};
  if(!pr.labels.some(l=>l.name==='ci-ready'))return {run:false,reason:'Connected actor CI handoff required'};
  const result=await github.graphql(`query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){headRefOid autoMergeRequest{mergeMethod}}}}`,{...repo,number});
  const current=result.repository?.pullRequest;
  const adapter=require('./controller.cjs');
  if(current?.headRefOid!==pr.head.sha)return {run:false,reason:'Candidate changed before CI enrollment check'};
  const snapshot=await adapter.snapshot(github,number);
  const d=adapter.decision(snapshot);
  if(snapshot.pr.head.sha!==pr.head.sha || snapshot.pr.base.sha!==pr.base.sha ||
      gate.reviewAuthorization(snapshot.pr,snapshot.reviews).reviewId!==authorization.reviewId ||
      snapshot.shared!==1 || snapshot.threads.some(t=>t.isResolved!==true) || d.blocked)
    return {run:false,reason:'Incomplete or changed candidate, shared head or blocking review'};
  const rules=await github.paginate(github.rest.repos.getBranchRules,{...repo,branch:'main',per_page:100});
  if(!gate.requirements(rules,profile))return {run:false,reason:'Dual trusted enforcement not installed'};
  // Earlier run ID wins concurrent lifecycle/handoff events. Ignore this run and
  // newer admission envelopes; otherwise two readers could defer each other.
  const before=Number(context.runId);
  if(!Number.isSafeInteger(before))throw Error('Current workflow run identity missing');
  const results=await Promise.all(workflows.map(w=>adapter.workflowCI(github,{pr},w,new Set(),before)));
  if(results.some(r=>r.state==='failure'))return {run:false,reason:'Existing exact-head CI failed; no automatic rerun'};
  if(results.every(r=>r.state==='success') || results.some(r=>r.state==='pending'&&r.missing!==true))
    return {run:false,reason:'Reusing completed or active exact-head CI; no second suite'};
  if(gate.protectedPaths(snapshot.files).length) {
    // A manual existing auto request does not authorize NEW protected testing.
    const grant=gate.protectedCIApproval(snapshot,authorization);
    if(!grant.ok || !await gate.verifyApprovedBase(github,repo,grant.record,snapshot.targetSha))return {run:false,reason:'Protected CI bootstrap authorization missing or stale'};
  } else if(current.autoMergeRequest?.mergeMethod!=='MERGE') {
    return {run:false,reason:'Native exact-head enrollment must precede CI authorization'};
  }
  // Re-read immediately before expensive candidate work; labels never authorize
  // stale review or a head that changed while the event waited for a runner.
  const {data:fresh}=await github.rest.pulls.get({...repo,pull_number:number});
  const latest=await github.paginate(github.rest.pulls.listReviews,{...repo,pull_number:number,per_page:100});
  const last=await adapter.snapshot(github,number);
  if(fresh.head.sha!==pr.head.sha || gate.reviewAuthorization(fresh,latest).reviewId!==authorization.reviewId ||
      adapter.binding(last)!==adapter.binding(snapshot) || !gate.candidate(fresh,repository).ok ||
      !fresh.labels.some(l=>l.name==='ci-ready'))return {run:false,reason:'CI authorization changed'};
  return {run:true,reason:'Current-head review and native enrollment verified'};
}
module.exports={authorize};
