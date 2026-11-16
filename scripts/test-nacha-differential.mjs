import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createGarrettRunner, compareVerdicts, observedSecCodes, discoverNachaFiles,
  runBatch, parseArguments, renderMarkdown, createWizardRunner,
} from './nacha-differential.mjs';

const fakeHtml = `<!doctype html><script>
function parse(text) { return text.split('\\n').map((raw, i) => ({raw, lineNo:i+1})); }
function validate(records) {
  const issues = records.flatMap((r) => r.raw.includes('BAD') ? [{lineNo:r.lineNo, field:'Record Length', sev:'error', msg:r.raw}] : []);
  return { issues, stats:{errors:issues.length, warnings:0} };
}
/* ============================ rendering =============================== */
document.querySelector('this_should_not_run');
</script>`;

const fakeWizard = (onRun) => async () => ({
  run(name, source) { onRun?.(name, source); return {
    status: source.includes('UNSUPPORTED') ? 'UNSUPPORTED' : source.includes('BAD') ? 'FAIL' : 'PASS',
    errors: source.includes('BAD') ? 1 : 0, warnings: 0, notEvaluated: source.includes('UNSUPPORTED') ? 50 : 0,
    profileId: 'nacha-origination-expanded-public-2026-r2', rulesetRevision: 'r2.2',
    groups: source.includes('BAD') ? [{severity:'ERROR', field:'Record framing', theme:'Record structure', ruleId:'nacha.framing', location:'Record 1 / Columns 1-94'}] : [],
  }; }, close() {},
});

const fixture = async (fn) => {
  const root = await mkdtemp(join(tmpdir(), 'nacha-diff-'));
  try { return await fn(root); } finally { await rm(root, { recursive:true, force:true }); }
};

test('Garrett isolated runner uses the supplied parser and validator, not the HTML UI', () => {
  const run = createGarrettRunner(fakeHtml);
  assert.equal(run('GOOD').status,'PASS');
  assert.equal(run('BAD\nBAD').errors,2);
  assert.deepEqual(run('BAD\nBAD').groups.map(x => [x.field,x.count,x.line]), [['Record Length',2,1]]);
  assert.equal(run('GOOD').errors,0); // no leaked state from earlier file
});

test('Garrett loading fails closed on missing parser and UI delimiter', () => {
  assert.throws(() => createGarrettRunner('<script>const a=1;</script>'),/expected parse/);
  assert.throws(() => createGarrettRunner('<script>function parse(text) {} function validate(records) {}</script>'),/isolate/);
});

test('classifications never confuse unsupported with pass or fail', () => {
  assert.equal(compareVerdicts({status:'PASS'}, {status:'UNSUPPORTED'}), 'WIZARD UNSUPPORTED');
  assert.equal(compareVerdicts({status:'PASS'}, {status:'INCOMPLETE'}), 'WIZARD INCOMPLETE');
  assert.equal(compareVerdicts({status:'PASS'}, {status:'PASS_WITH_WARNINGS'}), 'DIFFERENT VERDICT');
  assert.equal(compareVerdicts({status:'WARNINGS'}, {status:'PASS_WITH_WARNINGS'}), 'SAME VERDICT');
  assert.equal(compareVerdicts({status:'FAIL'}, {status:'FAIL'}), 'SAME VERDICT');
  assert.equal(compareVerdicts(null, {status:'FAIL'}), 'RUN ERROR');
  assert.equal(compareVerdicts({status:'PASS'}, {status:'FAIL'}, ['IAT']), 'SEC OUTSIDE R2');
  assert.equal(compareVerdicts({status:'FAIL'}, {status:'FAIL'}, ['CCD','ARC']), 'SEC OUTSIDE R2');
  assert.equal(compareVerdicts({status:'FAIL'}, {status:'FAIL'}, ['CCD']), 'SAME VERDICT');
});

test('SEC scanner handles line-delimited, CRLF and concatenated fixed-width records', () => {
  const a = '5'.padEnd(50,' ') + 'CCD' + ' '.repeat(41);
  const b = '5'.padEnd(50,' ') + 'IAT' + ' '.repeat(41);
  assert.equal(a.length,94);
  assert.deepEqual(observedSecCodes(`${a}\r\n${b}\r\n`), ['CCD','IAT']);
  assert.deepEqual(observedSecCodes(a+b), ['CCD','IAT']);
  assert.deepEqual(observedSecCodes('5SHORT'),[]);
});

test('file discovery is deterministic, recursive and ignores symlinks and unrelated extensions', async () => fixture(async root => {
  await mkdir(join(root,'nested'));
  await writeFile(join(root,'zzz.ach'),'Z');
  await writeFile(join(root,'nested','aaa.TXT'),'A');
  await writeFile(join(root,'nested','report.md'),'R');
  await symlink(join(root,'zzz.ach'),join(root,'linked.ach'));
  const all = await discoverNachaFiles(root);
  assert.deepEqual(all.map(x => x.slice(root.length+1)), ['nested/aaa.TXT','zzz.ach']);
  await assert.rejects(discoverNachaFiles(root,{maxFiles:1}),/More than 1/);
  assert.deepEqual((await discoverNachaFiles(root,{recursive:false})).map(x=>x.slice(root.length+1)),['zzz.ach']);
}));

test('batch runner writes a readable private Markdown report and optional machine JSON', async () => fixture(async root => {
  const inputs=join(root,'incoming'); await mkdir(inputs);
  await writeFile(join(inputs,'good.ach'),'GOOD 1234567890123456');
  await writeFile(join(inputs,'bad.ach'),'BAD ACCOUNT-SECRET-123456789');
  await writeFile(join(inputs,'unknown.ach'),'UNSUPPORTED');
  await writeFile(join(inputs,'invalid.ach'),Buffer.from([0xff,0xfe]));
  await writeFile(join(inputs,'skip.pdf'),'BAD');
  const garrett=join(root,'original.html'); await writeFile(garrett,fakeHtml);
  const md=join(root,'reports','summary.md');const json=join(root,'reports','summary.json');
  const calls=[];
  const result = await runBatch({input:inputs,garrett,report:md,json}, { wizardFactory:fakeWizard((n)=>calls.push(n)) });
  assert.equal(result.files.length,4);
  assert.deepEqual(result.files.map(f=>[f.file,f.comparison]), [
    ['bad.ach','SAME VERDICT'],['good.ach','SAME VERDICT'],
    ['invalid.ach','RUN ERROR'],['unknown.ach','WIZARD UNSUPPORTED'],
  ]);
  assert.equal(calls.length,3);
  const doc=await readFile(md,'utf8');
  const structured=JSON.parse(await readFile(json,'utf8'));
  assert.match(doc,/# NACHA differential validation report/);
  assert.match(doc,/\| WIZARD UNSUPPORTED \| 1 \|/);
  assert.match(doc,/## File results/);
  assert.match(doc,/### `bad\.ach`/);
  assert.doesNotMatch(doc,/ACCOUNT-SECRET|1234567890123456/);
  assert.doesNotMatch(JSON.stringify(structured),/ACCOUNT-SECRET|1234567890123456/);
  assert.equal(structured.files[2].errors[0],'File: invalid UTF-8 or unexpected input type');
}));

test('batch handles dozens of inputs and visibly flags observed SEC gaps', async () => fixture(async root => {
  const inputs = join(root, 'inputs'); await mkdir(inputs);
  const batchHeader = (sec) => '5'.padEnd(50, ' ') + sec + ' '.repeat(41);
  for (let i=0; i<60; i++) {
    const sec = i % 15 === 0 ? 'ARC' : 'CCD';
    await writeFile(join(inputs, `fixture-${String(i).padStart(3,'0')}.ach`), batchHeader(sec) + '\n');
  }
  const garrett = join(root, 'garrett.html'); await writeFile(garrett, fakeHtml);
  const md = join(root, 'results.md');
  const result = await runBatch({input:inputs, garrett, report:md}, {wizardFactory:fakeWizard()});
  assert.equal(result.files.length, 60);
  assert.equal(result.files.filter(f => f.comparison === 'SEC OUTSIDE R2').length, 4);
  const report = await readFile(md, 'utf8');
  assert.match(report, /\| SEC OUTSIDE R2 \| 4 \|/);
  assert.equal((report.match(/^### `fixture-/gm) ?? []).length, 60);
}));

test('same outcome can have different finding themes and report does not imply parity', () => {
  const txt = renderMarkdown({generatedAt:'2026-11-16T12:00:00.000Z', inputLabel:'fixtures',profile:'r2',legacySha256:'hash',files:[
    {file:'x|y.ach',bytes:99,sha256:'abcdef1234567890',secCodes:['CCD'],comparison:'SAME VERDICT',errors:[],
      legacy:{status:'FAIL',errors:1,warnings:0,groups:[{severity:'ERROR',field:'Check Digit',theme:'Routing',line:3,count:1}]},
      wizard:{status:'FAIL',errors:1,warnings:0,notEvaluated:0,groups:[{severity:'ERROR',theme:'Trace',field:'Trace number',ruleId:'nacha.trace',location:'Record 3'}]}}
  ]});
  assert.match(txt,/Garrett-only: Routing; Wizard-only: Trace/);
  assert.match(txt,/`x\\\|y\.ach`/);
  assert.match(txt,/does \*\*not\*\* establish complete validation parity/);
});

test('argument parsing rejects invalid limits and accepts positional input', () => {
  assert.deepEqual(parseArguments(['./fixtures','--garrett','./original.html','--no-recursive','--strict']),
    {input:'./fixtures',garrett:'./original.html',recursive:false,strict:true});
  assert.throws(()=>parseArguments(['--max-files','0']),/Invalid maxFiles/);
  assert.throws(()=>parseArguments(['--garrett']),/Missing value/);
  assert.throws(()=>parseArguments(['--unknown']),/Unknown argument/);
});

// In the checked-out repository this is an actual R2 validation, not a stub.
// It is skipped only when this stand-alone test file is being developed without repo deps/fixtures.
let hasRepoFixture = true;
try {
  await access(new URL('../demo-files/ach-candidates/origination-healthcare-pass.ach', import.meta.url));
} catch { hasRepoFixture = false; }
test('real Wizard R2 runtime loads through Vite SSR and validates a known passing fixture', { skip: !hasRepoFixture }, async () => {
  const runner = await createWizardRunner();
  try {
    const src = await readFile(new URL('../demo-files/ach-candidates/origination-healthcare-pass.ach', import.meta.url), 'utf8');
    const report = await runner.run('origination-healthcare-pass.ach', src);
    assert.equal(report.profileId, 'nacha-origination-expanded-public-2026-r2');
    assert.equal(report.status, 'PASS');
    assert.equal(report.errors, 0);
    assert.equal(report.rulesetRevision, 'nacha-origination-public-2026-r2.2');
  } finally { await runner.close(); }
});
