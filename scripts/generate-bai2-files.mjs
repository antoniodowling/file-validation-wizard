import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../demo-files/bai2/', import.meta.url);
await mkdir(root, { recursive: true });
const profile = 'huntington-bai2-public-2026-r1';
const account = (id = '123456789', amount = 100n, details = true) => {
  const rows = [`03,${id},USD,010,${amount},0,,015,150,0,/`, '88,100,50,0,,400,10,0,/'];
  if (details) rows.push('16,206,50,,SYNTHETIC-CREDIT,,SYNTHETIC credit, with comma / slash/', '16,506,10,,SYNTHETIC-DEBIT,,SYNTHETIC debit/');
  const total = amount + 210n + (details ? 60n : 0n);
  rows.push(`49,${total},${rows.length + 1}/`);
  return { rows, total };
};
const group = (...accounts) => {
  const rows = ['02,,SYNTHETIC-ORIGIN,1,261013,,USD,2/', ...accounts.flatMap(a => a.rows)];
  const total = accounts.reduce((sum, a) => sum + a.total, 0n);
  rows.push(`98,${total},${accounts.length},${rows.length + 1}/`);
  return { rows, total };
};
const file = (...groups) => {
  const rows = ['01,SYNTHETIC-SENDER,SYNTHETIC-RECEIVER,261014,2400,1,,,2/', ...groups.flatMap(g => g.rows)];
  rows.push(`99,${groups.reduce((sum, g) => sum + g.total, 0n)},${groups.length},${rows.length + 1}/`);
  return rows.join('\n') + '\n';
};
const pass = file(group(account()));
const fixtures = [];
async function save(name, source, expected, rules = [], scenario = name) {
  await writeFile(new URL(name, root), source);
  fixtures.push({ file: name, sha256: createHash('sha256').update(source).digest('hex'), expected, rules, scenario,
    provenance: 'Synthetic fixture generated locally; no customer/bank acceptance data', profile });
}
await save('balances-pass.bai2', pass, 'PASS');
await save('multi-group-pass.bai2', file(group(account(), account('987654321', -25n, false)), group(account('333333333', 900719925474099312345n))), 'PASS');
await save('summary-only-pass.bai2', file(group(account('123456789', 100n, false))), 'PASS');
await save('crlf-pass.txt', pass.replaceAll('\n', '\r\n'), 'PASS');
await save('account-total-fail.bai2', pass.replace('49,370,5/', '49,371,5/'), 'FAIL', ['bai2.account-total', 'bai2.group-total']);
await save('account-count-fail.bai2', pass.replace('49,370,5/', '49,370,4/'), 'FAIL', ['bai2.account-count']);
await save('group-total-fail.bai2', pass.replace('98,370,1,7/', '98,371,1,7/'), 'FAIL', ['bai2.group-total', 'bai2.file-total']);
await save('group-count-fail.bai2', pass.replace('98,370,1,7/', '98,370,2,6/'), 'FAIL', ['bai2.group-accounts', 'bai2.group-count']);
await save('file-total-fail.bai2', pass.replace('99,370,1,9/', '99,371,1,9/'), 'FAIL', ['bai2.file-total']);
await save('file-count-fail.bai2', pass.replace('99,370,1,9/', '99,370,2,8/'), 'FAIL', ['bai2.file-groups', 'bai2.file-count']);
await save('date-fail.bai2', pass.replace('261014', '260230'), 'FAIL', ['bai2.file-header']);
await save('amount-fail.bai2', pass.replace('206,50,', '206,5.0,'), 'FAIL', ['bai2.amount']);
await save('hierarchy-fail.bai2', pass.replace('49,370,5/\n', ''), 'FAIL', ['bai2.hierarchy']);
await save('termination-fail.bai2', pass.replace('99,370,1,9/', '99,370,1,9'), 'FAIL', ['bai2.framing']);
await save('leading-zero-fail.bai2', pass.replace('123456789', '0123456789'), 'FAIL', ['bai2.account-id']);
await save('code-level-fail.bai2', pass.replace('16,206,', '16,100,'), 'FAIL', ['bai2.detail-code']);
await save('bom-fail.bai2', '\uFEFF' + pass, 'FAIL', ['bai2.characters']);
await save('funds-unsupported.bai2', pass.replace('206,50,,', '206,50,S,'), 'UNSUPPORTED');
await save('code-unsupported.bai2', pass.replace('16,206,', '16,999,'), 'UNSUPPORTED');
await save('currency-unsupported.bai2', pass.replaceAll('USD', 'EUR'), 'UNSUPPORTED');
await save('modifier-unsupported.bai2', pass.replace('USD,2/', 'USD,1/'), 'UNSUPPORTED');
// Preserve the exact supplied/public guide sample separately, never regenerate it as synthetic data.
const sample = await readFile(new URL('huntington-guide-sample.txt', root), 'utf8');
fixtures.push({ file: 'huntington-guide-sample.txt', sha256: createHash('sha256').update(sample).digest('hex'), expected: 'PASS', rules: [],
  scenario: 'Exact illustrative sample from supplied Huntington guide; 4 accounts, 27 physical records, total 245520532',
  provenance: 'Public guide example from owner-supplied 2026-09-17 source; illustrative, not independent bank conformance evidence', profile });
await writeFile(new URL('manifest.json', root), JSON.stringify({ revision: 'bai2-fixtures-1.0.0', profile, fixtures }, null, 2) + '\n');
