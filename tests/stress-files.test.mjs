import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateStressFiles } from '../scripts/generate-stress-files.mjs';

test('generated upload kit has exact boundaries, encodings, checksums, and profiles', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'validator-stress-test-'));
  try {
    const manifest = await generateStressFiles(directory);
    assert.equal(manifest.length, 14);
    assert.equal(new Set(manifest.map(item => item.name)).size, 14);
    for (const item of manifest) {
      const data = await readFile(join(directory, item.name));
      assert.equal(data.length, item.bytes);
      assert.equal(createHash('sha256').update(data).digest('hex'), item.sha256);
      if (item.name.includes('-invalid-utf8')) {
        assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(data));
      } else {
        assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(data));
      }
      if (item.name.endsWith('.edi')) {
        assert.equal(data.indexOf('~'), 105);
        assert.equal(item.profile, '820 / 005010');
      } else assert.equal(item.profile, 'pain.001 / pain.001.001.09');
    }
    const size = prefix => manifest.find(item => item.name.startsWith(prefix)).bytes;
    assert.equal(size('06-'), 24_999_999);
    assert.equal(size('07-'), 25_000_000);
    assert.equal(size('08-'), 25_000_001);
    assert.equal(size('02-'), 0);
    assert.equal(manifest.filter(item => item.tier === 'adversarial').length, 2);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')), manifest);
    assert.match(await readFile(join(directory, 'README.md'), 'utf8'), /No upload is guaranteed to force a timeout/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
