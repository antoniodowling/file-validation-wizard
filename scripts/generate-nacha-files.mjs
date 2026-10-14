/** Independent synthetic NACHA builder. No customer, bank, or account data. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const destination = resolve(process.argv[2] ?? resolve(root, 'demo-files/nacha'));
const text = (value, width) => { const s = String(value); if (s.length > width) throw new Error(`Field overflow: ${s}`); return s.padEnd(width, ' '); };
const number = (value, width) => { const s = String(value); if (!/^\d+$/.test(s) || s.length > width) throw new Error(`Numeric overflow: ${s}`); return s.padStart(width, '0'); };
const record = (...fields) => { const r = fields.join(''); if (r.length !== 94) throw new Error(`Record is ${r.length} characters: ${r}`); return r; };
const ODFI = '01000000';
// Reserved-format synthetic routing values; check digits satisfy ABA arithmetic only.
const routing = '010000003';
const padding = '9'.repeat(94);
const hash = (entries) => entries.reduce((sum, entry) => sum + BigInt(entry.routing.slice(0, 8)), 0n) % 10000000000n;
const totals = (entries) => entries.reduce((sum, entry) => { sum[entry.code === 27 || entry.code === 37 ? 'debit' : 'credit'] += entry.cents; return sum; }, { debit: 0n, credit: 0n });
export function buildFile(batches, separator = '\n') {
  const rows = [record('1', '01', text(' 010000003', 10), text(' 010000003', 10), '261014', '1200', 'A', '094', '10', '1', text('SYNTHETIC DESTINATION', 23), text('SYNTHETIC ORIGIN', 23), text('', 8))];
  let traceCounter = 0;
  const allEntries = [];
  let entryAddendaCount = 0;
  batches.forEach((batch, index) => {
    const service = batch.service ?? (batch.entries.every(e => e.code === 27 || e.code === 37) ? '225' : batch.entries.every(e => e.code !== 27 && e.code !== 37) ? '220' : '200');
    const batchNo = number(index + 1, 7);
    rows.push(record('5', service, text('SYNTHETIC CO', 16), text('', 20), '9999999999', batch.sec, text('TEST ONLY', 10), text('', 6), '261015', text('', 3), '1', ODFI, batchNo));
    batch.entries.forEach((entry) => {
      const traceSequence = number(++traceCounter, 7);
      const trace = ODFI + traceSequence;
      const addenda = entry.addenda ?? [];
      rows.push(record('6', number(entry.code, 2), entry.routing.slice(0, 8), entry.routing.slice(8), text('SYNTHETIC000001', 17), number(entry.cents, 10), text(batch.sec === 'WEB' && entry.code !== 27 && entry.code !== 37 ? 'SYNTHETIC-ID' : 'TEST-ID', 15), batch.sec === 'CTX' ? number(addenda.length, 4) + text('SYNTHETIC NAME', 16) + text('', 2) : text('SYNTHETIC RECEIVER', 22), text('', 2), addenda.length ? '1' : '0', trace));
      addenda.forEach((payment, addendaIndex) => rows.push(record('7', '05', text(payment, 80), number(addendaIndex + 1, 4), traceSequence)));
      entryAddendaCount += 1 + addenda.length;
      allEntries.push(entry);
    });
    const t = totals(batch.entries);
    rows.push(record('8', service, number(batch.entries.reduce((sum, entry) => sum + 1 + (entry.addenda?.length ?? 0), 0), 6), number(hash(batch.entries), 10), number(t.debit, 12), number(t.credit, 12), '9999999999', text('', 19), text('', 6), ODFI, batchNo));
  });
  const t = totals(allEntries);
  const blocks = Math.ceil((rows.length + 1) / 10);
  rows.push(record('9', number(batches.length, 6), number(blocks, 6), number(entryAddendaCount, 8), number(hash(allEntries), 10), number(t.debit, 12), number(t.credit, 12), text('', 39)));
  while (rows.length % 10) rows.push(padding);
  return rows.join(separator) + (separator ? separator : '');
}
const entry = (code = 22, cents = 12345n, addenda = []) => ({ code, cents, addenda, routing });
const batch = (sec, entries = [entry(sec === 'TEL' ? 27 : 22)]) => ({ sec, entries });
const replaceField = (source, rowIndex, start, width, value) => { const rows = source.trimEnd().split('\n'); rows[rowIndex] = rows[rowIndex].slice(0, start - 1) + text(value, width) + rows[rowIndex].slice(start - 1 + width); return rows.join('\n') + '\n'; };
const fixtures = [];
const add = (file, description, source, expectedStatus = 'PASS', expectedRuleIds = []) => fixtures.push({ file, description, source, expectedStatus, expectedRuleIds });
const base = buildFile([batch('CCD', [entry(22, 12345n, ['SYNTHETIC PAYMENT'])])]);
for (const sec of ['CCD', 'PPD', 'CTX', 'WEB', 'TEL']) add(`${sec.toLowerCase()}-pass.ach`, `${sec} synthetic monetary origination`, buildFile([batch(sec, [entry(sec === 'TEL' ? 27 : 22, 12345n, sec === 'TEL' ? [] : ['SYNTHETIC PAYMENT'])])]));
const mixed = buildFile(['CCD', 'PPD', 'CTX', 'WEB', 'TEL'].map(sec => batch(sec, [entry(sec === 'TEL' ? 27 : 22, 12345n, sec === 'CTX' ? ['SYNTHETIC SEGMENT 1', 'SYNTHETIC SEGMENT 2'] : [])])));
add('mixed-five-sec-pass.ach', 'All five supported SEC codes in one file', mixed);
add('balanced-mixed-pass.ach', 'Equal credit/debit totals and regular monetary codes', buildFile([batch('CCD', [entry(22, 100n), entry(27, 100n), entry(32, 200n), entry(37, 500n), entry(52, 300n)])]));
add('unbalanced-mixed-pass.ach', 'Mixed regular credits/debits with unequal totals', buildFile([batch('PPD', [entry(22, 100n), entry(27, 200n), entry(32, 300n), entry(37, 400n)])]));
for (const [name, separator] of [['crlf', '\r\n'], ['cr', '\r'], ['concatenated', '']]) add(`${name}-pass.ach`, `${name} record framing`, buildFile([batch('CCD')], separator));
add('ctx-multi-addenda-pass.ach', 'CTX entry with multiple type-05 addenda', buildFile([batch('CTX', [entry(22, 101n, ['SYNTHETIC SEGMENT 1', 'SYNTHETIC SEGMENT 2', 'SYNTHETIC SEGMENT 3'])])]));
add('sparse-no-addenda-pass.ach', 'Optional descriptive fields blank and no addenda', replaceField(replaceField(buildFile([batch('PPD')]), 2, 40, 15, ''), 2, 77, 2, ''));
add('hash-wrap-pass.ach', 'Entry hash wraps modulo ten billion using 130 synthetic entries', buildFile([batch('CCD', Array.from({ length: 130 }, () => ({ ...entry(22, 7000000000n), routing: '800000006' }))) ]));
// Failures are deliberately limited to one changed field or structural operation.
const mutations = [
 ['ascii', 'Non-ASCII character', s => replaceField(s, 2, 55, 1, 'é')],
 ['record-length', 'One record is short', s => s.slice(1)],
 ['order', 'Entry appears before batch header', s => { const r = s.trimEnd().split('\n'); [r[1], r[2]] = [r[2], r[1]]; return r.join('\n') + '\n'; }],
 ['file-constants', 'Invalid file-header record size', s => replaceField(s, 0, 35, 3, '095')],
 ['file-date', 'Impossible creation date', s => replaceField(s, 0, 24, 6, '260230')],
 ['batch-date', 'Impossible effective entry date', s => replaceField(s, 1, 70, 6, '260230')],
 ['sec', 'Unsupported SEC code', s => replaceField(s, 1, 51, 3, 'IAT')],
 ['service-class', 'Credit-only service class contains debit', s => replaceField(buildFile([batch('CCD', [entry(27)])]), 1, 2, 3, '220')],
 ['batch-required', 'Blank company identification', s => replaceField(s, 1, 41, 10, '')],
 ['entry-required', 'Blank receiving account', s => replaceField(s, 2, 13, 17, '')],
 ['routing-prefix', 'Unsupported receiving routing prefix with valid check digit', s => replaceField(s, 2, 4, 9, '890000003')],
 ['routing-check-digit', 'Invalid receiving routing check digit', s => replaceField(s, 2, 12, 1, '8')],
 ['routing-numeric', 'Non-numeric receiving routing field', s => replaceField(s, 2, 4, 1, 'X')],
 ['trace-prefix', 'Trace prefix differs from ODFI', s => replaceField(s, 2, 80, 8, '98000000')],
 ['trace-sequence', 'Zero trace sequence', s => replaceField(s, 2, 88, 7, '0000000')],
 ['transaction-code', 'Unsupported nonmonetary transaction code', s => replaceField(s, 2, 2, 2, '23')],
 ['amount', 'Zero-dollar entry outside monetary scope', s => replaceField(s, 2, 30, 10, '0000000000')],
 ['amount-numeric', 'Non-numeric amount', s => replaceField(s, 2, 30, 1, 'X')],
 ['tel-credit', 'TEL credits outside TEL origination scope', s => buildFile([batch('TEL', [entry(22)])])],
 ['tel-addenda', 'TEL cannot carry addenda', s => buildFile([batch('TEL', [entry(27, 100n, ['SYNTHETIC PAYMENT'])])])],
 ['web-credit-id', 'WEB credit identification is blank', s => replaceField(buildFile([batch('WEB')]), 2, 40, 15, '')],
 ['addenda-indicator', 'Addenda present with indicator zero', s => replaceField(s, 2, 79, 1, '0')],
 ['addenda-type', 'Unsupported addenda type', s => replaceField(s, 3, 2, 2, '99')],
 ['addenda-sequence', 'First addenda sequence is not one', s => replaceField(s, 3, 84, 4, '0002')],
 ['addenda-trace-link', 'Addenda links to wrong entry sequence', s => replaceField(s, 3, 88, 7, '0000002')],
 ['ctx-addenda-count', 'CTX declared addenda count differs', s => replaceField(buildFile([batch('CTX', [entry(22, 100n, ['SYNTHETIC PAYMENT'])])]), 2, 55, 4, '0002')],
 ['single-addenda-count', 'CCD has more than one addenda', s => buildFile([batch('CCD', [entry(22, 100n, ['ONE', 'TWO'])])])],
 ['batch-control-mirror', 'Batch control company differs', s => replaceField(s, 4, 45, 10, '8888888888')],
 ['batch-control-count', 'Batch control entry/addenda count differs', s => replaceField(s, 4, 5, 6, '000003')],
 ['batch-control-hash', 'Batch hash differs', s => replaceField(s, 4, 11, 10, '0000000000')],
 ['batch-control-totals', 'Batch credit total differs', s => replaceField(s, 4, 33, 12, '000000012346')],
 ['file-control-batches', 'File batch count differs', s => replaceField(s, 5, 2, 6, '000002')],
 ['file-control-blocks', 'File block count differs', s => replaceField(s, 5, 8, 6, '000002')],
 ['file-control-count', 'File entry/addenda count differs', s => replaceField(s, 5, 14, 8, '00000003')],
 ['file-control-hash', 'File hash differs', s => replaceField(s, 5, 22, 10, '0000000000')],
 ['file-control-totals', 'File credit total differs', s => replaceField(s, 5, 44, 12, '000000012346')],
 ['padding', 'Padding record contains a non-nine character', s => replaceField(s, 6, 2, 1, '0')],
 ['block-padding', 'File does not end on ten-record boundary', s => s.split('\n').slice(0, -2).join('\n') + '\n'],
];
const aliases = {
 'record-length':'framing', order:'record-order', 'file-constants':'file-header', 'file-date':'creation-date', 'batch-date':'effective-date', sec:'sec-code',
 'routing-prefix':'routing', 'routing-check-digit':'routing', 'routing-numeric':'routing', 'trace-prefix':'trace', 'trace-sequence':'trace', amount:'entry-amount', 'amount-numeric':'entry-amount',
 'tel-credit':'sec-transaction', 'tel-addenda':'addenda-count', 'web-credit-id':'web-credit-originator', 'addenda-trace-link':'addenda-link', 'ctx-addenda-count':'addenda-count', 'single-addenda-count':'addenda-count',
 'batch-control-mirror':'batch-mirror', 'batch-control-count':'batch-count', 'batch-control-hash':'batch-hash', 'batch-control-totals':'batch-credit',
 'file-control-batches':'file-batches', 'file-control-blocks':'file-blocks', 'file-control-count':'file-count', 'file-control-hash':'file-hash', 'file-control-totals':'file-credit', padding:'record-order', 'block-padding':'blocking',
 'service-class':'sec-transaction'
};
for (const [name, description, mutate] of mutations) add(`${name}-fail.ach`, description, mutate(base), 'FAIL', [`nacha.${aliases[name] ?? name}`]);
const extra = [
 ['creation-time', 'Invalid optional creation time', s => replaceField(s, 0, 30, 4, '2460')],
 ['service-class', 'Unsupported service class', s => replaceField(s, 1, 2, 3, '999')],
 ['originator-status', 'Invalid originator status', s => replaceField(s, 1, 79, 1, '2')],
 ['odfi', 'Invalid originating DFI prefix', s => replaceField(s, 1, 80, 8, '00000000')],
 ['batch-number', 'Nonpositive batch number', s => replaceField(s, 1, 88, 7, '0000000')],
 ['trace-order', 'Entry trace sequence decreases', s => { const f = buildFile([batch('CCD', [entry(), entry()])]); return replaceField(f, 3, 88, 7, '0000000'); }],
 ['trace-unique', 'Duplicate entry trace', s => { const f = buildFile([batch('CCD', [entry(), entry()])]); return replaceField(f, 3, 88, 7, '0000001'); }],
 ['batch-debit', 'Batch debit total differs', s => replaceField(s, 4, 21, 12, '000000000001')],
 ['file-debit', 'File debit total differs', s => replaceField(s, 5, 32, 12, '000000000001')],
 ['reserved', 'File-control reserved field populated', s => replaceField(s, 5, 56, 1, 'X')],
];
for (const [name, description, mutate] of extra) add(`${name}-isolated-fail.ach`, description, mutate(base), 'FAIL', [`nacha.${name}`]);
add('effective-weekend-warning.ach', 'Weekend effective entry date requires ODFI confirmation', replaceField(base, 1, 70, 6, '261017'), 'PASS_WITH_WARNINGS', ['nacha.effective-weekend']);
add('settlement-date-warning.ach', 'Operator settlement date populated in an origination', replaceField(base, 1, 76, 3, '288'), 'PASS_WITH_WARNINGS', ['nacha.settlement-date']);
mkdirSync(destination, { recursive: true });
for (const fixture of fixtures) writeFileSync(resolve(destination, fixture.file), fixture.source);
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify({ synthetic: true, description: 'Synthetic test data only. Format-valid routing values prove checksum arithmetic, not bank membership or deliverability.', fixtures: fixtures.map(({ source, ...fixture }) => ({ ...fixture, sha256: createHash('sha256').update(source).digest('hex'), bytes: Buffer.byteLength(source) })) }, null, 2) + '\n');
console.log(`Generated ${fixtures.length} synthetic NACHA fixtures in ${destination}`);
