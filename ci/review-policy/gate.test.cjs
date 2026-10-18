'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {evaluate, ciEvidence} = require('./gate.cjs');
const head = 'a'.repeat(40), base = 'b'.repeat(40);
function valid() {
  return {active: true, sameHeadPRs: 1,
    pr: {number: 99,state: 'open',draft: false,changed_files: 1,
      head: {sha: head,repo: {full_name: 'antoniodowling/file-validation-wizard'}},
      base: {sha: base,ref: 'main',repo: {full_name: 'antoniodowling/file-validation-wizard'}},labels: [{name:'ci-ready'}]},
    files: [{filename:'src/review-policy-fixture.ts'}],threads: [],
    reviews: [{id: 1,user:{login:'antoniodowling',id:26848379},state:'COMMENTED',commit_id:head,
      submitted_at:'2026-10-17T20:00:00Z',body:`LGTM\n\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->`}]};
}
function evidence(s = valid()) {
  return {run:{id:12,display_title:'CI pull_request labeled ci-ready',event:'pull_request',path:'.github/workflows/validate.yml',head_sha:head,
    head_repository:{full_name:'antoniodowling/file-validation-wizard'},created_at:'2026-10-17T20:01:00Z',status:'completed',conclusion:'success',
    pull_requests:[{number:99,head:{sha:head},base:{sha:base}}]},
    jobs:['authorize-review','validate','ci-verification'].map(name=>({name,status:'completed',conclusion:'success'}))};
}
test('valid owner COMMENT review is SHA bound and supports own PR',()=>assert.equal(evaluate(valid()).ok,true));
const failures = {
  'inactive':s=>s.active=false,
  'draft':s=>s.pr.draft=true,
  'closed':s=>s.pr.state='closed',
  'no review':s=>s.reviews=[],
  'forged identity':s=>s.reviews[0].user.id=5,
  'renamed identity':s=>s.reviews[0].user.login='impostor',
  'stale review commit':s=>s.reviews[0].commit_id='c'.repeat(40),
  'stale marker':s=>s.reviews[0].body=s.reviews[0].body.replace(head,'c'.repeat(40)),
  'malformed marker':s=>s.reviews[0].body=s.reviews[0].body.replace('head=','head ='),
  'duplicate marker':s=>s.reviews[0].body+='\n'+s.reviews[0].body,
  'non-LGTM':s=>s.reviews[0].body=s.reviews[0].body.replace('LGTM','Review incomplete'),
  'changes request':s=>s.reviews[0].state='CHANGES_REQUESTED',
  'dismissed review':s=>s.reviews[0].state='DISMISSED',
  'label alone':s=>{s.reviews=[];s.pr.body=`LGTM <!-- chatgpt-hourly-pr-review:v1 head=${head} -->`;},
  'no label':s=>s.pr.labels=[],
  'dependency hold':s=>s.pr.labels.push({name:'dependencies-pending'}),
  'integration hold':s=>s.pr.labels.push({name:'merge-hold'}),
  'retarget':s=>s.pr.base.ref='other',
  'fork':s=>s.pr.head.repo.full_name='stranger/file-validation-wizard',
  'shared head':s=>s.sameHeadPRs=2,
  'missing files':s=>s.pr.changed_files=2,
  'protected workflow':s=>s.files[0].filename='.github/workflows/control.yml',
  'renamed protection':s=>s.files[0].previous_filename='ci/review-policy/gate.cjs',
  'unresolved finding':s=>s.threads=[{isResolved:false}],
  'ambiguous thread':s=>s.threads=[{}],
  'pending review':s=>s.reviews[0].state='PENDING',
  'missing timestamp':s=>delete s.reviews[0].submitted_at,
  'new trusted incomplete review':s=>s.reviews.push({...s.reviews[0],id:2,body:'Review incomplete'}),
  'later other-author changes request':s=>s.reviews.push({...s.reviews[0],id:2,user:{id:6,login:'other'},state:'CHANGES_REQUESTED'})
};
for(const [name,change] of Object.entries(failures))test(name,()=>{const s=valid();change(s);assert.equal(evaluate(s).ok,false);});
test('outstanding earlier other-author changes request stays blocking',()=>{
 const s=valid();s.reviews.unshift({...s.reviews[0],id:0,user:{id:6,login:'other'},state:'CHANGES_REQUESTED'});assert.equal(evaluate(s).ok,false);
});
test('same reviewer can supersede changes request',()=>{
 const s=valid();s.reviews.unshift({...s.reviews[0],id:0,state:'CHANGES_REQUESTED'});assert.equal(evaluate(s).ok,true);
});
test('fully executed exact-revision CI succeeds',()=>{const s=valid();assert.equal(ciEvidence([evidence()],evaluate(s),s.pr).state,'success');});
for(const conclusion of ['failure','cancelled','skipped','neutral',null])test(`mandatory test ${conclusion} blocks`,()=>{
 const s=valid(), e=evidence();e.jobs[1].conclusion=conclusion;assert.equal(ciEvidence([e],evaluate(s),s.pr).state,'failure');
});
for(const kind of ['base','head','time','path','event','missing-job','duplicate-job','repo'])test(`CI ${kind} mismatch blocks`,()=>{
 const s=valid(),e=evidence();
 if(kind==='base')e.run.pull_requests[0].base.sha='c'.repeat(40);
 if(kind==='head')e.run.head_sha='c'.repeat(40);
 if(kind==='time')e.run.created_at='2026-10-17T19:00:00Z';
 if(kind==='path')e.run.path='.github/workflows/fake.yml';
 if(kind==='event')e.run.event='workflow_dispatch';
 if(kind==='missing-job')e.jobs.pop();
 if(kind==='duplicate-job')e.jobs[2].name=e.jobs[0].name;
 if(kind==='repo')e.run.head_repository.full_name='stranger/file-validation-wizard';
 assert.equal(ciEvidence([e],evaluate(s),s.pr).state,'failure');
});
test('duplicate events reuse completed suite, never a skipped-only suite',()=>{
 const s=valid(),e=evidence(),duplicate=evidence();duplicate.jobs[1].conclusion='skipped';duplicate.run.id=13;
 assert.equal(ciEvidence([duplicate,e],evaluate(s),s.pr).state,'success');
 assert.equal(ciEvidence([duplicate],evaluate(s),s.pr).state,'failure');
});
test('new failed full suite invalidates earlier green suite',()=>{
 const s=valid(),newer=evidence();newer.run.conclusion='failure';newer.jobs[1].conclusion='failure';
 assert.equal(ciEvidence([newer,evidence()],evaluate(s),s.pr).state,'failure');
});
test('queued authorization remains pending',()=>{const s=valid(),e=evidence();e.run.status='queued';e.jobs=null;assert.equal(ciEvidence([e],evaluate(s),s.pr).state,'pending');});
test('no CI and no authorization fail closed',()=>{const s=valid();assert.equal(ciEvidence([],evaluate(s),s.pr).state,'failure');assert.equal(ciEvidence([evidence()],{ok:false,reason:'denied'},s.pr).state,'failure');});

test('unrelated label events cannot replace valid CI',()=>{const s=valid(),unrelated=evidence();unrelated.run.display_title='CI pull_request labeled documentation';assert.equal(ciEvidence([unrelated,evidence()],evaluate(s),s.pr).state,'success');});

function fakeAPI(s = valid()) {
  const writes=[];
  const api={
    rest:{
      pulls:{get:async()=>({data:s.pr}),listReviews:'reviews',listFiles:'files'},
      repos:{listPullRequestsAssociatedWithCommit:'associated',createCommitStatus:async()=>{throw new Error('Ordinary workflow client must never publish App statuses');}},
      actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs'},
      issues:{removeLabel:async()=>{s.pr.labels=[];}}
    },
    paginate:async method=>{
      if(method==='reviews')return s.reviews;
      if(method==='files')return s.files;
      if(method==='associated')return [s.pr];
      if(method==='runs')return [];
      if(method==='jobs')return [];
      throw new Error('Unexpected API call');
    },
    graphql:async()=>({repository:{pullRequest:{reviewThreads:{nodes:s.threads,pageInfo:{hasNextPage:false,endCursor:null}}}}})
  };
  api.statusFetch=async(url,init)=>{
    assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
    assert.ok(url.startsWith('https://api.github.com/repos/antoniodowling/file-validation-wizard/statuses/'));
    writes.push({...JSON.parse(init.body),headers:init.headers,sha:url.split('/').at(-1)});
    return {status:201};
  };
  return {api,writes};
}
const context = {repo:{owner:'antoniodowling',repo:'file-validation-wizard'},payload:{pull_request:{number:99}},eventName:'pull_request_target',runId:42};
test('enforcement refuses any status publication without dedicated App token',async()=>{
 const {control}=require('./gate.cjs'), {api,writes}=fakeAPI();
 await assert.rejects(control({github:api,context,active:true}),/Dedicated enforcement App/);assert.equal(writes.length,0);
});
test('status writes explicitly use dedicated App token, never workflow token',async()=>{
 const {control}=require('./gate.cjs'), {api,writes}=fakeAPI();
 await control({github:api,context,active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch});
 assert.equal(writes.length,4);assert.ok(writes.every(w=>w.headers.authorization==='Bearer synthetic-app-token'));
 assert.equal(writes.at(-2).state,'success');assert.equal(writes.at(-1).state,'failure');
 assert.ok(writes.every(w=>w.sha===head));
});
test('API read failure explicitly blocks both statuses',async()=>{
 const {control}=require('./gate.cjs'),{api,writes}=fakeAPI();api.graphql=async()=>{throw new Error('synthetic provider failure');};
 await assert.rejects(control({github:api,context,active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch}),/synthetic provider failure/);
 assert.deepEqual(writes.slice(-2).map(w=>[w.context,w.state]),[['review-gate','failure'],['ci-required','failure']]);
});
test('authorization read errors propagate instead of allocating tests',async()=>{
 const {authorize}=require('./gate.cjs'),{api}=fakeAPI();api.paginate=async()=>{throw new Error('synthetic API failure');};
 const outputs=[];await assert.rejects(authorize({github:api,context,core:{setOutput:(...x)=>outputs.push(x)},active:true}),/synthetic API failure/);
 assert.equal(outputs.length,0);
});
test('new commits remove stale labels and fail both requirements',async()=>{
 const {control}=require('./gate.cjs'),s=valid();s.pr.head.sha='c'.repeat(40);const{api,writes}=fakeAPI(s);
 await control({github:api,context:{...context,payload:{pull_request:{number:99},action:'synchronize'}},active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch});
 assert.equal(s.pr.labels.length,0);assert.ok(writes.slice(-2).every(w=>w.state==='failure'));
});

test('synchronization cancels only obsolete runs for this PR and workflow',async()=>{
 const {control}=require('./gate.cjs'),s=valid();s.pr.head.ref='pilot';const{api}=fakeAPI(s),cancelled=[];
 const normalPaginate=api.paginate;
 api.rest.actions.cancelWorkflowRun=async p=>cancelled.push(p.run_id);
 api.paginate=async method=>method==='runs' ? [
  {id:1,head_sha:'c'.repeat(40),head_branch:'pilot',head_repository:{full_name:'antoniodowling/file-validation-wizard'},status:'in_progress',pull_requests:[{number:99}]},
  {id:2,head_sha:head,head_branch:'pilot',head_repository:{full_name:'antoniodowling/file-validation-wizard'},status:'in_progress',pull_requests:[{number:99}]},
  {id:3,head_sha:'c'.repeat(40),head_branch:'other',head_repository:{full_name:'antoniodowling/file-validation-wizard'},status:'in_progress',pull_requests:[{number:100}]}
 ] : normalPaginate(method);
 await control({github:api,context:{...context,payload:{pull_request:{number:99},action:'synchronize'}},active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch});
 assert.deepEqual(cancelled,[1]);
});

test('review notification with missing associations reconciles open PRs',async()=>{
 const {control}=require('./gate.cjs'),{api,writes}=fakeAPI();const original=api.paginate;
 api.rest.actions.getWorkflowRun=async()=>({data:{id:44,path:'.github/workflows/review-activity.yml',event:'pull_request_review',head_sha:'d'.repeat(40),pull_requests:[]}});
 api.rest.pulls.list='open';api.paginate=async (method,args)=>method==='associated'&&args.commit_sha==='d'.repeat(40)?[]:method==='open'?[valid().pr]:original(method,args);
 await control({github:api,context:{...context,eventName:'workflow_run',payload:{workflow_run:{id:44}}},active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch});
 assert.equal(writes.at(-2).context,'review-gate');assert.equal(writes.at(-2).state,'success');
});

test('blocking review arriving during evaluation never publishes success',async()=>{
 const {control}=require('./gate.cjs'),s=valid(),{api,writes}=fakeAPI(s);let reads=0;const read=api.rest.pulls.get;
 api.rest.pulls.get=async()=>{reads++;if(reads===3)s.reviews.push({...s.reviews[0],id:2,state:'CHANGES_REQUESTED'});return read();};
 await assert.rejects(control({github:api,context,active:true,statusToken:'synthetic-app-token',fetchImpl:api.statusFetch}),/Authorization changed/);
 assert.ok(!writes.some(w=>w.state==='success'));
});

for(const status of [200,202,401,403,500])test(`App status transport HTTP ${status} fails closed`,async()=>{
 const {postStatus}=require('./gate.cjs');
 await assert.rejects(postStatus({repo:context.repo,sha:head,contextName:'review-gate',state:'failure',description:'synthetic',targetUrl:'https://github.com/',statusToken:'synthetic-app-token',fetchImpl:async()=>({status})}),/publication failed/);
});
test('App status transport rejects another destination before sending credentials',async()=>{
 const {postStatus}=require('./gate.cjs');let called=false;
 await assert.rejects(postStatus({repo:{owner:'other',repo:'repo'},sha:head,statusToken:'synthetic-app-token',fetchImpl:async()=>{called=true;}}),/Invalid status destination/);assert.equal(called,false);
});

for (const filename of require('./policy.json').protectedFiles) test(`protected enforcement file ${filename} blocks`, () => {
 const s=valid();s.files[0].filename=filename;assert.equal(evaluate(s).ok,false);
});
