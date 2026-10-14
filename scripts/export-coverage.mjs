import { rolldown } from 'rolldown';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(join(tmpdir(), 'hnb-coverage-'));
try {
  const bundle = await rolldown({ input:'src/format-packs.ts' });
  await bundle.write({ file:join(directory,'packs.mjs'),format:'es' }); await bundle.close();
  const coverage = await rolldown({ input:'src/coverage.ts' });
  await coverage.write({ file:join(directory,'coverage.mjs'),format:'es' }); await coverage.close();
  const { FORMAT_PACKS } = await import(pathToFileURL(join(directory,'packs.mjs')).href);
  const { provenanceFor } = await import(pathToFileURL(join(directory,'coverage.mjs')).href);
  await mkdir('docs/coverage', { recursive:true });
  const profiles = FORMAT_PACKS.filter(pack => pack.parserKind !== "NACHA_FIXED").map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; });
  await writeFile('docs/coverage/ruleset-2.0.0.json', JSON.stringify(profiles,null,2)+'\n');
} finally { await rm(directory,{recursive:true,force:true}); }
