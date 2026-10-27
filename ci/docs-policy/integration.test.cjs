"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gate=require('./integration.cjs');
const adapter=require('./controller.cjs');
const profile=require('./profile.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const head='a'.repeat(40), base='b'.repeat(40);
function review(changes={}) {
  return {id:7,state:'COMMENTED',user:{login:'antoniodowling',id:26848379},commit_id:head,
    submitted_at:'2026-10-26T00:00:00Z',body:`LGTM\n\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->`,...changes};
}
function fixture() {
  const s={pr:{number:1,state:'open',draft:false,mergeable:true,changed_files:1,
    user:{login:'dependabot[bot]',id:42},labels:[],head:{sha:head,ref:'candidate',repo:{full_name:profile.repository}},
    base:{sha:base,ref:'main',repo:{full_name:profile.repository}},merge_commit_sha:'c'.repeat(40)},
    targetSha:base,files:[{filename:'package-lock.json',status:'modified',sha:'d'.repeat(40)}],
    reviews:[review()],threads:[],auto:null,shared:1,id:'PR_fixture'};
  const repository={full_name:profile.repository,archived:false,disabled:false,allow_merge_commit:true,allow_auto_merge:true};
  const rules=[{type:'pull_request',parameters:{required_review_thread_resolution:true}},{type:'non_fast_forward'},{type:'deletion'},
    {type:'required_status_checks',parameters:{strict_required_status_checks_policy:false,required_status_checks:[
      {context:gate.LEGACY,integration_id:5363850},{context:gate.REVIEW,integration_id:5363850},
      {context:gate.CI,integration_id:5363850},{context:'validate',integration_id:15368}]}}];
  const run={id:9,check_suite_id:91,run_attempt:1,status:'completed',conclusion:'success',head_sha:head,
    head_branch:'candidate',event:'pull_request',path:'.github/workflows/validate.yml',
    repository:{full_name:profile.repository},head_repository:{full_name:profile.repository},
    pull_requests:[{number:1,head:{sha:head},base:{sha:base,ref:'main'}}]};
  const jobs=[{id:99,run_id:9,run_attempt:1,head_sha:head,name:'validate',status:'completed',conclusion:'success',
    check_run_url:`https://api.github.com/repos/${profile.repository}/check-runs/99`}];
  const checks=[{id:99,name:'validate',app:{id:15368},check_suite:{id:91},head_sha:head,status:'completed',conclusion:'success'}];
  const statuses=[],mutations=[],reads=[];
  let enrollmentBehavior=null;
  const github={rest:{pulls:{get:async()=>({data:clone(s.pr)}),listFiles:'files',listReviews:'reviews',list:'open'},
    repos:{get:async()=>({data:clone(repository)}),getBranchRules:'rules',listPullRequestsAssociatedWithCommit:'associated'},
    actions:{listWorkflowRuns:'runs',listJobsForWorkflowRun:'jobs',getWorkflowRun:async()=>({data:clone(run)})},
    issues:{removeLabel:async({name})=>{s.pr.labels=s.pr.labels.filter(l=>l.name!==name);}},
    checks:{listForRef:'checks'}},
    paginate:async endpoint=>{
      reads.push(endpoint);
      return clone({files:s.files,reviews:s.reviews,associated:Array.from({length:s.shared},()=>({state:'open',head:{sha:s.pr.head.sha}})),
        rules,runs:[run],jobs,checks,open:[s.pr]}[endpoint]);
    },
    graphql:async(query,variables)=>{
      if(query===gate.ENABLE){
        mutations.push(clone(variables.input));
        if(enrollmentBehavior)await enrollmentBehavior(variables.input);
        if(variables.input.expectedHeadOid!==s.pr.head.sha)throw Error('Expected head did not match');
        s.auto={mergeMethod:'MERGE',commitBody:variables.input.commitBody,enabledBy:{login:'github-actions',__typename:'Bot'}};
        return {enablePullRequestAutoMerge:{pullRequest:{id:s.id,headRefOid:s.pr.head.sha,autoMergeRequest:s.auto}}};
      }
      assert.ok(!query.includes('mergePullRequest('),'No direct merge operation exists');
      if(query.includes('reviewThreads'))return {repository:{pullRequest:{reviewThreads:{nodes:clone(s.threads),pageInfo:{hasNextPage:false,endCursor:null}}}}};
      return {repository:{ref:{target:{oid:s.targetSha}},pullRequest:{id:s.id,headRefOid:s.pr.head.sha,autoMergeRequest:clone(s.auto)}}};
    }};
  const args={github,context:{repo:adapter.REPO,runId:11,payload:{}},number:1,mode:'enforce',autoMerge:true,
    statusToken:'fixture-only',adapter,profile,publish:async x=>statuses.push(clone(x))};
  return {s,repository,rules,run,jobs,checks,statuses,mutations,reads,args,
    enrollment:fn=>{enrollmentBehavior=fn;}};
}

test('real GitHub COMMENT review from PR author can establish exact-head authorization',()=>{
  assert.equal(gate.reviewAuthorization({head:{sha:head}},[review()]).ok,true);
});
test('only complete actual trusted current-head reviews authorize',()=>{
  const cases=[[],null,[review({user:{login:'antoniodowling',id:1}})],
    [review({user:{login:'attacker',id:26848379}})],[review({commit_id:'f'.repeat(40)})],
    [review({state:'PENDING'})],[review({state:'DISMISSED'})],[review({submitted_at:null})],
    [review({body:`Incomplete\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->`})],
    [review({body:`LGTM\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->\n<!-- chatgpt-hourly-pr-review:bad -->`})],
    [review({body:`LGTM\n<!-- chatgpt-hourly-pr-review:v1 head=${'e'.repeat(40)} -->`})],
    [review(),review({id:8,body:'Changes requested'})],
    [review(),review({id:8,state:'CHANGES_REQUESTED'})],
    [review(),review({id:8,body:'Incomplete'})]];
  for(const reviews of cases)assert.equal(gate.reviewAuthorization({head:{sha:head}},reviews).ok,false,JSON.stringify(reviews));
  assert.equal(gate.reviewAuthorization({head:{sha:'e'.repeat(40)}},[review()]).ok,false);
});
test('formal objections survive a later COMMENT and require real dismissal or approval',()=>{
  const objection=review({id:6,state:'CHANGES_REQUESTED',user:{login:'other',id:9}});
  assert.equal(gate.reviewAuthorization({head:{sha:head}},[objection,review()]).ok,false);
  assert.equal(gate.reviewAuthorization({head:{sha:head}},[objection,review({id:8,user:{login:'other',id:9}}),review()]).ok,false);
});
test('forged marker in PR body or ordinary issue comment is not review evidence; cheap read precedes files',async()=>{
  const f=fixture();f.s.reviews=[];f.s.pr.body=review().body;f.s.issueComments=[review()];
  const result=await gate.reconcile(f.args);assert.equal(result.state,'BLOCKED');
  assert.deepEqual(f.reads,['reviews']);assert.equal(f.mutations.length,0);
});
test('native mutation pins node, MERGE and full reviewed head; replay reuses enrollment and completed CI',async()=>{
  const f=fixture();const result=await gate.reconcile(f.args);
  assert.equal(result.state,'AUTO_MERGE_ARMED');assert.equal(f.s.auto.mergeMethod,'MERGE');
  assert.equal(f.mutations[0].pullRequestId,'PR_fixture');assert.equal(f.mutations[0].expectedHeadOid,head);
  assert.equal(f.mutations[0].mergeMethod,'MERGE');assert.ok(f.statuses.some(s=>s.contextName===gate.REVIEW&&s.state==='success'));
  assert.equal((await gate.reconcile(f.args)).existing,true);assert.equal(f.mutations.length,1);
  assert.ok(!f.reads.includes('createWorkflowDispatch'),'No extra CI/review/label operation');
});
test('pending and running CI allow enrollment; failed or skipped aggregate remains unmerged',async()=>{
  for(const state of ['queued','in_progress']){
    const f=fixture();f.run.status=state;f.run.conclusion=null;
    const result=await gate.reconcile(f.args);assert.equal(result.state,'AUTO_MERGE_ARMED');assert.equal(result.ci,'pending');
    assert.equal(f.statuses.findLast(s=>s.contextName===gate.CI).state,'pending');
  }
  for(const change of [f=>f.run.conclusion='failure',f=>f.jobs[0].head_sha='e'.repeat(40)]){
    const f=fixture();change(f);assert.equal((await gate.reconcile(f.args)).state,'CI_FAILED');assert.equal(f.mutations.length,0);
  }
  const deferred=fixture();deferred.jobs[0].conclusion='skipped';
  assert.equal((await gate.reconcile(deferred.args)).ci,'pending');
  assert.ok(!deferred.statuses.some(s=>s.contextName===gate.CI&&s.state==='success'));
});
test('CI checks need real native provider identity and successful executed aggregate',async()=>{
  for(const change of [f=>f.checks[0].app.id=999,f=>f.checks[0].check_suite.id=1,
    f=>f.checks[0].conclusion='skipped',f=>f.checks[0].head_sha='e'.repeat(40),f=>f.run.check_suite_id=null]){
    const f=fixture();change(f);await assert.rejects(gate.reconcile(f.args),/identity|provider/);assert.equal(f.mutations.length,0);
    assert.equal(f.statuses.at(-1).state,'failure');
  }
});
test('qualified old-base execution remains accepted; contradictory base ref does not',async()=>{
  const f=fixture();f.run.pull_requests[0].base.sha='e'.repeat(40);
  assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');
  const g=fixture();g.run.pull_requests[0].base.ref='other';
  await assert.rejects(gate.reconcile(g.args),/association/);assert.equal(g.mutations.length,0);
});
test('all ordinary integration vetoes survive review success',async()=>{
  const cases=[f=>f.s.pr.draft=true,f=>f.s.pr.mergeable=false,f=>f.s.pr.mergeable=null,
    f=>f.s.pr.labels=[{name:'merge-hold'}],f=>f.s.pr.labels=[{name:'dependencies-pending'}],
    f=>f.s.pr.head.repo.full_name='attacker/fork',f=>f.s.pr.base.ref='other',f=>f.repository.archived=true,
    f=>f.repository.allow_auto_merge=false,f=>f.repository.allow_merge_commit=false,
    f=>f.s.threads=[{isResolved:false}],f=>f.s.shared=2,f=>f.s.targetSha=null];
  for(const change of cases){const f=fixture();change(f);assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.mutations.length,0);}
  const f=fixture();f.args.context.repo={owner:'antoniodowling',repo:'Codex-Knowledge-Base'};
  assert.equal((await gate.reconcile(f.args)).state,'REVIEW_ONLY');assert.deepEqual(f.statuses,[]);
});
test('missing, spoofed or wrong-App required contexts never permit enrollment',async()=>{
  for(const change of [f=>f.rules[3].parameters.required_status_checks.splice(1,1),
    f=>f.rules[3].parameters.required_status_checks[1].integration_id=15368,
    f=>f.rules.splice(0,1)]){
    const f=fixture();change(f);const r=await gate.reconcile(f.args);assert.equal(r.state,'BLOCKED');assert.equal(f.mutations.length,0);
  }
});
test('shadow producers and enforce-without-enrollment never activate merging',async()=>{
  for(const args of [{mode:'shadow'},{autoMerge:false}]){
    const f=fixture();assert.equal((await gate.reconcile({...f.args,...args})).state,'VALIDATED_NO_ENROLLMENT');assert.equal(f.mutations.length,0);
  }
});
test('protected workflows, implementations, credentials and renamed controls cannot authorize themselves',async()=>{
  for(const name of ['.github/workflows/ci.yml','ci/docs-policy/controller.cjs','.github/credentials.json']){
    const f=fixture();f.s.files[0].filename=name;
    assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.mutations.length,0);
  }
  assert.deepEqual(gate.protectedPaths([{filename:'safe.json',previous_filename:'ci/old.cjs'}]),['ci/old.cjs']);
});
test('separately installed protected authorization binds actual head, target, review, files, policy and executed CI',()=>{
  const f=fixture(),auth=gate.reviewAuthorization(f.s.pr,f.s.reviews),evidence={runIds:[9],runs:[{testedBase:base}]};
  const record={repository:profile.repository,number:1,head,base,reviewId:7,filesDigest:gate.filesDigest(f.s.files),
    policyDigest:gate.policyDigest(),runIds:[9],supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true,
    authorization:{actor:'antoniodowling',actorId:26848379,url:'https://github.com/antoniodowling/file-validation-wizard/pull/1#pullrequestreview-123'}};
  assert.equal(gate.protectedAuthorization(f.s,auth,evidence,{version:1,approvals:[record]}).ok,true);
  for(const changes of [{head:'e'.repeat(40)},{base:'e'.repeat(40)},{policyDigest:'0'.repeat(64)},
    {reviewId:1},{filesDigest:'0'.repeat(64)},{runIds:[]},{nonWeakeningReviewed:false},
    {authorization:{actor:'attacker',actorId:1,url:'https://github.com/attacker/repo/pull/1'}}]){
    assert.equal(gate.protectedAuthorization(f.s,auth,evidence,{version:1,approvals:[{...record,...changes}]}).ok,false);
  }
});
test('native expectedHeadOid rejection cannot enroll a silently substituted head',async()=>{
  const f=fixture();f.enrollment(()=>{f.s.pr.head.sha='e'.repeat(40);});
  assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.s.auto,null);
  assert.equal(f.mutations[0].expectedHeadOid,head);
});
test('native credential rejection is a failure, never direct merge fallback',async()=>{
  const f=fixture();f.enrollment(()=>{const e=Error('denied');e.status=403;throw e;});
  await assert.rejects(gate.reconcile(f.args),/rejected: 403/);assert.equal(f.s.auto,null);assert.equal(f.statuses.at(-1).state,'failure');
});
test('timeout or concurrent authorized enrollment is recovered by authoritative readback',async()=>{
  const f=fixture();f.enrollment(()=>{f.s.auto={mergeMethod:'MERGE',enabledBy:{login:'another-authorized-actor'}};throw Error('timeout');});
  assert.equal((await gate.reconcile(f.args)).recoveredRace,true);assert.equal(f.mutations.length,1);
});
test('simultaneous scheduled invocations coalesce within process and replay observes GitHub state',async()=>{
  const f=fixture();const r=await Promise.all([gate.reconcile(f.args),gate.reconcile(f.args)]);
  assert.equal(r[0].state,'AUTO_MERGE_ARMED');assert.equal(r[1].state,'AUTO_MERGE_ARMED');assert.equal(f.mutations.length,1);
  const source=fs.readFileSync('.github/workflows/docs-automerge.yml','utf8');
  assert.match(source,/group: trusted-integration-policy\n  cancel-in-progress: false/);
});
test('head or actual target ref drift before mutation invalidates optimistic authorization',async()=>{
  for(const field of ['head','target']){
    const f=fixture(),original=f.args.github.paginate;
    let n=0;f.args.github.paginate=async endpoint=>{
      const value=await original(endpoint);
      if(endpoint==='rules'&&++n===2){if(field==='head')f.s.pr.head.sha='e'.repeat(40);else f.s.targetSha='e'.repeat(40);}
      return value;
    };
    assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.mutations.length,0);
  }
});
test('current-head reviews and qualified evidence are reused without label mutation, review submission or rerun',async()=>{
  const f=fixture();f.s.pr.labels=[{name:'ci-ready'}];
  await gate.reconcile(f.args);await gate.reconcile(f.args);
  assert.deepEqual(f.s.pr.labels,[{name:'ci-ready'}]);assert.equal(f.s.reviews.length,1);assert.equal(f.mutations.length,1);
});
test('merged PRs terminate without further status or mutation; incomplete API file evidence fails',async()=>{
  const f=fixture();f.s.pr.state='closed';f.s.pr.merged=true;
  assert.equal((await gate.reconcile(f.args)).state,'MERGED');assert.deepEqual(f.statuses,[]);
  const g=fixture();g.s.pr.changed_files=2;await assert.rejects(gate.reconcile(g.args),/Incomplete file/);assert.equal(g.mutations.length,0);
});

test('new workflow attempt after initial qualification never publishes CI success',async()=>{
  const f=fixture(),read=f.args.github.rest.actions.getWorkflowRun;let count=0;
  f.args.github.rest.actions.getWorkflowRun=async()=>{
    if(++count===3){f.run.run_attempt=2;f.run.status='in_progress';f.run.conclusion=null;}
    return read();
  };
  await assert.rejects(gate.reconcile(f.args),/changed after qualification/);
  assert.equal(f.mutations.length,0);assert.ok(!f.statuses.some(s=>s.contextName===gate.CI&&s.state==='success'));
});
test('disabled enforcement after migration fails closed on a previously successful armed head',async()=>{
  const f=fixture();await gate.reconcile(f.args);f.s.reviews.push(review({id:8,body:'Changes requested'}));
  const r=await gate.reconcile({...f.args,mode:'disabled'});assert.equal(r.state,'BLOCKED');
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.REVIEW).state,'failure');
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.LEGACY).state,'failure');
  assert.equal(f.mutations.length,1);
});
test('approval installation may advance main without requiring a self-referential commit hash',()=>{
  const f=fixture();f.s.targetSha='e'.repeat(40);
  const record={repository:profile.repository,number:1,head,base,reviewId:7,filesDigest:gate.filesDigest(f.s.files),
    policyDigest:gate.policyDigest(),runIds:[9],supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true,
    authorization:{actor:'antoniodowling',actorId:26848379,url:'https://github.com/antoniodowling/file-validation-wizard/pull/1'}};
  assert.equal(gate.protectedAuthorization(f.s,gate.reviewAuthorization(f.s.pr,f.s.reviews),
    {runIds:[9],runs:[{testedBase:base}]},{version:1,approvals:[record]}).ok,true);
});

test('source admission requires review, connected handoff, native enrollment and installed dual checks',async()=>{
  const {authorize}=require('./admission.cjs');
  const f=fixture();f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  assert.equal((await authorize({...f.args,mode:'enforce'})).run,false);
  f.s.pr.labels=[{name:'ci-ready'}];
  assert.equal((await authorize({...f.args,mode:'enforce'})).run,false);
  f.s.auto={mergeMethod:'MERGE'};
  assert.equal((await authorize({...f.args,mode:'enforce'})).run,false,'Completed current-head evidence is reused');
  const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
  assert.equal((await authorize({...f.args,mode:'enforce'})).run,true);
  f.s.reviews=[];assert.equal((await authorize({...f.args,mode:'enforce'})).run,false);
  assert.equal((await authorize({...f.args,mode:'shadow'})).run,true);
});
test('source admission rejects stale event, changed review, hold and draft before substantive work',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const change of [f=>f.s.pr.head.sha='e'.repeat(40),f=>f.s.pr.draft=true,
    f=>f.s.pr.labels.push({name:'merge-hold'}),f=>f.repository.archived=true]){
    const f=fixture();f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};change(f);
    assert.equal((await authorize({...f.args,mode:'enforce'})).run,false);
  }
});
test('proven stale-head ci-ready is invalidated once; valid current-head label is never reset',async()=>{
  const f=fixture();f.s.pr.head.sha='e'.repeat(40);f.s.pr.labels=[{name:'ci-ready'}];let removed=0;
  f.args.github.rest.issues={removeLabel:async()=>{removed++;f.s.pr.labels=[];}};
  assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');
  assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(removed,1);assert.equal(f.mutations.length,0);
});
test('deferred admission is never successful proof, but preserves earlier real exact-head CI',async()=>{
  for(const originalExists of [false,true]){
    const f=fixture();const original=f.args.github.paginate;
    const deferred={...clone(f.run),id:10,check_suite_id:101};
    f.args.github.paginate=async endpoint=>{
      if(endpoint==='runs')return [clone(deferred),...(originalExists?[clone(f.run)]:[])];
      return original(endpoint);
    };
    let currentRun=0;
    f.args.github.rest.actions.getWorkflowRun=async({run_id})=>{currentRun=run_id;return {data:clone(run_id===10?deferred:f.run)};};
    const pages=f.args.github.paginate;
    f.args.github.paginate=async endpoint=>{
      if(endpoint==='jobs'&&currentRun===10)return [{name:'Classify offline scope',status:'completed',conclusion:'success',
        steps:[{name:'Review-authorized CI admission',conclusion:'success'}]},
        {...f.jobs[0],run_id:10,conclusion:'skipped'}];
      return pages(endpoint);
    };
    const result=await gate.reconcile(f.args);assert.equal(result.state,'AUTO_MERGE_ARMED');
    assert.equal(result.ci,originalExists?'success':'pending');
    assert.equal(f.statuses.findLast(s=>s.contextName===gate.CI).state,originalExists?'success':'pending');
  }
});
test('protected runtime handoff accepts independently installed approval after main advances',async()=>{
  const os=require('node:os'),path=require('node:path');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'protected-integration-fixture-'));
  try {
    fs.cpSync(__dirname,path.join(tmp,'ci/docs-policy'),{recursive:true});
    fs.cpSync('.github/workflows',path.join(tmp,'.github/workflows'),{recursive:true});
    fs.mkdirSync(path.join(tmp,'tools'),{recursive:true});fs.copyFileSync('tools/docs_ci.py',path.join(tmp,'tools/docs_ci.py'));
    for(const name of ['fast-ci.py','fast-result.cjs'])fs.copyFileSync(`ci/${name}`,path.join(tmp,'ci',name));
    const f=fixture();f.s.files[0].filename='.github/workflows/dependency.yml';f.s.targetSha='e'.repeat(40);
    const record={repository:profile.repository,number:1,head,base,reviewId:7,filesDigest:gate.filesDigest(f.s.files),
      policyDigest:gate.policyDigest(),runIds:[9],supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true,
      allowCI:true,
      authorization:{actor:'antoniodowling',actorId:26848379,url:'https://github.com/antoniodowling/file-validation-wizard/pull/1'}};
    fs.writeFileSync(path.join(tmp,'ci/docs-policy/protected-integrations.json'),JSON.stringify({version:1,approvals:[record]}));
    f.args.github.rest.repos.compareCommitsWithBasehead=async({basehead})=>{
      assert.equal(basehead,`${base}...${f.s.targetSha}`);return {data:{status:'ahead',merge_base_commit:{sha:base}}};
    };
    const protectedGate=require(path.join(tmp,'ci/docs-policy/integration.cjs'));
    const protectedAdmission=require(path.join(tmp,'ci/docs-policy/admission.cjs'));
    f.s.pr.labels=[{name:'ci-ready'}];f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    const pages=f.args.github.paginate;let hasRun=false;
    f.args.github.paginate=async endpoint=>endpoint==='runs'&&!hasRun?[]:pages(endpoint);
    assert.equal(f.s.auto,null);
    assert.equal((await protectedAdmission.authorize(f.args)).run,true,'Separate protected grant authorizes first CI before enrollment');
    hasRun=true;
    assert.equal((await protectedGate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');
    f.s.pr.head.sha='f'.repeat(40);assert.equal((await protectedGate.reconcile(f.args)).state,'BLOCKED');
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});

test('shadow control keeps the existing required legacy producer alive while publishing new gates',async()=>{
  const f=fixture();f.args.context.payload={pull_request:{number:1}};f.args.scope=()=> 'full';
  f.rules[3].parameters.required_status_checks=f.rules[3].parameters.required_status_checks.filter(c=>![gate.REVIEW,gate.CI].includes(c.context));
  await adapter.control({...f.args,integrationMode:'shadow'});
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.LEGACY).state,'success');
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.REVIEW).state,'success');assert.equal(f.mutations.length,0);
});
test('any partial installed migration fails closed when mode is cleared even if native rules drift',async()=>{
  const f=fixture();f.args.context.payload={pull_request:{number:1}};
  f.rules.splice(0,1);f.rules.at(-1).parameters.required_status_checks=f.rules.at(-1).parameters.required_status_checks.filter(c=>c.context===gate.REVIEW);
  f.s.reviews.push(review({id:8,body:'Changes requested'}));
  await adapter.control({...f.args,integrationMode:undefined});
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.REVIEW).state,'failure');
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.CI).state,'failure');assert.equal(f.mutations.length,0);
});

test('draft-only skipped graph remains pending and admits first real reviewed execution on readiness',async()=>{
  const {authorize}=require('./admission.cjs'),f=fixture();f.jobs[0].conclusion='skipped';
  f.s.pr.labels=[{name:'ci-ready'}];
  assert.equal((await gate.reconcile(f.args)).ci,'pending');
  f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr),action:'ready_for_review'};
  assert.equal((await authorize(f.args)).run,true);
  assert.ok(!f.statuses.some(s=>s.contextName===gate.CI&&s.state==='success'));
});
test('unknown mixed skipped graph cannot substitute for executed CI or permit automatic retry',async()=>{
  const f=fixture();f.jobs[0].conclusion='skipped';f.jobs.push({name:'Classify offline scope',status:'completed',conclusion:'success'});
  assert.equal((await gate.reconcile(f.args)).state,'CI_FAILED');assert.equal(f.mutations.length,0);
});
test('queued handoff reevaluates after earlier admission envelope finishes deferred',async()=>{
  const {authorize}=require('./admission.cjs'),f=fixture();f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
  f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr),action:'labeled',label:{name:'ci-ready'}};
  f.run.status='in_progress';f.run.conclusion=null;
  // The shared workflow concurrency group queues the handoff until this prior
  // envelope completes. Its post-queue admission sees the resolved missing work.
  f.run.status='completed';f.run.conclusion='success';f.jobs[0].conclusion='skipped';
  f.jobs.push({name:'Classify offline scope',status:'completed',conclusion:'success',steps:[{name:'Review-authorized CI admission',conclusion:'success'}]});
  assert.equal((await authorize(f.args)).run,true);
});
test('multi-workflow source admission requires exact own workflow identity',async()=>{
  const {authorize}=require('./admission.cjs'),f=fixture();
  f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  profile.workflows.push({path:'.github/workflows/other.yml',aggregates:['Other result']});
  try {
    await assert.rejects(authorize(f.args),/Exact configured source workflow/);
    await assert.rejects(authorize({...f.args,workflowPath:'.github/workflows/forged.yml'}),/Exact configured source workflow/);
  } finally {profile.workflows.pop();}
});
test('manual auto request never grants new protected CI without independent prospective approval',async()=>{
  const {authorize}=require('./admission.cjs'),f=fixture();
  f.s.files[0].filename='.github/workflows/ci.yml';f.s.auto={mergeMethod:'MERGE'};f.s.pr.labels=[{name:'ci-ready'}];
  f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
  assert.equal((await authorize(f.args)).run,false);
});

function grantReview(f,id=8,changes={}) {
  const request=gate.buildOperatorReview(f.s,{allowCI:true,runIds:[],supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true});
  return review({id,body:request.body,html_url:`https://github.com/${profile.repository}/pull/1#pullrequestreview-${id}`,...changes});
}
test('actual separate operator review grants protected CI and native handoff without changing main policy',async()=>{
  const f=fixture();f.s.files[0].filename='.github/workflows/ci.yml';f.s.pr.labels=[{name:'ci-ready'}];
  f.s.reviews.push(grantReview(f));
  assert.equal(gate.reviewAuthorization(f.s.pr,f.s.reviews).reviewId,7,'Original LGTM is reused');
  assert.equal(gate.protectedCIApproval(f.s,gate.reviewAuthorization(f.s.pr,f.s.reviews)).ok,true);
  const {authorize}=require('./admission.cjs');f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  const pages=f.args.github.paginate;let executed=false;
  f.args.github.paginate=async endpoint=>endpoint==='runs'&&!executed?[]:pages(endpoint);
  assert.equal((await authorize(f.args)).run,true,'Prospective grant permits first protected execution');
  executed=true;assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');
  assert.equal(f.s.reviews.length,2,'No replacement LGTM submitted');
});
test('operator grant cannot come from PR text, issue comments, untrusted identities or wrong review commit',()=>{
  const f=fixture();f.s.files[0].filename='.github/workflows/ci.yml';const grant=grantReview(f);
  f.s.pr.body=grant.body;f.s.issueComments=[grant];
  assert.equal(gate.protectedCIApproval(f.s,gate.reviewAuthorization(f.s.pr,f.s.reviews)).ok,false);
  for(const changes of [{user:{login:'attacker',id:26848379}},{user:{login:'antoniodowling',id:1}},
    {commit_id:'e'.repeat(40)},{state:'DISMISSED'},{html_url:'https://github.com/antoniodowling/other/pull/1#pullrequestreview-8'},
    {body:grant.body+'\n<!-- protected-integration-authorization:v1 {} -->'},
    {body:grant.body.replace('"number":1','"number":1,"number":1')}])assert.equal(gate.operatorGrant({...grant,...changes}),null);
});
test('latest stale operator grant cannot fall back; revoked or later blocking review withholds integration',()=>{
  const f=fixture();f.s.files[0].filename='.github/workflows/ci.yml';const first=grantReview(f);f.s.reviews.push(first);
  const newer={...first,id:9,html_url:`https://github.com/${profile.repository}/pull/1#pullrequestreview-9`,
    body:first.body.replace(gate.policyDigest(),'0'.repeat(64))};f.s.reviews.push(newer);
  assert.equal(gate.protectedCIApproval(f.s,gate.reviewAuthorization(f.s.pr,f.s.reviews)).ok,false);
  f.s.reviews=[review(),first,review({id:10,body:'PROTECTED INTEGRATION REVOKED'})];
  assert.equal(gate.reviewAuthorization(f.s.pr,f.s.reviews).ok,false);
  f.s.reviews=[review(),first,review({id:11,state:'CHANGES_REQUESTED',body:'Changes requested'})];
  assert.equal(gate.reviewAuthorization(f.s.pr,f.s.reviews).ok,false);
});
test('grant formatter requires affirmative assessments and complete trusted owning snapshot',()=>{
  const f=fixture();f.s.files[0].filename='.github/workflows/ci.yml';
  assert.throws(()=>gate.buildOperatorReview(f.s),/assessment/);
  f.s.pr.changed_files=2;assert.throws(()=>gate.buildOperatorReview(f.s,{supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true}),/assessment/);
});

test('operator grant reuses qualified older-base protected CI after main advances without another suite',async()=>{
  const f=fixture();f.s.files[0].filename='.github/workflows/ci.yml';f.s.targetSha='e'.repeat(40);
  const request=gate.buildOperatorReview(f.s,{approvedBase:base,allowCI:false,runIds:[9],
    supplyChainReviewed:true,permissionsReviewed:true,nonWeakeningReviewed:true});
  f.s.reviews.push(review({id:8,body:request.body,html_url:`https://github.com/${profile.repository}/pull/1#pullrequestreview-8`}));
  f.args.github.rest.repos.compareCommitsWithBasehead=async()=>({data:{status:'ahead',merge_base_commit:{sha:base}}});
  assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');
  assert.deepEqual(f.s.reviews.map(r=>r.id),[7,8]);assert.equal(f.mutations.length,1);
});

test('in-flight evaluator permits unrelated main advancement but rejects changed, renamed or incomplete trusted policy',async()=>{
  const loaded='a'.repeat(40),target='b'.repeat(40);let changes=[{filename:'application.txt'}];
  const github={rest:{git:{getRef:async()=>({data:{object:{sha:target}}})},repos:{compareCommitsWithBasehead:async()=>({data:{status:'ahead',merge_base_commit:{sha:loaded},files:changes}})}}};
  const options={exec:()=>loaded};assert.equal(await gate.currentPolicySource(github,adapter.REPO,options),true);
  for(const files of [[{filename:'ci/docs-policy/integration.cjs'}],[{filename:'renamed.json',previous_filename:'ci/docs-policy/protected-integrations.json'}],
    Array.from({length:300},(_,i)=>({filename:`app-${i}`}))]){
    changes=files;assert.equal(await gate.currentPolicySource(github,adapter.REPO,options),false);
  }
});
test('stale policy source fails gates closed before publishing eligibility or enrollment',async()=>{
  const f=fixture();f.args.context.eventName='pull_request_target';f.args.context.payload={pull_request:{number:1}};
  const result=await gate.control({...f.args,validateSource:async()=>false});
  assert.equal(result[0].state,'BLOCKED');assert.equal(f.mutations.length,0);
  assert.equal(f.statuses.findLast(s=>s.contextName===gate.REVIEW).state,'failure');
});

test('policy validation errors and policy drift during reconciliation invalidate earlier armed eligibility',async()=>{
  for(const outcomes of [[new Error('GitHub metadata unavailable')],[true,false],[true,true,false]]){
    const f=fixture();f.s.auto={mergeMethod:'MERGE'};
    f.args.context.eventName='pull_request_target';f.args.context.payload={pull_request:{number:1}};
    let calls=0;
    const result=await gate.control({...f.args,validateSource:async()=>{
      const v=outcomes[calls++];if(v instanceof Error)throw v;return v;
    }});
    assert.equal(result[0].state,'BLOCKED');assert.equal(f.mutations.length,0);
    for(const context of [gate.REVIEW,gate.CI,gate.LEGACY])
      assert.equal(f.statuses.findLast(s=>s.contextName===context).state,'failure');
    if(outcomes.length<3)assert.ok(!f.statuses.some(s=>s.state==='success'));
  }
});

test('protected prose retains ordinary handoff only after trusted immutable Git docs classification',async()=>{
  const f=fixture();f.s.files[0].filename='AGENTS.md';let classified=0;
  f.args.adapter={...adapter,classify:()=>{classified++;return 'docs';}};
  assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');assert.equal(classified,1);
  for(const classify of [()=> 'full',()=>{throw Error('incomplete Git evidence');}]){
    const x=fixture();x.s.files[0].filename='ci/fixtures/README.md';x.args.adapter={...adapter,classify};
    assert.equal((await gate.reconcile(x.args)).state,'BLOCKED');assert.equal(x.mutations.length,0);
  }
  const x=fixture();x.s.files[0].filename='.github/workflows/ci.yml';
  assert.equal(await gate.requiresProtectedIntegration(x.s,{classify:()=> 'full'},x.args.github),true);
});

test('ordinary implementation and regression tests enroll and admit CI without a protected operator grant',async()=>{
  const f=fixture();f.s.files=['src/example.py','tests/test_example.py','tools/export_report.py','scripts/run_report.sh']
    .map(filename=>({filename,status:'modified',sha:'d'.repeat(40)}));f.s.pr.changed_files=f.s.files.length;
  assert.deepEqual(gate.protectedPaths(f.s.files),[]);
  assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');
  f.s.pr.labels=[{name:'ci-ready'}];f.args.context.eventName='pull_request';
  f.args.context.payload={pull_request:clone(f.s.pr)};
  const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
  assert.equal((await require('./admission.cjs').authorize({...f.args,workflowPath:profile.workflows[0].path})).run,true);
  assert.equal(f.s.reviews.length,1,'No operator grant or replacement LGTM');
});
test('exact main-owned classifier, imported evaluators and workflow paths stay protected through renames',()=>{
  const paths=[profile.classifier,...(profile.trustedPolicyInputs||[]),...profile.workflows.map(w=>w.path),
    'ci/docs-policy/integration.cjs','.github/workflows/other.yml'];
  for(const filename of paths){
    assert.deepEqual(gate.protectedPaths([{filename,status:'modified'}]),[filename]);
    assert.deepEqual(gate.protectedPaths([{filename:'tests/ordinary.py',previous_filename:filename,status:'renamed'}]),[filename]);
  }
});

test('completed CI keeps actual required evaluation pending until native enrollment avoids clean-status rejection',async()=>{
  const f=fixture();let checked=false;
  f.enrollment(()=>{
    for(const context of [gate.CI,gate.LEGACY]){
      if(f.statuses.findLast(s=>s.contextName===context)?.state==='success')throw Error('Pull request is in clean status');
      assert.equal(f.statuses.findLast(s=>s.contextName===context)?.state,'pending');
    }
    checked=true;
  });
  assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');assert.equal(checked,true);
  for(const context of [gate.CI,gate.LEGACY])assert.equal(f.statuses.findLast(s=>s.contextName===context).state,'success');
  assert.equal(f.mutations.length,1,'One atomic enrollment; no fabricated validation or CI event');
});
test('same-head review, hold or policy change during native enrollment never releases required gates',async()=>{
  for(const change of [f=>f.s.reviews.push(review({id:8,body:'Changes requested'})),f=>f.s.pr.labels.push({name:'merge-hold'}),f=>{f.policyCurrent=false;}]){
    const f=fixture();f.policyCurrent=true;f.args.validatePolicySource=async()=>f.policyCurrent;f.enrollment(()=>change(f));
    assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.s.auto.mergeMethod,'MERGE');
    for(const context of [gate.REVIEW,gate.CI,gate.LEGACY])assert.equal(f.statuses.findLast(s=>s.contextName===context).state,'failure');
    assert.ok(!f.statuses.some(s=>[gate.CI,gate.LEGACY].includes(s.contextName)&&s.state==='success'));
  }
});



test('read-only repository projection admits ordinary CI only after the existing native MERGE handoff',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const method of [null,'SQUASH','MERGE']){
    const f=fixture();delete f.repository.allow_auto_merge;delete f.repository.allow_merge_commit;
    f.s.pr.labels=[{name:'ci-ready'}];f.s.auto=method?{mergeMethod:method}:null;
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
    const result=await authorize({...f.args,workflowPath:profile.workflows[0].path});assert.equal(result.run,method==='MERGE');
    if(method!=='MERGE')assert.equal(result.reason,'Native exact-head enrollment must precede CI authorization');
    assert.equal(gate.candidateEligibility(f.s.pr,f.repository).ok,true);
    assert.equal(gate.candidate(f.s.pr,f.repository).ok,false,'Native enrollment still requires settings metadata');
    assert.equal(Object.hasOwn(f.repository,'allow_auto_merge'),false);
    assert.equal(Object.hasOwn(f.repository,'allow_merge_commit'),false);
    assert.equal(f.mutations.length,0,'Admission neither invents settings nor enrolls a merge');
  }
});
test('native candidate and enrollment still reject missing or explicitly false merge settings',async()=>{
  for(const name of ['allow_auto_merge','allow_merge_commit'])for(const value of [undefined,false]){
    const f=fixture();if(value===undefined)delete f.repository[name];else f.repository[name]=value;
    assert.equal(gate.candidateEligibility(f.s.pr,f.repository).ok,true);
    assert.deepEqual(gate.candidate(f.s.pr,f.repository),{ok:false,reason:'Native auto-merge or merge commits unavailable'});
    assert.equal((await gate.reconcile(f.args)).state,'BLOCKED');assert.equal(f.mutations.length,0);
  }
});
test('read-only protected source CI still requires a correct policy-bound prospective grant',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const variant of ['valid','missing','wrong-head','wrong-review','stale-policy','wrong-files']){
    const f=fixture();delete f.repository.allow_auto_merge;delete f.repository.allow_merge_commit;
    f.s.files[0].filename='.github/workflows/dependency.yml';f.s.pr.labels=[{name:'ci-ready'}];
    f.s.auto={mergeMethod:'MERGE'}; // A manual native request alone cannot grant protected execution.
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    if(variant!=='missing'){
      let grant=grantReview(f);
      if(variant==='wrong-head')grant={...grant,commit_id:'e'.repeat(40)};
      if(variant==='wrong-review')grant.body=grant.body.replace('"reviewId":7','"reviewId":6');
      if(variant==='stale-policy')grant.body=grant.body.replace(gate.policyDigest(),'0'.repeat(64));
      if(variant==='wrong-files')grant.body=grant.body.replace(gate.filesDigest(f.s.files),'0'.repeat(64));
      f.s.reviews.push(grant);
    }
    const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
    assert.equal((await authorize({...f.args,workflowPath:profile.workflows[0].path})).run,variant==='valid',variant);
    assert.equal(f.mutations.length,0);
  }
});
test('read-only source admission preserves identity, readiness and authorization denials with specific reasons',async()=>{
  const {authorize}=require('./admission.cjs');
  const cases=[
    [f=>f.repository.archived=true,'Repository archived, disabled or metadata missing'],
    [f=>delete f.repository.archived,'Repository archived, disabled or metadata missing'],
    [f=>f.repository.disabled=true,'Repository archived, disabled or metadata missing'],
    [f=>f.repository.full_name='untrusted/repository','Repository outside integration allowlist'],
    [f=>f.s.pr.draft=true,'PR closed or draft'],
    [f=>f.s.pr.state='closed','PR closed or draft'],
    [f=>f.s.pr.labels.push({name:'merge-hold'}),'Integration hold'],
    [f=>f.s.pr.mergeable=false,'Merge conflicts'],
    [f=>f.s.pr.mergeable=null,'Mergeability not yet established'],
    [f=>f.s.pr.head.repo.full_name='other/fork','Unsupported base or fork'],
    [f=>f.s.reviews=[],'Missing current completed trusted review'],
    [f=>f.s.pr.labels=[],'Connected actor CI handoff required'],
    [f=>f.rules.splice(0),'Dual trusted enforcement not installed'],
    [f=>f.s.threads=[{isResolved:false}],'Incomplete or changed candidate, shared head or blocking review'],
    [f=>f.s.shared=2,'Incomplete or changed candidate, shared head or blocking review'],
  ];
  for(const [change,reason] of cases){
    const f=fixture();delete f.repository.allow_auto_merge;delete f.repository.allow_merge_commit;
    f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};change(f);
    const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
    assert.deepEqual(await authorize({...f.args,workflowPath:profile.workflows[0].path,wait:async()=>{}}),{run:false,reason});assert.equal(f.mutations.length,0);
  }
});
test('source admission rechecks the fresh read-only repository projection before execution',async()=>{
  const {authorize}=require('./admission.cjs'),f=fixture();
  delete f.repository.allow_auto_merge;delete f.repository.allow_merge_commit;
  f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
  f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
  let reads=0;f.args.github.rest.repos.get=async()=>({data:{...clone(f.repository),archived:++reads>1}});
  assert.deepEqual(await authorize({...f.args,workflowPath:profile.workflows[0].path}),{run:false,reason:'Repository archived, disabled or metadata missing'});
  assert.equal(reads,2);assert.equal(f.mutations.length,0);
});


test('unknown initial mergeability gets one bounded read without weakening the read-only handoff',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const initial of [null,undefined]){
    const f=fixture();delete f.repository.allow_auto_merge;delete f.repository.allow_merge_commit;
    f.s.pr.mergeable=initial;f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    const pages=f.args.github.paginate;f.args.github.paginate=async endpoint=>endpoint==='runs'?[]:pages(endpoint);
    let clock=0,waits=0;const reads=[];f.args.github.rest.pulls.get=async options=>{reads.push(options);return {data:clone(f.s.pr)};};
    const result=await authorize({...f.args,workflowPath:profile.workflows[0].path,now:()=>clock,wait:async ms=>{waits++;clock+=ms;f.s.pr.mergeable=true;}});
    assert.equal(result.run,true);assert.equal(waits,1);
    const retried=reads.filter(r=>r.request);assert.equal(retried.length,1);
    assert.ok(retried[0].request.signal instanceof AbortSignal);assert.equal(retried[0].request.signal.aborted,false);assert.equal(retried[0].request.retries,0);
    assert.equal(f.mutations.length,0);
  }
});
test('mergeability refresh aborts on head or base drift and never retries a known conflict',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const change of [f=>f.s.pr.head.sha='e'.repeat(40),f=>f.s.pr.base.sha='e'.repeat(40),f=>f.s.pr.base.ref='other']){
    const f=fixture();f.s.pr.mergeable=null;f.s.pr.labels=[{name:'ci-ready'}];f.s.auto={mergeMethod:'MERGE'};
    f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    let waits=0;
    const result=await authorize({...f.args,workflowPath:profile.workflows[0].path,wait:async()=>{waits++;change(f);f.s.pr.mergeable=true;}});
    assert.deepEqual(result,{run:false,reason:'Candidate head or target changed during mergeability verification'});
    assert.equal(waits,1);assert.ok(!f.reads.includes('files'));assert.equal(f.mutations.length,0);
  }
  const f=fixture();f.s.pr.mergeable=false;f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
  let waits=0;assert.deepEqual(await authorize({...f.args,workflowPath:profile.workflows[0].path,wait:async()=>{waits++;}}),{run:false,reason:'Merge conflicts'});assert.equal(waits,0);
});
test('persistent unknown, refresh timeout and read failure remain explicit admission denials',async()=>{
  const {authorize}=require('./admission.cjs');
  for(const variant of ['unknown','deadline','read-error','transport-timeout']){
    const f=fixture();f.s.pr.mergeable=null;f.args.context.eventName='pull_request';f.args.context.payload={pull_request:clone(f.s.pr)};
    let clock=0,waits=0,reads=0,signal;f.args.github.rest.pulls.get=async options=>{
      reads++;
      if(reads===2 && variant==='read-error')throw Error('synthetic read failure');
      if(reads===2 && variant==='transport-timeout'){
        signal=options.request?.signal;
        return await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Expected transport abort')),30);
          signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
        });
      }
      return {data:clone(f.s.pr)};
    };
    const result=await authorize({...f.args,workflowPath:profile.workflows[0].path,now:()=>clock,wait:async ms=>{waits++;clock+=variant==='deadline'?1001:variant==='transport-timeout'?999:ms;}});
    assert.deepEqual(result,{run:false,reason:variant==='unknown'?'Mergeability not yet established':['deadline','transport-timeout'].includes(variant)?'Mergeability verification deadline expired':'Mergeability verification read failed'});
    if(variant==='transport-timeout'){assert.ok(signal instanceof AbortSignal);assert.equal(signal.aborted,true);}
    assert.equal(waits,1);assert.equal(reads,variant==='deadline'?1:2);assert.ok(!f.reads.includes('files'));assert.equal(f.mutations.length,0);
  }
});

// Real API-shaped history: every response is bound to the requested owning run.
function draftEnvelopeHistory({conclusion='skipped',prior=true}={}) {
 const f=fixture(),original=f.runs||[f.run],originalGraphs=Array.isArray(f.jobs[0])?f.jobs:[f.jobs];
 const deferred=original.map(run=>({...clone(run),id:run.id+1000,check_suite_id:run.check_suite_id+1000,conclusion}));
 const runs=[...deferred,...(prior?original:[])],graphs=new Map(original.map((run,i)=>[run.id,originalGraphs[i]]));
 for(const [i,run] of deferred.entries()){
  const names=[profile.workflows[i].admissionJob||profile.admissionJob||'Classify offline scope',...profile.workflows[i].aggregates];
  graphs.set(run.id,names.map((name,j)=>({id:11000+i*100+j,name,run_id:run.id,run_attempt:run.run_attempt,head_sha:f.s.pr.head.sha,
    status:'completed',conclusion:'skipped',steps:[],check_run_url:`https://api.github.com/repos/${profile.repository}/check-runs/${11000+i*100+j}`})));
 }
 const pages=f.args.github.paginate;
 f.args.github.paginate=async(endpoint,...args)=>{
  const options=args[0]||{};
  if(endpoint==='runs')return clone(runs.filter(run=>run.path.split('/').at(-1)===options.workflow_id));
  if(endpoint==='jobs')return clone(graphs.get(options.run_id));
  return pages(endpoint,...args);
 };
 f.args.github.rest.actions.getWorkflowRun=async({run_id})=>({data:clone(runs.find(run=>run.id===run_id))});
 return {...f,historyRuns:runs,deferredRuns:deferred,historyGraphs:graphs,originalRuns:original};
}
test('overall-skipped and successful wholly skipped owning envelopes alone are missing validation',async()=>{
 for(const conclusion of ['skipped','success']){
  const f=draftEnvelopeHistory({conclusion,prior:false});
  for(const workflow of profile.workflows){const result=await adapter.workflowCI(f.args.github,f.s,workflow);assert.equal(result.state,'pending');assert.equal(result.missing,true);assert.equal(result.runIds,undefined);}
  assert.equal(f.mutations.length,0);
 }
});
test('skipped owning history reuses only earlier real exact-head evidence from the required provider',async()=>{
 for(const conclusion of ['skipped','success'])for(const trustedProvider of [false,true]){
  const f=draftEnvelopeHistory({conclusion});
  if(!trustedProvider){f.checks[0].app.id=999;await assert.rejects(gate.reconcile(f.args),/identity|provider/);assert.equal(f.mutations.length,0);}
  else {
   for(const workflow of profile.workflows){const result=await adapter.workflowCI(f.args.github,f.s,workflow);assert.equal(result.state,'success');assert.ok(result.runIds.every(id=>f.originalRuns.some(run=>run.id===id)));}
   assert.equal((await gate.reconcile(f.args)).state,'AUTO_MERGE_ARMED');assert.equal(f.mutations.length,1);
  }
 }
});
test('deferred readiness can traverse owning draft history without inventing CI or losing earlier proof',async()=>{
 for(const prior of [false,true]){
  const f=draftEnvelopeHistory({prior}),draft=f.deferredRuns[0],ready={...clone(draft),id:draft.id+1000,conclusion:'success'};
  f.historyRuns.unshift(ready);
  f.historyGraphs.set(ready.id,f.historyGraphs.get(draft.id).map((job,i)=>({...clone(job),id:job.id+1000,run_id:ready.id,
    ...(i===0?{conclusion:'success',steps:[{name:'Review-authorized CI admission',conclusion:'success'}]}:{})})));
  const result=await adapter.workflowCI(f.args.github,f.s,profile.workflows[0]);assert.equal(result.state,prior?'success':'pending');
  if(!prior)assert.equal(result.missing,true);
 }
});
test('failed cancelled timed-out or active owning history cannot fall back to older validation',async()=>{
 for(const conclusion of ['failure','cancelled','timed_out','action_required',null]){
  const f=draftEnvelopeHistory({conclusion});assert.equal((await adapter.workflowCI(f.args.github,f.s,profile.workflows[0])).state,'failure');
 }
 for(const conclusion of ['failure','cancelled','timed_out']){
  const f=draftEnvelopeHistory();f.originalRuns[0].conclusion=conclusion;
  assert.equal((await adapter.workflowCI(f.args.github,f.s,profile.workflows[0])).state,'failure');
 }
 const f=draftEnvelopeHistory();f.originalRuns[0].status='in_progress';f.originalRuns[0].conclusion=null;
 const result=await adapter.workflowCI(f.args.github,f.s,profile.workflows[0]);assert.equal(result.state,'pending');assert.equal(result.missing,false);
});
test('invalid duplicate or incomplete owning skipped graphs remain failures',async()=>{
 for(const change of [jobs=>jobs[0].run_id=1,jobs=>jobs[0].run_attempt++,jobs=>jobs[0].head_sha='e'.repeat(40),
  jobs=>jobs[0].id=null,jobs=>jobs[0].name='',jobs=>jobs[0].check_run_url='https://api.github.com/repos/other/repo/check-runs/1',
  jobs=>delete jobs[0].check_run_url,jobs=>jobs[1].id=jobs[0].id,jobs=>jobs[1].name=jobs[0].name,
  jobs=>jobs[1].check_run_url=jobs[0].check_run_url,jobs=>jobs.splice(1,1),jobs=>jobs.splice(0)]){
  const f=draftEnvelopeHistory();change(f.historyGraphs.get(f.deferredRuns[0].id));
  assert.equal((await adapter.workflowCI(f.args.github,f.s,profile.workflows[0])).state,'failure');
 }
});
test('overall-skipped owning graphs with executed or unfinished jobs are never deferred evidence',async()=>{
 for(const change of [jobs=>jobs[0].conclusion='success',jobs=>jobs[0].conclusion='failure',jobs=>jobs[0].conclusion=null,jobs=>jobs[0].status='in_progress']){
  const f=draftEnvelopeHistory();change(f.historyGraphs.get(f.deferredRuns[0].id));assert.equal((await adapter.workflowCI(f.args.github,f.s,profile.workflows[0])).state,'failure');
 }
});
test('owning draft freshness catches reruns newer work and changed terminal state before history reuse',async()=>{
 for(const variant of ['attempt','newer-run','conclusion']){
  const f=draftEnvelopeHistory(),draft=f.deferredRuns[0],get=f.args.github.rest.actions.getWorkflowRun;let reads=0;
  f.args.github.rest.actions.getWorkflowRun=async options=>{
   const value=await get(options);
   if(options.run_id===draft.id&&++reads===1){
    if(variant==='newer-run')f.historyRuns.unshift({...clone(draft),id:draft.id+1000,status:'in_progress',conclusion:null});
    else if(variant==='attempt'){draft.run_attempt++;draft.status='in_progress';draft.conclusion=null;}
    else draft.conclusion='failure';
   }
   return value;
  };
  const result=await adapter.workflowCI(f.args.github,f.s,profile.workflows[0]);assert.equal(result.state,'pending');assert.equal(result.missing,false);assert.equal(result.runIds,undefined);
 }
});
test('owning skipped history never relaxes exact workflow repository head and attempt provenance',async()=>{
 for(const change of [run=>run.path='other.yml',run=>run.repository.full_name='other/repo',run=>run.head_sha='e'.repeat(40),run=>run.run_attempt=0]){
  const f=draftEnvelopeHistory(),get=f.args.github.rest.actions.getWorkflowRun;
  f.args.github.rest.actions.getWorkflowRun=async options=>{const value=await get(options);if(options.run_id===f.deferredRuns[0].id)change(value.data);return value;};
  await assert.rejects(adapter.workflowCI(f.args.github,f.s,profile.workflows[0]),/provenance/);
 }
});
