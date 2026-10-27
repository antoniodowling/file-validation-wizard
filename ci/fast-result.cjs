"use strict";
// Runs only from protected default-branch source, with no candidate execution.
const adapter = require("./docs-policy/controller.cjs");
const gate = require("./docs-policy/integration.cjs");
const {postStatus} = require("./docs-policy/status.cjs");
const WORKFLOW = {path:".github/workflows/fast-ci.yml",aggregates:["Fast source validation"]};
const CONTEXT = "Fast CI";
async function assess({github,s,mode}) {
  if(mode!=="lean")return {state:"pending",description:"Fast CI is not activated; check the repository mode"};
  if(s.pr.state!=="open" || s.pr.draft!==false || s.pr.base.ref!=="main" ||
     s.pr.base.repo.full_name!=="antoniodowling/file-validation-wizard" ||
     s.pr.head.repo?.full_name!=="antoniodowling/file-validation-wizard" ||
     s.shared!==1 || s.files.length!==s.pr.changed_files)
    return {state:"failure",description:"Candidate identity or complete change evidence is unavailable"};
  if(await gate.requiresProtectedIntegration(s,adapter,github)) {
    const review=gate.reviewAuthorization(s.pr,s.reviews);
    if(!review.ok)return {state:"failure",description:"CI control change needs an exact-head independent review"};
    const approval=gate.protectedRecord(s,review);
    if(!approval.ok)return {state:"failure",description:"CI control change needs its exact-head operator authorization"};
    if(!await gate.verifyApprovedBase(github,adapter.REPO,approval.record,s.targetSha))
      return {state:"failure",description:"CI control approval base is no longer applicable"};
  }
  return adapter.workflowCI(github,s,WORKFLOW);
}
async function control({github,context,mode,statusToken,publish=postStatus}) {
  let numbers=[];
  let eventRun=null;
  if(context.eventName==="workflow_dispatch") {
    const n=Number(context.payload.inputs?.pr);
    if(!Number.isSafeInteger(n)||n<1)throw Error("Explicit PR number required");
    numbers=[n];
  } else {
    const {data:r}=await github.rest.actions.getWorkflowRun({...adapter.REPO,run_id:context.payload.workflow_run.id});
    if(r.path!==WORKFLOW.path || r.event!=="pull_request" ||
       r.repository?.full_name!=="antoniodowling/file-validation-wizard" ||
       r.head_repository?.full_name!=="antoniodowling/file-validation-wizard")return;
    eventRun=r;
    const prs=await github.paginate(github.rest.pulls.list,{...adapter.REPO,state:"open",
      head:"antoniodowling:"+r.head_branch,per_page:100});
    numbers=prs.filter(p=>p.head.sha===r.head_sha&&p.base.ref==="main").map(p=>p.number);
  }
  for(const number of numbers) {
    const s=await adapter.snapshot(github,number);
    if(eventRun && s.pr.head.sha!==eventRun.head_sha)continue;
    const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{...adapter.REPO,
      workflow_id:"fast-ci.yml",head_sha:s.pr.head.sha,event:"pull_request",per_page:100});
    const latest=runs.filter(r=>r.head_sha===s.pr.head.sha&&r.head_branch===s.pr.head.ref&&
      r.head_repository?.full_name===s.pr.head.repo?.full_name).sort((a,b)=>b.id-a.id)[0];
    // A delayed draft completion may be newer than a ready run. Completed
    // events reconcile authoritative current evidence; only an in-progress
    // notification for the newest attempt is allowed to publish pending.
    if(eventRun && eventRun.status!=="completed" &&
       (latest?.id!==eventRun.id || latest.run_attempt!==eventRun.run_attempt))continue;
    const post=result=>publish({repo:adapter.REPO,sha:s.pr.head.sha,contextName:CONTEXT,
      state:result.state,description:result.description,statusToken,
      targetUrl:latest?.html_url||s.pr.html_url});
    await post({state:"pending",description:"Verifying current-head fast CI"});
    if(eventRun && eventRun.status!=="completed")continue;
    let result;
    try {
      if(!await gate.currentPolicySource(github,adapter.REPO))throw Error("Loaded policy is not current protected main");
      result=await assess({github,s,mode});
      const fresh=await adapter.snapshot(github,number);
      if(adapter.binding(fresh)!==adapter.binding(s) ||
         !await gate.currentPolicySource(github,adapter.REPO))
        result={state:"pending",description:"Candidate or trusted policy changed during verification"};
    } catch(error) {
      result={state:"failure",description:"Fast CI evidence verification failed"};
      console.error(error.message);
    }
    await post(result);
  }
}
module.exports={WORKFLOW,CONTEXT,assess,control};
