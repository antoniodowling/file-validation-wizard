import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const limit = 25_000_000;
const xmlStart = '<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"><CstmrCdtTrfInitn><GrpHdr><MsgId>SYNTHETIC-STRESS-ONLY</MsgId><NbOfTxs>1</NbOfTxs></GrpHdr>';
const xmlEnd = '</CstmrCdtTrfInitn></Document>';
const payment = '<PmtInf><PmtInfId>SYNTHETIC-NOT-A-PAYMENT</PmtInfId></PmtInf>';
const xml = (body = payment) => `${xmlStart}${body}${xmlEnd}`;
const sizedXml = (size) => {
  const start = `${xmlStart}<PmtInf><PmtInfId>SYNTHETIC</PmtInfId><StressText>`;
  const end = `</StressText></PmtInf>${xmlEnd}`;
  return start + 'X'.repeat(size - Buffer.byteLength(start + end)) + end;
};
const isa = 'ISA*00*          *00*          *ZZ*SYNTHETIC      *ZZ*TESTONLY       *260917*1200*U*00501*000000001*0*T*:~';
const gs = 'GS*RA*SYNTHETIC*TESTONLY*20260917*1200*1*X*005010~';
const edi = (body, count) => `${isa}${gs}${body}GE*${count}*1~IEA*1*000000001~`;

export function stressCases() {
  const item = (name, purpose, expected, make, profile = 'pain.001 / pain.001.001.09', tier = 'standard') =>
    ({ name, purpose, expected, make, profile, tier });
  return [
    item('01-xml-small-baseline-pass.xml', 'Small baseline for comparison.', 'PASS under current demo checks.', () => xml()),
    item('02-xml-empty-file.xml', 'Empty input and syntax-error recovery.', 'Completed FAIL.', () => ''),
    item('03-xml-invalid-utf8.xml', 'Decode failure rather than file FAIL.', 'UTF-8 error; no validation result.', () => Buffer.concat([Buffer.from(xmlStart), Buffer.from([0xc3, 0x28]), Buffer.from(xmlEnd)])),
    item('04-xml-prohibited-dtd-and-entity.xml', 'Early rejection of declarations; entity is local and harmless.', 'Completed FAIL for prohibited declarations.', () => '<!DOCTYPE Document [<!ENTITY stress "SYNTHETIC">]>' + xml()),
    item('05-xml-malformed-at-end-5MB.xml', 'Syntax error after scanning a large input.', 'Completed FAIL.', () => sizedXml(5_000_000).slice(0, -1)),
    item('06-xml-just-under-limit-24999999-bytes.xml', 'Large text node one byte under selection/worker limit.', 'Admitted; PASS if processing completes before deadline.', () => sizedXml(limit - 1)),
    item('07-xml-exact-limit-25000000-bytes.xml', 'Exact inclusive size boundary.', 'Admitted; PASS if processing completes before deadline.', () => sizedXml(limit)),
    item('08-xml-over-limit-25000001-bytes.xml', 'Selection size rejection.', 'Rejected by file picker; prior selection preserved. Worker rejection is unit-tested separately.', () => sizedXml(limit + 1)),
    item('09-xml-wide-tree-50000-payment-blocks.xml', 'Many sibling objects rather than one large text node.', 'PASS under current demo checks if processing completes; not standards-conformance evidence.', () => xml(Array.from({ length: 50_000 }, (_, i) => `<PmtInf><PmtInfId>SYNTHETIC-${i + 1}</PmtInfId></PmtInf>`).join(''))),
    item('10-xml-deep-nesting-5000-levels.xml', 'Deep recursion with small input; run after ordinary cases.', 'May produce ENGINE_ERROR or TIMEOUT. No fixed outcome across parser/browser versions.', () => xml(`<PmtInf><PmtInfId>SYNTHETIC</PmtInfId>${'<Nested>'.repeat(5_000)}X${'</Nested>'.repeat(5_000)}</PmtInf>`), undefined, 'adversarial'),
    item('11-edi-820-005010-baseline-pass.edi', 'Small EDI baseline.', 'PASS under current demo checks.', () => edi('ST*820*0001*005010~BPR*C*1.00*C*ACH~SE*3*0001~', 1), '820 / 005010'),
    item('12-edi-820-005010-50000-transactions.edi', 'Many segment/element arrays and envelope scans.', 'PASS under current demo checks if processing completes.', () => edi(Array.from({ length: 50_000 }, (_, i) => `ST*820*${i + 1}*005010~BPR*C*1.00*C*ACH~SE*3*${i + 1}~`).join(''), 50_000), '820 / 005010'),
    item('13-edi-820-005010-long-element-5MB.edi', 'One large element versus many short segments.', 'PASS under current limited checks if processing completes; deliberately not a realistic payment.', () => edi(`ST*820*0001*005010~BPR*C*1.00*C*ACH*${'X'.repeat(5_000_000)}~SE*3*0001~`, 1), '820 / 005010'),
    item('14-edi-820-005010-dense-250000-segments.edi', 'Allocation pressure from many tiny segments; run after ordinary cases.', 'May PASS limited checks, fail in the engine, or time out. Not a valid standard file.', () => edi(`ST*820*0001*005010~BPR*C*1.00*C*ACH~${'N1*X~'.repeat(250_000)}SE*250003*0001~`, 1), '820 / 005010', 'adversarial'),
  ];
}

export async function generateStressFiles(directory) {
  await mkdir(directory, { recursive: true });
  const manifest = [];
  for (const spec of stressCases()) {
    const data = Buffer.from(spec.make());
    await writeFile(resolve(directory, spec.name), data);
    manifest.push({ name: spec.name, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), profile: spec.profile, tier: spec.tier, purpose: spec.purpose, expected: spec.expected });
  }
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const lines = manifest.map(item => `| [${item.name}](${item.name}) | ${item.bytes.toLocaleString('en-US')} | ${item.profile} | ${item.expected} |`);
  await writeFile(resolve(directory, 'README.md'), `# Synthetic validator upload stress kit\n\nThese files contain invented test data only. They exercise the current demo, not standards or bank acceptance. Do not submit them as payment instructions.\n\nUse a local preview or ReadMe draft with the safeguards build. Select the profile shown below, upload one file, and press Validate. Run the standard cases first; run the two adversarial cases individually with other browser work saved. A deadline cannot guarantee recovery from browser memory exhaustion.\n\nRecord browser/version, environment, file, result/failure message, elapsed time, responsiveness, and whether the next small baseline succeeds. Keep the tab foreground for comparable timing. Browser timer throttling can delay the 10-second deadline in background tabs.\n\nNo upload is guaranteed to force a timeout on every computer. Deadline behavior has a deterministic test using a silent worker; do not enlarge files indefinitely to force one.\n\n| File | Bytes | Select format / version | Expected behavior |\n| --- | ---: | --- | --- |\n${lines.join('\n')}\n\nmanifest.json includes byte counts and SHA-256 checksums. The oversized file is rejected before worker dispatch; direct worker enforcement is covered separately in unit tests.\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new Error('Pass an output directory: node scripts/generate-stress-files.mjs /absolute/output/path');
  const manifest = await generateStressFiles(resolve(directory));
  console.log(`Generated ${manifest.length} synthetic files in ${resolve(directory)}`);
}
