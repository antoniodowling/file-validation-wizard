"""Trusted-base docs classification. Unknown or incomplete evidence runs full CI."""
import argparse
import json
import sys
import re
import subprocess
from pathlib import PurePosixPath

FULL_LANES = ('checks',)
REPOSITORY = 'antoniodowling/file-validation-wizard'
PROTECTED_FILES = frozenset((
    'docs/review-automation.md', 'docs/REVIEW-AUTOMATION.md', 'docs/governance/PROJECT_STANDARDS.md',
    'docs/governance/DECISION_LOG.md', 'docs/governance/SECURITY_PRIVACY.md',
    'docs/governance/RUNBOOK.md', 'docs/governance/TESTING.md',
))
PROTECTED_DOC_PREFIXES = ('docs/instruction-audit/', 'docs/skill-maintenance/')
SHA = re.compile(r'[0-9a-f]{40}')
MAX_MARKDOWN_BYTES = 1024 * 1024


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.DEVNULL, timeout=30)


def markdown_path(path):
    parts = PurePosixPath(path).parts
    return (path in ('README.md', 'CHANGELOG.md') or
            (len(parts) > 1 and parts[0] == 'docs' and path.endswith('.md'))) and (
        path not in PROTECTED_FILES and not path.startswith(PROTECTED_DOC_PREFIXES)
        and all(part not in ('.', '..', 'AGENTS.md', 'AGENTS.override.md', 'SKILL.md', 'SECURITY.md')
                and not part.startswith('.') for part in parts)
        and not any(part.lower() in ('template', 'templates', 'fixture', 'fixtures') for part in parts)
        and str(PurePosixPath(path)) == path and not any(ord(c) < 32 for c in path)
        and not any(c in path for c in ('\\', '\x7f')))


def changed_markdown(root, before, after):
    """Inspect every raw diff entry, including both sides of renames and file modes."""
    entries = git(root, 'diff', '--raw', '-z', '--no-renames', '--no-abbrev',
                  '--no-ext-diff', '--no-textconv', before, after, '--').split(b'\0')
    if entries[-1] != b'' or (len(entries) - 1) % 2:
        return False
    if len(entries) == 1:
        return False
    for i in range(0, len(entries) - 1, 2):
        metadata = entries[i].decode('ascii').split()
        if len(metadata) != 5 or metadata[4] not in ('A', 'M', 'D'):
            return False
        old_mode, new_mode = metadata[0][1:], metadata[1]
        if old_mode not in ('000000', '100644') or new_mode not in ('000000', '100644'):
            return False
        path = entries[i + 1].decode('utf-8')
        if not markdown_path(path):
            return False
        for blob, mode in ((metadata[2], old_mode), (metadata[3], new_mode)):
            if mode == '000000':
                continue
            size = int(git(root, 'cat-file', '-s', blob))
            if size > MAX_MARKDOWN_BYTES:
                return False
            text = git(root, 'cat-file', 'blob', blob).decode('utf-8')
            if '\0' in text:
                return False
    return True


def pr_docs(root, before, after, merge, files=None):
    """Inspect immutable objects without checking out or executing candidate code."""
    if not all(isinstance(s, str) and SHA.fullmatch(s) for s in (before, after, merge)):
        return False
    if git(root, 'show', '-s', '--format=%P', merge).decode().split() != [before, after]:
        return False
    ancestor = git(root, 'merge-base', before, after).decode().strip()
    if files is not None:
        paths = set()
        for f in files:
            if not isinstance(f, dict) or f.get('status') not in ('added', 'modified', 'removed', 'renamed'):
                return False
            paths.add(f['filename'])
            if f.get('previous_filename'):
                paths.add(f['previous_filename'])
        raw = git(root, 'diff', '--raw', '-z', '--no-renames', '--no-abbrev',
                  '--no-ext-diff', '--no-textconv', ancestor, after, '--').split(b'\0')
        if raw[-1] != b'' or (len(raw) - 1) % 2 or paths != {p.decode('utf-8') for p in raw[1:-1:2]}:
            return False
    return changed_markdown(root, ancestor, after) and changed_markdown(root, before, merge)


def classify(root, event_name, event, expected_sha):
    """Unknown evidence retains the normal full validation path."""
    try:
        if not SHA.fullmatch(expected_sha) or git(root, 'rev-parse', 'HEAD').decode().strip() != expected_sha:
            return 'full'
        if event_name == 'pull_request':
            pr = event['pull_request']
            if (pr['user']['login'] != 'antoniodowling' or pr['user']['id'] != 26848379
                    or pr['head']['repo']['full_name'] != REPOSITORY
                    or pr['base']['repo']['full_name'] != REPOSITORY or pr['base']['ref'] != 'main'):
                return 'full'
            return 'docs' if pr_docs(root, pr['base']['sha'], pr['head']['sha'], expected_sha) else 'full'
        if event_name == 'push':
            before, after = event['before'], event['after']
            if (event.get('ref') != 'refs/heads/main' or after != expected_sha
                    or not isinstance(before, str) or not SHA.fullmatch(before) or before == '0' * 40):
                return 'full'
            git(root, 'merge-base', '--is-ancestor', before, after)
            return 'docs' if changed_markdown(root, before, after) else 'full'
    except (KeyError, TypeError, ValueError, UnicodeError, subprocess.SubprocessError, OSError):
        return 'full'
    return 'full'


def classify_environment(environ, root):
    try:
        with open(environ['GITHUB_EVENT_PATH'], encoding='utf-8') as stream:
            event = json.load(stream)
        return classify(root, environ['GITHUB_EVENT_NAME'], event, environ['EXPECTED_SHA'])
    except (KeyError, TypeError, ValueError, OSError):
        return 'full'


def evaluate(needs, expected_sha, verified_scope):
    """Require successful exact candidate proof; skips are only inapplicable docs fixtures."""
    if set(needs) != {'plan', 'checks'}:
        raise ValueError('Missing or unexpected lane')
    if needs['plan']['result'] != 'success' or needs['plan']['outputs'].get('sha') != expected_sha:
        raise ValueError('Missing or foreign classification proof')
    scope = needs['plan']['outputs'].get('scope')
    if scope not in ('docs', 'full') or scope != verified_scope:
        raise ValueError('Unverified scope')
    for lane in FULL_LANES:
        if scope == 'docs':
            if needs[lane]['result'] != 'skipped':
                raise ValueError('Documentation work must be declared inapplicable')
        elif needs[lane]['result'] != 'success' or needs[lane]['outputs'].get('sha') != expected_sha:
            raise ValueError('Missing or foreign lane proof')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    try:
        data = json.load(sys.stdin)
        eligible = pr_docs(args.root, data['base'], data['head'], data['merge'], data['files'])
    except (KeyError, TypeError, ValueError, UnicodeError, subprocess.SubprocessError, OSError):
        eligible = False
    print('docs' if eligible else 'full')
