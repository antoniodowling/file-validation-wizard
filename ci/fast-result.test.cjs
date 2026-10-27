'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const result=require('./fast-result.cjs');
const adapter=require('./docs-policy/controller.cjs');
const repo='antoniodowling/file-validation-wizard', head='a'.repeat(40), base='b'.repeat(40);
function snapshot(filename='src/main.ts') {
  return {pr:{state:'open',draft:false,user:{login:'antoniodowling',id:26848379},labels:[],
    base:{ref:'main',sha:base,repo:{full_name:repo}},head:{sha:head,repo:{full_name:repo}},changed_files:1},
    shared:1,files:[{filename}],reviews:[],threads:[]};
}
test('inactive mode and incomplete or untrusted candidates never succeed',async()=>{
  const s=snapshot();
  assert.equal((await result.assess({s,mode:'off'})).state,'pending');
  for(const changes of [{shared:2},{files:[]},{pr:{...s.pr,draft:true}},{pr:{...s.pr,head:{repo:{full_name:'foreign/repo'}}}}])
    assert.equal((await result.assess({s:{...s,...changes},mode:'lean'})).state,'failure');
});
test('current owner review, holds and objections are enforced',async()=>{
  const s=snapshot();
  assert.match((await result.assess({s,mode:'lean'})).description,/owner review/);
  for(const changed of [{pr:{...s.pr,labels:[{name:'merge-hold'}]}},
    {reviews:[{id:9,user:{id:1},state:'CHANGES_REQUESTED'}]}])
    assert.match((await result.assess({s:{...s,...changed},mode:'lean'})).description,/hold/);
});
test('CI control changes cannot publish success without independent authorization',async()=>{
  const s=snapshot('ci/fast-ci.py');
  s.reviews=[{id:7,user:{id:26848379,login:'antoniodowling'},state:'COMMENTED',commit_id:head,
    submitted_at:'2026-10-27T00:00:00Z',body:`LGTM\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->`}];
  assert.equal((await result.assess({s,mode:'lean'})).state,'failure');
});
test('success describes the owner review that was actually required',async()=>{
  const s=snapshot();
  s.reviews=[{id:7,user:{id:26848379,login:'antoniodowling'},state:'COMMENTED',commit_id:head,
    submitted_at:'2026-10-27T00:00:00Z',body:`LGTM\n<!-- chatgpt-hourly-pr-review:v1 head=${head} -->`}];
  const original=adapter.workflowCI;
  try {
    adapter.workflowCI=async()=>({state:'success',description:'Current code CI passed; no review requirement'});
    assert.equal((await result.assess({s,mode:'lean'})).description,'Current-head validation and owner review passed');
  } finally { adapter.workflowCI=original; }
});
