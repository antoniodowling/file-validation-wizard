import { rolldown } from 'rolldown';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(join(tmpdir(), 'hnb-nacha-coverage-'));
try {
  const bundle = await rolldown({ input: 'src/format-packs.ts' });
  await bundle.write({ file: join(directory, 'packs.mjs'), format: 'es' }); await bundle.close();
  const coverage = await rolldown({ input: 'src/coverage.ts' });
  await coverage.write({ file: join(directory, 'coverage.mjs'), format: 'es' }); await coverage.close();
  const { FORMAT_PACKS } = await import(pathToFileURL(join(directory, 'packs.mjs')).href);
  const { provenanceFor } = await import(pathToFileURL(join(directory, 'coverage.mjs')).href);
  const packs = FORMAT_PACKS.filter(pack => pack.id === 'nacha-origination-public-2026');
  if (!packs.length) throw new Error('No NACHA profile registered; integrate the candidate before exporting coverage.');
  const profiles = packs.map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; });
  const expanded = FORMAT_PACKS.find(pack => pack.id === 'nacha-origination-expanded-public-2026-r1');
  if (expanded) { const { buildRevision, ...snapshot } = provenanceFor(expanded); await writeFile('docs/coverage/nacha-expanded-public-1.0.0.json', JSON.stringify([snapshot], null, 2) + '\n'); }
  await mkdir('docs/coverage', { recursive: true });
  await writeFile('docs/coverage/nacha-public-1.0.0.json', JSON.stringify(profiles, null, 2) + '\n');
} finally { await rm(directory, { recursive: true, force: true }); }
