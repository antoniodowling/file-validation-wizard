"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../.github/workflows/validate.yml'),'utf8');
const blocks=Object.fromEntries([...source.slice(source.indexOf('\njobs:\n')).matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|$(?![\s\S]))/gm)].map(m=>[m[1],m[2]]));
function context(event='pull_request',draft=false,number=7,scope='full') {
 return {github:{workflow:'Offline source checks',event_name:event,ref:event==='pull_request'?`refs/pull/${number}/merge`:'refs/heads/main',event:event==='pull_request'?{pull_request:{draft,number}}:{pull_request:{}}},
  vars:{REVIEW_AUTOMATION_ACTIVE:'true'},needs:{plan:{result:'success',outputs:{scope,admitted:'true'}},result:{result:'success'}},always:()=>true,toJSON:x=>JSON.stringify(x)};
}
function expression(value,ctx){return vm.runInNewContext(value.replace(/^\s*\$\{\{\s*|\s*\}\}\s*$/g,''),ctx,{timeout:1000});}
function admitted(job,ctx){const line=blocks[job].match(/^    if: (.+)$/m);assert.ok(line,`Explicit admission missing for ${job}`);return expression(line[1],ctx);}
function render(value,ctx){return value.replace(/\$\{\{\s*(.*?)\s*\}\}/g,(_,expr)=>String(expression(expr,ctx)));}

test('every source job defers draft PRs and unknown draft metadata before runner allocation',()=>{
 assert.deepEqual(Object.keys(blocks),['plan','checks','validate']);
 for(const draft of [true,undefined])for(const job of Object.keys(blocks)){
  const c=context();c.github.event.pull_request.draft=draft;assert.equal(admitted(job,c),false,job);
 }
});
test('ready admission ignores the legacy activation variable, reviews and labels',()=>{
 for(const flag of ['true','false',undefined])for(const job of Object.keys(blocks)){
  const c=context();c.vars.REVIEW_AUTOMATION_ACTIVE=flag;assert.equal(admitted(job,c),true,job);
 }
 assert.ok(!source.includes('authorize-review')&&!source.includes('review-policy/gate.cjs'));
});
test('only readiness and candidate events trigger source PR runs',()=>{
 const events=source.match(/  pull_request:\n    types: \[([^\]]+)\]/)[1].split(',').map(x=>x.trim());
 assert.deepEqual(events,['opened','synchronize','reopened','ready_for_review','converted_to_draft','labeled']);
 assert.ok(!/^  pull_request_review(?:_comment)?:/m.test(source));
});
test('docs retain classification and independent results without substantive lanes',()=>{
 const c=context('pull_request',false,7,'docs');
 for(const job of ['plan','validate'])assert.equal(admitted(job,c),true,job);
 for(const job of ['checks'])assert.equal(admitted(job,c),false,job);
});
test('result still executes for ready candidates after failed dependencies',()=>{
 const c=context();c.needs.plan.result='failure';c.needs.result.result='failure';
 for(const job of ['validate'])assert.equal(admitted(job,c),true,job);

});
test('main push and explicit manual runs are admitted without a PR payload',()=>{
 for(const event of ['push','workflow_dispatch'])for(const job of Object.keys(blocks))assert.equal(admitted(job,context(event)),true,`${event} ${job}`);
});
test('supersession and conversion cancel only the same PR concurrency group',()=>{
 const concurrency=source.split('concurrency:\n')[1].split('\nenv:')[0];
 const group=concurrency.match(/^  group: (.+)$/m)[1];const cancel=concurrency.match(/^  cancel-in-progress: (.+)$/m)[1];
 const ready=context();const update=context();update.github.event.pull_request.head={sha:'new-head'};
 const draft=context('pull_request',true);draft.github.event.action='converted_to_draft';
 assert.equal(render(group,ready),render(group,update));assert.equal(render(group,ready),render(group,draft));
 const contexts=[ready,context('pull_request',false,8),context('push'),context('workflow_dispatch')];
 assert.equal(new Set(contexts.map(c=>render(group,c))).size,4);
 assert.equal(expression(cancel,ready),false);assert.equal(expression(cancel,draft),true);
 update.github.event.action='synchronize';assert.equal(expression(cancel,update),true);
 for(const c of contexts.slice(2))assert.equal(expression(cancel,c),false);
});

test('active review admission defers source and aggregate when authorization is withheld',()=>{
 const c=context();c.vars.REVIEW_INTEGRATION_MODE='enforce';c.needs.plan.outputs.admitted='false';
 for(const job of ['checks','validate'])assert.equal(admitted(job,c),false,job);
 c.needs.plan.outputs.admitted='true';for(const job of ['checks','validate'])assert.equal(admitted(job,c),true,job);
 const step=source.indexOf('name: Review-authorized CI admission');
 assert.ok(step>0&&step<source.indexOf('path: candidate'));
 assert.ok(source.includes('ref: refs/heads/main'));
});
test('label notifications use cheap planning without cancellation of substantive execution',()=>{
 const c=context();c.github.event.action='labeled';c.github.event.label={name:'unrelated'};
 assert.equal(admitted('plan',c),true);c.needs.plan.outputs.admitted='false';assert.equal(admitted('validate',c),false);
 const concurrency=source.split('concurrency:\n')[1].split('\nenv:')[0];
 const cancel=concurrency.match(/^  cancel-in-progress: (.+)$/m)[1];
 assert.equal(expression(cancel,c),false);
});
test('active handoff is serialized behind lifecycle admission; inactive notifications cannot replace source work',()=>{
 const concurrency=source.split('concurrency:\n')[1].split('\nenv:')[0];
 const group=concurrency.match(/^  group: (.+)$/m)[1];
 const lifecycle=context(),label=context();label.github.event.action='labeled';label.github.event.label={name:'ci-ready'};
 lifecycle.vars.REVIEW_INTEGRATION_MODE='enforce';label.vars.REVIEW_INTEGRATION_MODE='enforce';
 assert.equal(render(group,lifecycle),render(group,label));
 lifecycle.vars.REVIEW_INTEGRATION_MODE='shadow';label.vars.REVIEW_INTEGRATION_MODE='shadow';
 assert.notEqual(render(group,lifecycle),render(group,label));
});
