import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const hash = createHash('sha256');
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) visit(path); else { hash.update(path); hash.update(readFileSync(path)); }
  }
}
visit('src'); hash.update(readFileSync('package-lock.json'));
export const buildRevision = `sha256:${hash.digest('hex')}`;
