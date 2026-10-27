import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { validateWorkerRequest } from '../src/worker-request';
import manifest from '../demo-files/hnb-validator-stress-files/manifest.json';

it('checks the selected synthetic stress kit bytes and declared outcomes', () => {
  expect(manifest).toHaveLength(14);
  expect(new Set(manifest.map(item => item.name)).size).toBe(manifest.length);
  for (const item of manifest) {
    expect(item.name).toMatch(/^[a-zA-Z0-9._-]+\.(xml|edi)$/);
    const data = readFileSync(`demo-files/hnb-validator-stress-files/${item.name}`);
    expect(data.length, item.name).toBe(item.bytes);
    expect(createHash('sha256').update(data).digest('hex'), item.name).toBe(item.sha256);
    const bytes = Uint8Array.from(data);
    const response = validateWorkerRequest({ type: 'validate', packId: item.name.endsWith('.edi') ? 'edi-820-005010' : 'pain-001-09', fileName: item.name, bytes: bytes.buffer });
    if (item.expected.includes('RESOURCE_LIMIT')) expect(response, item.name).toEqual({ type: 'error', code: 'RESOURCE_LIMIT' });
    else if (item.name.startsWith('08-')) expect(response, item.name).toEqual({ type: 'error', code: 'FILE_TOO_LARGE' });
    else if (item.name.startsWith('03-')) expect(response, item.name).toEqual({ type: 'error', code: 'INVALID_ENCODING' });
    else {
      expect(response.type, item.name).toBe('complete');
      if (response.type === 'complete') expect(response.run.overallStatus, item.name).toBe(item.expected.includes('PASS') ? 'PASS' : 'FAIL');
    }
  }
});
