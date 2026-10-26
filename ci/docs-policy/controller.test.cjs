"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const policy=require('./controller.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture() {
 const s={pr:{number:1,state:'open',draft:false,changed_files:1,user:{login:'antoniodowling',id:26848379},
   labels:[],head:{sha:'a'.repeat(40),ref:'branch',repo:{full_name:'antoniodowling/file-validation-wizard'}},
   base:{sha:'b'.repeat(40),ref:'main',repo:{full_name:'antoniodowling/file-validation-wizard'}},merge_commit_sha:'c'.repeat(40)},
  files:[{filename:'README.md',status:'modified',sha:'d'.repeat(40)}],reviews:[],threads:[],auto:null,shared:1};
 const calls=[],states=[];
 const ci={run:{id:9,run_attempt:1,status:'completed',conclusion:'success',head_sha:s.pr.head.sha,
   head_branch:s.pr.head.ref,event:'pull_request',path:'.github/workflows/validate.yml',
   repository:{full_name:'antoniodowling/file-validation-wizard'},head_repository:{full_name:'antoniodowling/file-validation-wizard'},pull_requests:[]},
   jobs:[{id:99,run_id:9,run_attempt:1,head_sha:s.pr.head.sha,name:'validate',status:'completed',conclusion:'success'}]};
 ci.runs=[ci.run];
 const github={rest:{pulls:{get:()=>({data:clone(s.pr)}),listFiles:'files',listReviews:'reviews'},repos:{listPullRequestsAssociatedWithCommit:'associated',getBranchRules:'rules'},actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs',getWorkflowRun:async()=>({data:clone(ci.run)})}},
  paginate:async(endpoint)=>{
   if(endpoint==='runs')return clone(ci.runs);
   if(endpoint==='jobs')return clone(ci.jobs);
   if(endpoint==='files')return clone(s.files);
   if(endpoint==='reviews')return clone(s.reviews);
   if(endpoint==='associated')return Array.from({length:s.shared},()=>({state:'open',head:{sha:s.pr.head.sha}}));
   if(endpoint==='rules')return [{type:'pull_request',parameters:{required_review_thread_resolution:true}},{type:'deletion'},{type:'non_fast_forward'},{type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,required_status_checks:[{context:'validate',integration_id:15368},{context:policy.CONTEXT,integration_id:policy.APP}]}}];
   throw Error('Unexpected endpoint');
  },
  graphql:async(query)=>{
   if(query.startsWith('mutation')){calls.push('disarm');s.auto=null;return {};}
   if(query.includes('reviewThreads'))return {repository:{pullRequest:{reviewThreads:{nodes:clone(s.threads),pageInfo:{hasNextPage:false,endCursor:null}}}}};
   return {repository:{pullRequest:{id:'PR_1',autoMergeRequest:clone(s.auto)}}};
  }};
 const args={github,context:{repo:policy.REPO,runId:7},number:1,active:true,statusToken:'synthetic-only',
  scope:()=> 'docs',publish:async x=>{states.push(x);calls.push(x.state);},exec:(file,argv)=>{assert.equal(file,'gh');assert.ok(argv.includes('--auto'));assert.ok(argv.includes(s.pr.head.sha));calls.push('arm');s.auto={enabledBy:{login:'github-actions',__typename:'Bot'},commitBody:'Automatic\n'+policy.TAG};}};
 return {s,args,calls,states,ci};
}

test('eligible ready docs arm the exact head after trusted status and native protection checks',async()=>{
 const f=fixture();await policy.reconcile(f.args);assert.deepEqual(f.calls,['pending','success','arm']);assert.ok(policy.ownRequest(f.s.auto));
 await policy.reconcile(f.args);assert.equal(f.calls.filter(x=>x==='arm').length,1);
});
test('disabled activation publishes classification but never arms',async()=>{
 const f=fixture();await policy.reconcile({...f.args,active:false});assert.deepEqual(f.calls,['pending','success']);
});
test('code replaces a docs-owned request only after verified disarming',async()=>{
 const f=fixture();f.s.auto={enabledBy:{login:'github-actions',__typename:'Bot'},commitBody:policy.TAG};
 await policy.reconcile({...f.args,scope:()=> 'full'});assert.deepEqual(f.calls,['pending','disarm','success']);assert.equal(f.s.auto,null);
});
test('normal code never auto-arms and preserves unrelated manual requests',async()=>{
 const f=fixture();f.s.auto={enabledBy:{login:'antoniodowling'},commitBody:'Manual delivery'};
 await policy.reconcile({...f.args,scope:()=> 'full'});assert.deepEqual(f.calls,['pending','success']);assert.ok(f.s.auto);
});
test('drafts, holds, shared heads, objections and unresolved threads cannot auto-merge',async()=>{
 for(const change of [f=>f.s.pr.draft=true,f=>f.s.pr.labels=[{name:'merge-hold'}],f=>f.s.pr.labels=[{name:'dependencies-pending'}],f=>f.s.pr.labels=[{name:'NEVER-MERGE'}],f=>f.s.shared=2,f=>f.s.reviews=[{id:1,state:'CHANGES_REQUESTED',user:{id:2}},{id:2,state:'COMMENTED',user:{id:2}}]]){
  const f=fixture();change(f);await policy.reconcile(f.args);assert.equal(f.states.at(-1).state,'failure');assert.ok(!f.calls.includes('arm'));
 }
});
test('fork/untrusted docs remain normal CI and never arm',async()=>{
 for(const change of [f=>f.s.pr.head.repo.full_name='other/fork',f=>f.s.pr.user.id=9]){
  const f=fixture();change(f);await policy.reconcile(f.args);assert.ok(['pending','success'].includes(f.states.at(-1).state));assert.ok(!f.calls.includes('arm'));
 }
});
test('retarget and incomplete API files fail closed',async()=>{
 const f=fixture();f.s.pr.base.ref='other';await policy.reconcile(f.args);assert.equal(f.states.at(-1).state,'failure');
 const g=fixture();g.s.pr.changed_files=2;await assert.rejects(policy.reconcile(g.args),/Incomplete/);assert.ok(!g.calls.includes('arm'));
});
test('head change between classification and arming fails closed',async()=>{
 const f=fixture();f.args.scope=()=>{f.s.pr.head.sha='f'.repeat(40);return 'docs';};
 await assert.rejects(policy.reconcile(f.args),/changed/);assert.ok(!f.calls.includes('arm'));
});
test('disarm failure leaves required guard failing',async()=>{
 const f=fixture();f.s.auto={enabledBy:{login:'github-actions',__typename:'Bot'},commitBody:policy.TAG};
 const gql=f.args.github.graphql;f.args.github.graphql=async q=>{if(q.startsWith('mutation'))throw Error('denied');return gql(q);};
 await assert.rejects(policy.reconcile({...f.args,scope:()=> 'full'}),/denied/);assert.equal(f.states.at(-1).state,'failure');
});
test('wrong App issuer or absent required route prevents arming',async()=>{
 for(const rules of [[],[{type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,required_status_checks:[{context:policy.CONTEXT,integration_id:1}]}}]]){
  const f=fixture();const page=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='rules'?rules:page(endpoint);
  await policy.reconcile(f.args);assert.ok(!f.calls.includes('arm'));
 }
});
test('closed PR events do not overwrite a merged head with failure',async()=>{
 const f=fixture();f.s.pr.state='closed';await policy.reconcile(f.args);assert.deepEqual(f.calls,[]);
});
test('unresolved threads defer arming while native protection retains merge blocking',async()=>{
 const f=fixture();f.s.threads=[{isResolved:false}];await policy.reconcile(f.args);assert.equal(f.states.at(-1).state,'success');assert.ok(!f.calls.includes('arm'));
 f.s.threads=[{isResolved:true}];await policy.reconcile(f.args);assert.ok(f.calls.includes('arm'));
});
test('classifier fetches objects, uses trusted Python and fails conservatively',()=>{
 const f=fixture();const calls=[];
 assert.equal(policy.classify(f.s,{token:'synthetic',exec:(name,args)=>{calls.push([name,args]);return name==='python3'?'docs\n':args[0]==='rev-parse'?f.s.pr.base.sha+'\n':'';}}),'docs');
 assert.equal(calls[0][0],'git');assert.ok(!calls.some(([,a])=>a.includes('checkout')));
 assert.equal(policy.classify(f.s,{exec:()=>{throw Error('missing history');}}),'full');
});
test('notification dispatch rejects a workflow outside the trusted allowlist',async()=>{
 const f=fixture();f.args.github.rest.actions={getWorkflowRun:async()=>({data:{path:'other.yml',event:'pull_request',pull_requests:[{number:1}]}})};
 await assert.rejects(policy.control({...f.args,context:{repo:policy.REPO,payload:{workflow_run:{id:4}}}}),/Unexpected notification/);
});

test('expected push completion is ignored without publishing or merging',async()=>{
 const f=fixture();f.args.github.rest.actions={getWorkflowRun:async()=>({data:{path:'.github/workflows/validate.yml',event:'push',pull_requests:[]}})};
 await policy.control({...f.args,context:{repo:policy.REPO,payload:{workflow_run:{id:4}}}});
 assert.deepEqual(f.calls,[]);
});

test('ownership uses the observed raw GraphQL Bot identity and controller footer',()=>{
 const observed={enabledBy:{login:'github-actions',__typename:'Bot'},commitBody:'Automatic merge of verified documentation.\n\n'+policy.TAG};
 assert.ok(policy.ownRequest(observed));
 for(const changed of [
   {...observed,enabledBy:{login:'github-actions',__typename:'User'}},
   {...observed,enabledBy:{login:'other-bot',__typename:'Bot'}},
   {...observed,commitBody:'Manual merge request'}
 ])assert.equal(policy.ownRequest(changed),false);
});

test('code guard waits for actual success instead of accepting skipped draft checks',async()=>{
 for(const conclusion of ['skipped','cancelled','failure',null]){
  const f=fixture();f.ci.jobs[0].conclusion=conclusion;
  await policy.reconcile({...f.args,scope:()=> 'full'});assert.equal(f.states.at(-1).state,conclusion==='skipped'?'pending':'failure');
 }
});
test('latest draft or pending attempt cannot fall back to an older same-head success',async()=>{
 for(const pending of [false,true]){
  const f=fixture();const old=clone(f.ci.run);old.id=8;f.ci.runs.push(old);
  if(pending){f.ci.run.run_attempt=2;f.ci.run.status='in_progress';}
  else f.ci.jobs[0].conclusion='skipped';
  const c=await policy.codeCI(f.args.github,f.s);assert.equal(c.state,'pending');
 }
});
test('foreign provenance, contradictory associations and attempt mismatches fail closed',async()=>{
 for(const change of [f=>f.ci.run.path='other.yml',f=>f.ci.run.repository.full_name='other/repo',
   f=>f.ci.run.pull_requests=[{number:2,head:{sha:f.s.pr.head.sha},base:{sha:f.s.pr.base.sha}}],
   f=>f.ci.run.pull_requests=[{number:1,head:{sha:f.s.pr.head.sha},base:{sha:'not-a-sha'}}],
   f=>f.ci.run.pull_requests=[{number:1,head:{sha:f.s.pr.head.sha},base:{sha:f.s.pr.base.sha,ref:'other'}}]]){
  const f=fixture();change(f);await assert.rejects(policy.codeCI(f.args.github,f.s),/provenance|association/);
 }
 for(const change of [f=>f.ci.jobs[0].run_attempt=2,f=>f.ci.jobs[0].run_id=8,f=>f.ci.jobs[0].head_sha='e'.repeat(40),f=>f.ci.jobs.push(clone(f.ci.jobs[0])),f=>f.ci.jobs=[]]){
  const f=fixture();change(f);assert.equal((await policy.codeCI(f.args.github,f.s)).state,'failure');
 }
});
test('unique current head supports empty private API associations and explicit matching metadata',async()=>{
 for(const explicit of [false,true]){
  const f=fixture();if(explicit)f.ci.run.pull_requests=[{number:1,head:{sha:f.s.pr.head.sha},base:{sha:f.s.pr.base.sha}}];
  assert.equal((await policy.codeCI(f.args.github,f.s)).state,'success');
 }
});
test('newer run arriving during code proof prevents publishing success',async()=>{
 const f=fixture();const page=f.args.github.paginate;let reads=0;
 f.args.github.paginate=async e=>{if(e==='runs'&&++reads===2){const r=clone(f.ci.run);r.id=10;return [r,f.ci.run];}return page(e);};
 assert.equal((await policy.codeCI(f.args.github,f.s)).state,'pending');
});
test('PR changes during code CI reads keep required guard failing',async()=>{
 const f=fixture();const get=f.args.github.rest.actions.getWorkflowRun;
 f.args.github.rest.actions.getWorkflowRun=async()=>{const r=await get();f.s.pr.head.sha='e'.repeat(40);return r;};
 await assert.rejects(policy.reconcile({...f.args,scope:()=> 'full'}),/changed/);assert.equal(f.states.at(-1).state,'failure');
});

test('deactivating docs automation disarms its existing request before guard success',async()=>{
 const f=fixture();f.s.auto={enabledBy:{login:'github-actions',__typename:'Bot'},commitBody:policy.TAG};
 await policy.reconcile({...f.args,active:false});
 assert.deepEqual(f.calls,['pending','disarm','success']);assert.equal(f.s.auto,null);
});

test('additional informational jobs do not weaken mandatory aggregate proof',async()=>{
 const f=fixture();f.ci.jobs.push({...f.ci.jobs[0],id:100,name:'Informational summary',conclusion:'skipped'});
 assert.equal((await policy.codeCI(f.args.github,f.s)).state,'success');
});
test('multiple workflow profiles require every native aggregate',async()=>{
 const f=fixture();
 const second={...clone(f.ci.run),id:10,path:'.github/workflows/second.yml'};
 const jobs=[{...clone(f.ci.jobs[0]),id:100,run_id:10,name:'Second result'}];
 const paginate=f.args.github.paginate;
 f.args.github.paginate=async(endpoint,options)=>{
  if(endpoint==='runs'&&options.workflow_id==='second.yml')return [second];
  if(endpoint==='jobs'&&options.run_id===10)return jobs;
  return paginate(endpoint,options);
 };
 f.args.github.rest.actions.getWorkflowRun=async({run_id})=>({data:clone(run_id===10?second:f.ci.run)});
 const workflows=[{path:f.ci.run.path,aggregates:['validate']},{path:second.path,aggregates:['Second result']}];
 assert.equal((await policy.codeCI(f.args.github,f.s,workflows)).state,'success');
 jobs[0].conclusion='skipped';assert.equal((await policy.codeCI(f.args.github,f.s,workflows)).state,'pending');
 jobs[0].conclusion='success';second.status='in_progress';assert.equal((await policy.codeCI(f.args.github,f.s,workflows)).state,'pending');
});


test('loose required checks retain the protected docs auto-merge route',async()=>{
 const f=fixture();const paginate=f.args.github.paginate;
 f.args.github.paginate=async(endpoint,...args)=>{
  const result=await paginate(endpoint,...args);
  if(endpoint==='rules')for(const rule of result)if(rule.type==='required_status_checks')rule.parameters.strict_required_status_checks_policy=false;
  return result;
 };
 await policy.reconcile(f.args);assert.ok(f.calls.includes('arm'));assert.ok(policy.ownRequest(f.s.auto));
});
test('completed current-head code CI survives a later target-base advance',async()=>{
 for(const explicitTarget of [false,true]){
  const f=fixture();const oldBase='e'.repeat(40);
  f.ci.run.pull_requests=[{number:f.s.pr.number,head:{sha:f.s.pr.head.sha},base:{sha:oldBase,...(explicitTarget?{ref:f.s.pr.base.ref}:{})}}];
  await policy.reconcile({...f.args,scope:()=> 'full'});
  assert.equal(f.states.at(-1).state,'success');assert.ok(!f.calls.includes('arm'));
 }
});
test('target advance never permits evidence for a changed head',async()=>{
 const f=fixture();f.s.pr.head.sha='e'.repeat(40);
 assert.notEqual((await policy.codeCI(f.args.github,f.s)).state,'success');
});
test('target-base drift during one classification still fails closed',async()=>{
 const f=fixture();f.args.scope=()=>{f.s.pr.base.sha='e'.repeat(40);return 'docs';};
 await assert.rejects(policy.reconcile(f.args),/changed/);assert.ok(!f.calls.includes('arm'));
});
