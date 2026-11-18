import { rolldown } from 'rolldown';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: {
  output: { type: 'string', default: 'docs/coverage/report-schema-4.0.0.json' },
  profile: { type: 'string' },
} });
const directory = await mkdtemp(join(tmpdir(), 'hnb-coverage-'));
try {
  const bundle = await rolldown({ input:'src/format-packs.ts' });
  await bundle.write({ file:join(directory,'packs.mjs'),format:'es' }); await bundle.close();
  const coverage = await rolldown({ input:'src/coverage.ts' });
  await coverage.write({ file:join(directory,'coverage.mjs'),format:'es' }); await coverage.close();
  const { FORMAT_PACKS } = await import(pathToFileURL(join(directory,'packs.mjs')).href);
  const { provenanceFor } = await import(pathToFileURL(join(directory,'coverage.mjs')).href);
  const selected = values.profile ? FORMAT_PACKS.filter(pack => pack.id === values.profile) : FORMAT_PACKS;
  if (selected.length === 0) throw new Error(`Unknown profile: ${values.profile}`);
  await mkdir(dirname(values.output), { recursive:true });
  const profiles = selected.map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; });
  // Revision snapshots are immutable. Choose a fresh --output path for new semantics.
  await writeFile(values.output, JSON.stringify(profiles,null,2)+'\n', { flag: 'wx' });
} finally { await rm(directory,{recursive:true,force:true}); }
