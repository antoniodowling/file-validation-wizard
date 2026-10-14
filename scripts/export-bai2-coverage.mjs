import { rolldown } from 'rolldown';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const directory = await mkdtemp(join(tmpdir(), 'hnb-bai2-coverage-'));
try {
  for (const [name, input] of [['packs', 'src/format-packs.ts'], ['coverage', 'src/coverage.ts']]) {
    const bundle = await rolldown({ input });
    await bundle.write({ file: join(directory, `${name}.mjs`), format: 'es' });
    await bundle.close();
  }
  const { BAI2_PACK } = await import(pathToFileURL(join(directory, 'packs.mjs')).href);
  const { provenanceFor } = await import(pathToFileURL(join(directory, 'coverage.mjs')).href);
  const { buildRevision, ...snapshot } = provenanceFor(BAI2_PACK);
  await writeFile('docs/coverage/bai2-candidate-1.0.0.json', JSON.stringify([snapshot], null, 2) + '\n');
} finally { await rm(directory, { recursive: true, force: true }); }
