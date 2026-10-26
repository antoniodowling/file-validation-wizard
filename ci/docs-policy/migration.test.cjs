"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {prepare,assertUnchanged}=require('./migration.cjs');
const current={id:1,source:'antoniodowling/file-validation-wizard',name:'baseline',target:'branch',enforcement:'active',
  conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},bypass_actors:[],rules:[
    {type:'deletion'},{type:'non_fast_forward'},{type:'pull_request',parameters:{required_review_thread_resolution:true}},
    {type:'required_status_checks',parameters:{strict_required_status_checks_policy:false,required_status_checks:[
      {context:'validate',integration_id:15368},{context:'docs-merge-policy',integration_id:5363850}]}}]};
const proof={repository:current.source,appId:5363850,installedSourceSha:'a'.repeat(40),independentBootstrapApproved:true,
  positiveAndNegativeAccepted:true,contexts:['review-gate','ci-required'],evidenceUrls:['https://github.com/'+current.source+'/actions/runs/1']};
test('migration adds trusted producers without removing old CI, guard or native protections',()=>{
  const p=prepare(current,proof),checks=p.payload.rules.at(-1).parameters.required_status_checks;
  assert.deepEqual(p.payload.rules.slice(0,3),current.rules.slice(0,3));
  assert.deepEqual(checks.slice(0,2),current.rules.at(-1).parameters.required_status_checks);
  assert.deepEqual(checks.slice(2),[{context:'review-gate',integration_id:5363850},{context:'ci-required',integration_id:5363850}]);
  assert.equal(p.payload.rules.at(-1).parameters.strict_required_status_checks_policy,false);assert.deepEqual(p.payload.bypass_actors,[]);
  assertUnchanged(p,current);assert.throws(()=>assertUnchanged(p,{...current,name:'drift'}),/drift/);
});
test('missing producer, wrong App, absent bootstrap or absent negative proof cannot produce a migration',()=>{
  for(const change of [{contexts:['review-gate']},{appId:15368},{independentBootstrapApproved:false},
    {positiveAndNegativeAccepted:false},{installedSourceSha:null},{evidenceUrls:[]}])assert.throws(()=>prepare(current,{...proof,...change}),/evidence/);
});
test('repeat plan has no duplicate requirements and refuses wrong-App name collisions',()=>{
  const p=prepare(current,proof),r={...current,...p.payload};
  assert.equal(prepare(r,proof).payload.rules.at(-1).parameters.required_status_checks.length,4);
  r.rules.at(-1).parameters.required_status_checks.at(-1).integration_id=15368;
  assert.throws(()=>prepare(r,proof),/publisher/);
});
