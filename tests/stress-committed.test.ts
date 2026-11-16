import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { ALL_FORMAT_PACKS } from '../src/format-packs';
import { ResourceLimitError } from '../src/resource-policy';
import { MAX_FILE_BYTES } from '../src/types';
import { validateSource } from '../src/validation';
import { validateWorkerRequest } from '../src/worker-request';
import manifest from '../demo-files/hnb-validator-stress-files/manifest.json';

// Preserve the committed historical kit byte-for-byte and assert original
// parser outcomes directly. These retired IDs must not become public again.
it('checks historical stress kit hashes, parser outcomes, and active byte/decode gates', () => {
  expect(manifest).toHaveLength(14);
  expect(new Set(manifest.map(item => item.name)).size).toBe(manifest.length);
  for (const item of manifest) {
    expect(item.name).toMatch(/^[a-zA-Z0-9._-]+\.(xml|edi)$/);
    const data = readFileSync(`demo-files/hnb-validator-stress-files/${item.name}`);
    expect(data.length, item.name).toBe(item.bytes);
    expect(createHash('sha256').update(data).digest('hex'), item.name).toBe(item.sha256);
    const bytes = Uint8Array.from(data);
    const activeResponse = () => validateWorkerRequest({
      type: 'validate', packId: 'pain-001-03', fileName: item.name, bytes: bytes.buffer,
    });
    if (data.length > MAX_FILE_BYTES) {
      expect(activeResponse(), item.name).toEqual({ type: 'error', code: 'FILE_TOO_LARGE' });
      continue;
    }
    if (item.name.startsWith('03-')) {
      expect(activeResponse(), item.name).toEqual({ type: 'error', code: 'INVALID_ENCODING' });
      continue;
    }
    const id = item.name.endsWith('.edi') ? 'edi-820-005010' : 'pain-001-09';
    const legacyPack = ALL_FORMAT_PACKS.find(pack => pack.id === id)!;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (item.expected.includes('RESOURCE_LIMIT')) {
      expect(() => validateSource(item.name, text, legacyPack), item.name).toThrow(ResourceLimitError);
    } else {
      expect(validateSource(item.name, text, legacyPack).overallStatus, item.name)
        .toBe(item.expected.includes('PASS') ? 'PASS' : 'FAIL');
    }
  }
});
