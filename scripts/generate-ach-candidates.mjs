// Deterministic synthetic fixtures and version-bound coverage; no customer data.
import { rolldown } from 'rolldown';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const scratch = await mkdtemp(join(tmpdir(), 'hnb-ach-candidate-fixtures-'));
try {
  const entry = join(scratch, 'entry.mjs');
  await writeFile(entry, [
    `export { buildReturns } from ${JSON.stringify(resolve('tests/nacha-returns-builder.ts'))};`,
    `export { buildNacha, field } from ${JSON.stringify(resolve('tests/nacha-builder.ts'))};`,
    `export { FORMAT_PACKS } from ${JSON.stringify(resolve('src/format-packs.ts'))};`,
    `export { validateSource } from ${JSON.stringify(resolve('src/validation.ts'))};`,
  ].join('\n'));
  const bundle = await rolldown({ input: entry });
  const output = join(scratch, 'fixtures.mjs');
  await bundle.write({ file: output, format: 'es' }); await bundle.close();
  const { buildReturns, buildNacha, field, FORMAT_PACKS, validateSource } = await import(pathToFileURL(output).href);
  const fixtures = [];
  const add = (name, profileId, source, expectedStatus, explanation) => fixtures.push({ name, profileId, source, expectedStatus, explanation });
  const ack = 'huntington-ack-pipe-1.0-candidate-r1';
  const returns = 'nacha-returns-network-public-2026-r1';
  const control = 'huntington-control-total-public-2026-r1';
  const orig = 'nacha-origination-expanded-public-2026-r2';
  const ackFile = [
    'HDR|ACK|1.0|FILE_RECEIVED_ACK|2026-10-14T12:00:00Z|UTC',
    'FIL|InboundFileName|SYNTHETIC.ach|CorrelationId|SYNTHETIC-ACK-1',
    'FIL|OriginalFileSizeBytes|950|Transport|SFTP|ChecksumAlgo|SHA256|Checksum|c7b8...9f',
    'STA|FILE|RECEIVED|AcceptedForParsing|ParserVersion|2.3.1',
    'CTL|DeclaredRecordCount|2500|ReceivedRecordCount|2500|DeclaredHash|12345678|ReceivedHash|12345678',
    'TRL|END|2026-10-14T12:00:01Z',
  ].join('\n');
  add('ack-received-pass.txt', ack, ackFile, 'PASS', 'File-only receipt; original count differs from ACK records without error.');
  add('ack-accepted-pass.txt', ack, ackFile.replace('RECEIVED|AcceptedForParsing','ACCEPTED|AcceptedForParsing'), 'PASS', 'Reported acceptance remains separate from document validity.');
  const rejected = ackFile.replace('RECEIVED|AcceptedForParsing','REJECTED|ChecksumMismatch').replace('CTL|','VAL|ERROR  |LINE|248|Field: Amount|Non-numeric original amount\nCTL|').replace('ReceivedRecordCount|2500','ReceivedRecordCount|2499').replace('ReceivedHash|12345678','ReceivedHash|99999999');
  add('ack-rejected-pass.txt', ack, rejected, 'PASS', 'Valid rejected ACK with original VAL ERROR and unequal original controls.');
  add('ack-batches-pass.txt', ack, ackFile.replace('CTL|', 'MSG|INFO|SYNTHETIC receipt\nBAT|1|BatchRef|SYNTHETIC-BATCH|RecordCount|2500\nSTA|BATCH|REJECTED|BatchValidationFailed\nVAL|WARNING|LINE|134|Field: PaymentDate|Adjusted by bank\nCTL|'), 'PASS', 'Optional batch rejection and original-file warning do not invalidate ACK syntax.');
  add('ack-crlf-comments-pass.txt', ack, '# SYNTHETIC ACK\r\n' + ackFile.replaceAll('\n','\r\n')+'\r\n# end\r\n', 'PASS', 'Source offsets retain CRLF and comment lines.');
  add('ack-html-qualifier-pass.txt', ack, ackFile.replace('AcceptedForParsing','<img src=SYNTHETIC onerror=alert(1)>'), 'PASS', 'Opaque qualifier must render as text, never HTML.');
  add('ack-formula-qualifier-pass.txt', ack, ackFile.replace('AcceptedForParsing','=SUM(1)'), 'PASS', 'CSV escapes a spreadsheet-formula qualifier.');
  for (const [name,source,reason] of [
    ['ack-bom-fail.txt','\uFEFF'+ackFile,'Candidate admits no BOM.'],
    ['ack-date-fail.txt',ackFile.replace('2026-10-14T12:00:00Z','2026-02-30T12:00:00Z'),'Impossible timestamp.'],
    ['ack-missing-trailer-fail.txt',ackFile.split('\n').slice(0,-1).join('\n'),'Incomplete envelope.'],
    ['ack-duplicate-identification-fail.txt',ackFile.replace('STA|FILE|','FIL|CorrelationId|SYNTHETIC-DUPLICATE\nSTA|FILE|'),'Duplicate FIL field.'],
    ['ack-control-type-fail.txt',ackFile.replace('ReceivedRecordCount|2500','ReceivedRecordCount|2A00'),'Malformed original-file count syntax.'],
  ]) add(name,ack,source,'FAIL',reason);
  add('ack-version-unsupported.txt',ack,ackFile.replace('ACK|1.0|','ACK|2.0|'),'UNSUPPORTED','Unselected dialect carries no verdict.');
  add('ack-status-unsupported.txt',ack,ackFile.replace('|RECEIVED|','|PENDING|'),'UNSUPPORTED','Unknown disposition vocabulary carries no verdict.');
  add('ack-delimiter-unsupported.txt',ack,ackFile.replaceAll('|',','),'UNSUPPORTED','No customized comma grammar assumed.');
  const totals = ' 010000003'+'SYNTHETIC BANK'.padEnd(16)+'000000000001'+'999999999999'+'20261014';
  add('totals-pass.txt',control,totals,'PASS','One standalone record, exact integer cents and transmission-date syntax.');
  add('totals-crlf-pass.txt',control,totals+'\r\n','PASS','Candidate terminal delimiter.');
  add('totals-zero-pass.txt',control,totals.slice(0,26)+'000000000000000000000000'+totals.slice(50),'PASS','Zero totals have valid amount syntax.');
  add('totals-date-fail.txt',control,totals.slice(0,50)+'20260229','FAIL','Invalid calendar date.');
  add('totals-company-fail.txt',control,totals.slice(0,10)+'Lowercase'.padEnd(16)+totals.slice(26),'FAIL','Published name uppercase requirement.');
  add('totals-amount-fail.txt',control,totals.slice(0,26)+'00000000A001'+totals.slice(38),'FAIL','Malformed integer cents.');
  add('totals-width-fail.txt',control,totals.slice(1),'FAIL','Invalid field boundary.');
  add('totals-multiple-unsupported.txt',control,totals+'\n'+totals,'UNSUPPORTED','Outside the single-record candidate.');
  for (const sec of ['CCD','PPD','CTX','WEB','TEL']) add(`returns-${sec.toLowerCase()}-pass.ach`,returns,buildReturns({sec}).join('\n'),'PASS','Ordinary network return; original references are not matched.');
  for (const transaction of ['21','26','31','36','51','56']) add(`returns-${transaction}-pass.ach`,returns,buildReturns({transaction}).join('\n'),'PASS','Explicit return-family directional reconciliation.');
  const corrected = { C01:'SYNTHETIC NEW', C02:'021000021', C03:'021000021   '+'SYNTHETIC NEW'.padEnd(17), C05:'22', C06:'SYNTHETIC NEW'.padEnd(17)+'   22', C07:'021000021'+'SYNTHETIC NEW'.padEnd(17)+'22 ', C09:'SYNTHETIC NEW ID', C13:'SYNTHETIC ADDENDA FORMAT' };
  for (const [reason,correction] of Object.entries(corrected)) add(`noc-${reason.toLowerCase()}-pass.ach`,returns,buildReturns({sec:'COR',reason,correction}).join('\n'),'PASS','Ordinary COR correction syntax, with no original-file comparison.');
  const mutateReturn = (index,from,to,value,rows=buildReturns()) => { rows[index]=field(rows[index],from,to,value); return rows.join('\n'); };
  add('returns-trace-fail.ach',returns,mutateReturn(3,80,94,'021000020000002'),'FAIL','Exception addenda trace differs from preceding detail.');
  add('returns-credit-total-fail.ach',returns,mutateReturn(4,33,44,'000000000001'),'FAIL','Batch control differs from exact entry totals.');
  add('returns-r01-credit-fail.ach',returns,buildReturns({transaction:'21',reason:'R01'}).join('\n'),'FAIL','Known debit-only reason in credit family.');
  add('returns-unknown-code-fail.ach',returns,buildReturns({reason:'R99'}).join('\n'),'FAIL','Unassigned reason is not accepted by a continuous range.');
  for(const reason of ['R69','R73']) add(`returns-${reason.toLowerCase()}-unsupported.ach`,returns,buildReturns({reason}).join('\n'),'UNSUPPORTED','Specialized layout still unqualified; no ordinary99 interpretation.');
  add('noc-refused-unsupported.ach',returns,buildReturns({sec:'COR',reason:'C61'}).join('\n'),'UNSUPPORTED','Refused COR layout not invented.');
  const healthcare = (payload, code='22', description='HCCLAIMPMT') => {
    const rows=buildNacha([{sec:'CCD',codes:[code],amounts:[code==='23'?0n:1n],addenda:[payload===null?0:1]}]);
    rows[1]=field(rows[1],54,63,description); if(payload!==null)rows[3]=field(rows[3],4,83,payload.padEnd(80)); return rows.join('\n');
  };
  add('origination-healthcare-pass.ach',orig,healthcare('TRN*1*SYNTHETIC*COMPANY~'),'PASS','Declared healthcare CCD with whole reassociation TRN.');
  add('origination-healthcare-prenote-pass.ach',orig,healthcare(null,'23'),'PASS','Healthcare prenote exemption.');
  add('origination-healthcare-missing-fail.ach',orig,healthcare(null),'FAIL','Declared live healthcare requires addenda.');
  add('origination-healthcare-trn-fail.ach',orig,healthcare('TRN*1**COMPANY~'),'FAIL','Missing reassociation trace element.');
  add('origination-healthcare-case-fail.ach',orig,healthcare('TRN*1*SYNTHETIC*COMPANY~','22','hcclaimpmt'),'FAIL','Standardized descriptor uses uppercase.');
  const payroll=buildNacha([{sec:'PPD',codes:['22'],amounts:[1n],addenda:[0]}]); payroll[1]=field(payroll[1],54,63,'PAYROLLEMP');
  add('origination-payroll-suffix-pass.ach',orig,payroll.join('\n'),'PASS','Discretionary uppercase suffix.');
  payroll[1]=field(payroll[1],54,63,'PAYROLLemp'); add('origination-payroll-case-fail.ach',orig,payroll.join('\n'),'FAIL','Alphabetic suffix also follows uppercase field rule.');
  add('origination-ctx-edifact-unsupported.ach',orig,await readFile('demo-files/nacha-expanded/ctx-edifact-unsupported.ach','utf8'),'UNSUPPORTED','Unqualified CTX payload remains explicit.');
  await mkdir('demo-files/ach-candidates',{recursive:true});
  const manifest=[];
  for(const fixture of fixtures){
    const pack=FORMAT_PACKS.find(pack=>pack.id===fixture.profileId); if(!pack)throw new Error('Missing profile');
    const run=validateSource(fixture.name,fixture.source,pack);
    if(run.overallStatus!==fixture.expectedStatus)throw new Error(`${fixture.name}: expected ${fixture.expectedStatus}, got ${run.overallStatus}: ${JSON.stringify(run.results.filter(r=>r.outcome!=='PASS'))}`);
    await writeFile(join('demo-files/ach-candidates',fixture.name),fixture.source);
    manifest.push({name:fixture.name,profileId:fixture.profileId,expectedStatus:fixture.expectedStatus,bytes:Buffer.byteLength(fixture.source),sha256:createHash('sha256').update(fixture.source).digest('hex'),explanation:fixture.explanation,expectedFindingIds:run.results.filter(r=>r.outcome!=='PASS').map(r=>r.ruleId),...(run.reportedDisposition?{reportedDisposition:run.reportedDisposition}: {})});
  }
  await writeFile('demo-files/ach-candidates/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  // Historical coverage is immutable; current reports have a separate snapshot.
  await import('./export-coverage.mjs');
  console.log(`Generated ${manifest.length} synthetic candidate fixtures and current coverage.`);
} finally { await rm(scratch,{recursive:true,force:true}); }
