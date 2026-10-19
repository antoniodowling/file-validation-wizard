"use strict";
const {execFileSync} = require('node:child_process');
const {postStatus} = require('./status.cjs');
const profile = require('./profile.json');
const [owner,repo] = profile.repository.split('/');
const REPO = {owner,repo};
const FULL = `${REPO.owner}/${REPO.repo}`;
const CONTEXT = 'docs-merge-policy';
const APP = 5363850;
const TAG = profile.tag;
const SHA = /^[a-f0-9]{40}$/;
const ownRequest = r => r?.enabledBy?.__typename === 'Bot' && r.enabledBy.login === 'github-actions' && r.commitBody?.endsWith(TAG);

async function snapshot(github, number) {
  const {data:pr}=await github.rest.pulls.get({...REPO,pull_number:number});
  const [files,reviews,associated,details]=await Promise.all([
    github.paginate(github.rest.pulls.listFiles,{...REPO,pull_number:number,per_page:100}),
    github.paginate(github.rest.pulls.listReviews,{...REPO,pull_number:number,per_page:100}),
    github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit,{...REPO,commit_sha:pr.head.sha,per_page:100}),
    github.graphql(`query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id autoMergeRequest{commitBody enabledBy{login __typename}}}}}`,{...REPO,number})
  ]);
  const threads=[];
  let cursor=null;
  do {
    const result=await github.graphql(`query($owner:String!,$repo:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}`,{...REPO,number,cursor});
    const page=result.repository?.pullRequest?.reviewThreads;
    if (!page || !Array.isArray(page.nodes) || !page.pageInfo) throw Error('Incomplete thread evidence');
    threads.push(...page.nodes);
    cursor=page.pageInfo.hasNextPage?page.pageInfo.endCursor:null;
    if(page.pageInfo.hasNextPage&&!cursor) throw Error('Missing thread cursor');
  } while(cursor);
  const detail=details.repository?.pullRequest;
  if (!detail?.id) throw Error('Missing auto-merge evidence');
  return {pr,files,reviews,threads,id:detail.id,auto:detail.autoMergeRequest,
    shared:associated.filter(p=>p.state==='open'&&p.head?.sha===pr.head.sha).length};
}

function decision(s) {
  const p=s.pr;
  if(!SHA.test(p.head?.sha||'')||!SHA.test(p.base?.sha||'')) throw Error('Invalid candidate revisions');
  if(s.files.length!==p.changed_files || !s.files.length) throw Error('Incomplete file evidence');
  const blocked=p.state!=='open'||p.draft!==false||s.shared!==1||
    p.labels.some(l=>['merge-hold','dependencies-pending','NEVER-MERGE'].includes(l.name));
  const latest=new Map();
  for(const r of [...s.reviews].sort((a,b)=>a.id-b.id)) if(['APPROVED','CHANGES_REQUESTED'].includes(r.state))latest.set(r.user?.id,r);
  const objection=[...latest.values()].some(r=>r.state==='CHANGES_REQUESTED');
  return {blocked:blocked||objection, unresolved:s.threads.some(t=>t.isResolved!==true), supported:p.base.ref==='main'&&p.base.repo?.full_name===FULL,
    trusted:p.user?.login==='antoniodowling'&&p.user?.id===26848379&&p.head.repo?.full_name===FULL};
}

function binding(s) {
  return JSON.stringify({head:s.pr.head.sha,base:s.pr.base.sha,target:s.pr.base.ref,state:s.pr.state,
    draft:s.pr.draft,author:s.pr.user,headRepo:s.pr.head.repo?.full_name,baseRepo:s.pr.base.repo?.full_name,
    labels:s.pr.labels.map(l=>l.name).sort(),files:s.files.map(f=>[f.filename,f.previous_filename,f.status,f.sha]),
    reviews:s.reviews.map(r=>[r.id,r.state,r.commit_id,r.body]),threads:s.threads,shared:s.shared});
}

function classify(s,{exec=execFileSync,token=process.env.GITHUB_TOKEN}={}) {
  if(!SHA.test(s.pr.merge_commit_sha||'')) return 'full';
  const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+token).toString('base64'),GIT_TERMINAL_PROMPT:'0'};
  // Fetch immutable objects into Git; never checkout PR content or execute it.
  try {
    if(exec('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim()!==s.pr.base.sha)return 'full';
    exec('git',['fetch','--no-tags','--no-recurse-submodules','origin',s.pr.head.sha,s.pr.merge_commit_sha],{env,stdio:['ignore','pipe','pipe'],timeout:60000});
    return exec('python3',[profile.classifier,'--root','.'],{input:JSON.stringify({base:s.pr.base.sha,head:s.pr.head.sha,merge:s.pr.merge_commit_sha,files:s.files}),encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}).trim()==='docs'?'docs':'full';
  } catch {return 'full';}
}

async function protectedRoute(github) {
  const rules=await github.paginate(github.rest.repos.getBranchRules,{...REPO,branch:'main',per_page:100});
  const requirements=rules.filter(r=>r.type==='required_status_checks');
  const required=requirements.flatMap(r=>r.parameters?.required_status_checks||[]);
  return required.some(c=>c.context===CONTEXT&&c.integration_id===APP)&&
    profile.workflows.every(w=>w.aggregates.every(name=>required.some(c=>c.context===name&&c.integration_id===15368)))&&
    rules.some(r=>r.type==='pull_request'&&r.parameters?.required_review_thread_resolution===true)&&rules.some(r=>r.type==='non_fast_forward')&&rules.some(r=>r.type==='deletion');
}

// Draft check jobs are skipped by Actions, which native required checks accept.
// Release the code guard only after a real aggregate success from the latest run.
async function workflowCI(github, s, workflow) {
  const p=s.pr;
  const matching=async()=>{
    const runs=await github.paginate(github.rest.actions.listWorkflowRuns,{...REPO,
      workflow_id:workflow.path.split('/').at(-1),head_sha:p.head.sha,event:'pull_request',per_page:100});
    return runs.filter(r=>r.head_sha===p.head.sha&&r.head_branch===p.head.ref&&
      r.head_repository?.full_name===p.head.repo?.full_name)
      .sort((a,b)=>b.id-a.id)[0];
  };
  const candidate=await matching();
  if(!candidate)return {state:'pending',description:'Waiting for current code CI'};
  const {data:r}=await github.rest.actions.getWorkflowRun({...REPO,run_id:candidate.id});
  if(r.path!==workflow.path||r.event!=='pull_request'||
     r.repository?.full_name!==FULL||r.head_sha!==p.head.sha||r.head_branch!==p.head.ref||
     r.head_repository?.full_name!==p.head.repo?.full_name||!Number.isSafeInteger(r.run_attempt)||r.run_attempt<1)
    throw Error('Unexpected code CI provenance');
  // Some private-repository runs omit PR associations. The snapshot already proves
  // one open PR owns this head; exact repository/branch/head bind that fallback.
  // A completed run keeps its recorded base when main advances. Its PR/head and
  // any supplied target ref must still agree; base identity remains provenance.
  if(!Array.isArray(r.pull_requests)||r.pull_requests.length&&
     !r.pull_requests.some(q=>q.number===p.number&&q.head?.sha===p.head.sha&&SHA.test(q.base?.sha||'')&&
       (q.base.ref===undefined||q.base.ref===p.base.ref)))
    throw Error('Contradictory code CI association');
  if(r.status!=='completed')return {state:'pending',description:'Waiting for current code CI'};
  if(r.conclusion!=='success')return {state:'failure',description:'Latest code CI did not pass'};
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,
    {...REPO,run_id:r.id,filter:'latest',per_page:100});
  for(const name of workflow.aggregates) {
    const aggregates=jobs.filter(j=>j.name===name);
    const j=aggregates[0];
    if(aggregates.length!==1||j.run_id!==r.id||j.run_attempt!==r.run_attempt||
       j.head_sha!==p.head.sha||j.status!=='completed'||j.conclusion!=='success')
      return {state:'failure',description:'Current code CI aggregate missing or not executed'};
  }
  const latest=await matching();
  const {data:current}=await github.rest.actions.getWorkflowRun({...REPO,run_id:r.id});
  if(latest?.id!==r.id||current.run_attempt!==r.run_attempt||current.status!=='completed'||current.conclusion!=='success')
    return {state:'pending',description:'Code CI changed during verification'};
  return {state:'success',description:'Current code CI passed; no review requirement'};
}

async function codeCI(github, s, workflows=profile.workflows) {
  if(!workflows.length)throw Error('Missing code CI profile');
  const results=await Promise.all(workflows.map(w=>workflowCI(github,s,w)));
  return results.find(r=>r.state==='failure') || results.find(r=>r.state!=='success') || results[0];
}

async function reconcile({github,context,number,active,statusToken,scope=classify,exec=execFileSync,publish=postStatus}) {
  let s;
  const post=(state,description)=>publish({repo:REPO,sha:s.pr.head.sha,contextName:CONTEXT,state,description,
    targetUrl:`https://github.com/${FULL}/actions/runs/${context.runId}`,statusToken});
  try {
    s=await snapshot(github,number);
    if(s.pr.state!=='open') return;
    await post('pending','Checking trusted documentation merge policy');
    const d=decision(s);
    const docs=d.supported&&d.trusted&&scope(s)==='docs';
    const eligible=docs&&!d.blocked&&!d.unresolved;
    if(ownRequest(s.auto)&&(!eligible||!active)) {
      await github.graphql('mutation($id:ID!){disablePullRequestAutoMerge(input:{pullRequestId:$id}){clientMutationId}}',{id:s.id});
      const cleared=await snapshot(github,number);
      if(cleared.auto) throw Error('Docs-owned auto-merge request was not removed');
    }
    const ci=!docs&&!d.blocked&&d.supported?await codeCI(github,s):null;
    const fresh=await snapshot(github,number);
    if(binding(fresh)!==binding(s)) throw Error('Candidate or protections changed during classification');
    if(d.blocked||!d.supported) {await post('failure','Draft, hold, objection, shared head or unsupported target');return;}
    if(!docs) {await post(ci.state,ci.description);return;}
    const route=active&&await protectedRoute(github);
    await post('success','Not required — documentation-only; native protections apply');
    if(!route||!eligible||fresh.auto) return;
    const last=await snapshot(github,number);
    if(binding(last)!==binding(s)||last.auto) throw Error('Candidate changed before auto-merge');
    exec('gh',['pr','merge',String(number),'--repo',FULL,'--auto','--merge','--match-head-commit',s.pr.head.sha,
      '--body',`Automatic merge of verified documentation.\n\n${TAG}`],{stdio:['ignore','pipe','pipe'],timeout:30000});
    const after=await snapshot(github,number);
    if(after.pr.head.sha!==s.pr.head.sha || !(after.pr.merged===true||ownRequest(after.auto))) throw Error('Auto-merge was not verified for classified head');
  } catch(error) {
    if(s) await post('failure','Documentation policy evaluation failed; automatic merge withheld');
    throw error;
  }
}

async function control(args) {
  const {github,context}=args;
  if(`${context.repo.owner}/${context.repo.repo}`!==FULL) throw Error('Unexpected repository');
  let numbers=[];
  if(context.payload.pull_request)numbers=[context.payload.pull_request.number];
  else if(context.eventName==='workflow_dispatch') {
    const n=Number(context.payload.inputs?.pr);
    if(!Number.isSafeInteger(n)||n<1)throw Error('Explicit PR number required');
    numbers=[n];
  } else if(context.payload.workflow_run) {
    const {data:r}=await github.rest.actions.getWorkflowRun({...REPO,run_id:context.payload.workflow_run.id});
    if(!['.github/workflows/review-activity.yml',...profile.workflows.map(w=>w.path)].includes(r.path))throw Error('Unexpected notification source');
    if(!['pull_request','pull_request_review','pull_request_review_comment'].includes(r.event))return;
    numbers=(r.pull_requests||[]).map(p=>p.number);
    if(!numbers.length)numbers=(await github.paginate(github.rest.pulls.list,{...REPO,state:'open',per_page:100})).map(p=>p.number);
  }
  for(const number of [...new Set(numbers)])await reconcile({...args,number});
}
module.exports={REPO,CONTEXT,APP,TAG,ownRequest,decision,binding,classify,protectedRoute,snapshot,codeCI,reconcile,control};
