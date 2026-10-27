'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const result=require('./fast-result.cjs');
const repo='antoniodowling/file-validation-wizard';
test('inactive mode and incomplete or untrusted candidates never succeed',async()=>{
  const s={pr:{state:'open',draft:false,base:{ref:'main',repo:{full_name:repo}},head:{repo:{full_name:repo}},changed_files:1},shared:1,files:[{filename:'src/main.ts'}]};
  assert.equal((await result.assess({s,mode:'off'})).state,'pending');
  for(const changes of [{shared:2},{files:[]},{pr:{...s.pr,draft:true}},{pr:{...s.pr,head:{repo:{full_name:'foreign/repo'}}}}])
    assert.equal((await result.assess({s:{...s,...changes},mode:'lean'})).state,'failure');
});
test('CI control changes cannot publish success without independent authorization',async()=>{
  const s={pr:{state:'open',draft:false,base:{ref:'main',repo:{full_name:repo}},head:{repo:{full_name:repo}},changed_files:1},shared:1,files:[{filename:'ci/fast-ci.py'}],reviews:[]};
  assert.equal((await result.assess({s,mode:'lean'})).state,'failure');
});
