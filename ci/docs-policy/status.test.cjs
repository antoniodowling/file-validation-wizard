"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const {postStatus}=require('./status.cjs');
const {REPO}=require('./controller.cjs');
const args={repo:REPO,sha:'a'.repeat(40),contextName:'docs-merge-policy',state:'success',description:'Verified',targetUrl:'https://example.invalid/run',statusToken:'synthetic-app-token'};
test('dedicated App publisher binds destination, refuses redirects and accepts only created status',async()=>{
 let seen;
 await postStatus({...args,fetchImpl:async(url,options)=>{seen={url,options};return {status:201};}});
 assert.equal(seen.url,`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/statuses/${args.sha}`);
 assert.equal(seen.options.redirect,'error');
 assert.equal(seen.options.headers.authorization,'Bearer synthetic-app-token');
 assert.deepEqual(JSON.parse(seen.options.body),{context:args.contextName,state:args.state,description:args.description,target_url:args.targetUrl});
 for(const status of [200,202,301,401,403,500])await assert.rejects(postStatus({...args,fetchImpl:async()=>({status})}),/publication failed/);
});
test('missing App authentication and invalid destinations fail before transport',async()=>{
 for(const override of [{statusToken:''},{repo:{owner:'other',repo:'repo'}},{sha:'bad'},{sha:'a'.repeat(40)+'\n'}])
  await assert.rejects(postStatus({...args,...override,fetchImpl:()=>{throw Error('Transport must not run');}}),/required|destination/);
});
