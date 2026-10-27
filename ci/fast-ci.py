"""Bounded PR change checks; classifier is loaded from the immutable base."""
import json
import hashlib
import os
import re
import runpy
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

base, head, classifier = sys.argv[1:]
if not all(re.fullmatch(r'[0-9a-f]{40}', s) for s in (base, head)):
    raise SystemExit('Expected full commit IDs')
def git(*args):
    return subprocess.check_output(['git', *args], timeout=30)
if git('rev-parse', 'HEAD').decode().strip() != head:
    raise SystemExit('Checkout does not match PR head')
ancestor = git('merge-base', base, head).decode().strip()
raw = git('diff', '--no-renames', '--name-only', '-z', ancestor, head, '--')
if not raw or not raw.endswith(b'\0'):
    raise SystemExit('Incomplete or empty change list')
paths = [p.decode('utf-8') for p in raw[:-1].split(b'\0')]
subprocess.run(['git', 'diff', '--check', ancestor, head, '--'], check=True)
policy = runpy.run_path(classifier)
docs = policy['changed_markdown']('.', ancestor, head)
control = not docs and any(p.startswith(('.github/', 'ci/')) or p == 'tools/docs_ci.py' for p in paths)
fixtures = any(p.startswith(('demo-files/', 'tests/fixtures/')) for p in paths)
stress = any(p.startswith('demo-files/hnb-validator-stress-files/') for p in paths)
stress_manifest = json.loads(Path('demo-files/hnb-validator-stress-files/manifest.json').read_text(encoding='utf-8')) if stress else []
w3c_manifest = json.loads(git('show', f'{base}:tests/fixtures/w3c/manifest.json')) if any(p.startswith('tests/fixtures/w3c/') for p in paths) else {'cases': []}
negative_xml = {'demo-files/pain.001.001.09-syntax-error.xml'} | {
    'tests/fixtures/w3c/' + item['file'] for item in w3c_manifest['cases'] if item['expect'] != 'pass'
}
for name in paths:
    path = Path(name)
    if not path.is_file():
        continue
    if path.suffix.lower() == '.json':
        json.loads(path.read_text(encoding='utf-8'))
    elif name.startswith('demo-files/hnb-validator-stress-files/') and path.suffix.lower() in ('.xml', '.edi'):
        entry = next((x for x in stress_manifest if x['name'] == path.name), None)
        if not entry or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise SystemExit(f'Stress fixture differs from its manifest: {name}')
    elif path.suffix.lower() == '.xml' and name not in negative_xml:
        ET.parse(path)
with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as out:
    out.write(f"build={'false' if docs else 'true'}\ncontrol={'true' if control else 'false'}\n"
              f"fixtures={'true' if fixtures and not docs else 'false'}\nstress={'true' if stress and not docs else 'false'}\n")
print('Documentation-only' if docs else 'Source or mixed changes: build required')
