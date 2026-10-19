"""Real Git fixtures for docs routing; no provider, database or native runner."""
import copy
import json
import os
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
policy = runpy.run_path(str(ROOT / 'tools/docs_ci.py'))
classify = policy['classify']
LANES = policy['FULL_LANES']


class GitFixture:
    def __init__(self, root):
        self.root = root
        root.mkdir()
        self.git('init', '-q', '-b', 'main')
        self.git('config', 'user.name', 'CI Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        (root / 'README.md').write_text('Initial documentation\n')
        (root / 'code.py').write_text('value = 1\n')
        (root / 'docs').mkdir()
        (root / 'docs/guide.md').write_text('Guide\n')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgSign=false',
                                        '-C', str(self.root), *args], stderr=subprocess.DEVNULL).decode().strip()

    def commit(self):
        self.git('add', '--all')
        self.git('commit', '-qm', 'Synthetic fixture', '--allow-empty')
        return self.git('rev-parse', 'HEAD')

    def push(self, head):
        return {'before': self.base, 'after': head, 'ref': 'refs/heads/main'}

    def merge(self):
        head = self.git('rev-parse', 'HEAD')
        self.git('checkout', '-q', '-b', 'integration', self.base)
        self.git('merge', '--no-ff', '-qm', 'Synthetic integration', head)
        return self.git('rev-parse', 'HEAD'), {'pull_request': {'user': {'login':'antoniodowling','id':26848379}, 'base': {'sha': self.base,'ref':'main','repo':{'full_name':'antoniodowling/file-validation-wizard'}}, 'head': {'sha': head,'repo':{'full_name':'antoniodowling/file-validation-wizard'}}}}


class DocsClassificationTests(unittest.TestCase):
    def fixture(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        return GitFixture(Path(temp.name) / 'candidate')

    def test_readme_and_markdown_pr_and_push(self):
        f = self.fixture()
        (f.root / 'README.md').write_text('Updated docs\n')
        (f.root / 'docs/nested').mkdir()
        (f.root / 'docs/nested/new guide.md').write_text('New guide\n')
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'docs')
        merge, event = f.merge()
        self.assertEqual(classify(f.root, 'pull_request', event, merge), 'docs')

    def test_code_workflow_policy_unknown_and_mixed_paths_run_full(self):
        for path in ('code.py', '.github/workflows/ci.yml', 'tools/docs_ci.py', 'docs/fixture.json', 'new.txt', 'requirements.txt', 'docs/guide.mdx', 'docs/guide.html', 'docs/diagram.svg'):
            with self.subTest(path=path):
                f = self.fixture()
                (f.root / 'README.md').write_text('Docs change\n')
                p = f.root / path
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text('Changed\n')
                head = f.commit()
                self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')

    def test_more_than_300_files_and_late_code_change(self):
        f = self.fixture()
        for n in range(305):
            (f.root / f'docs/{n:03}.md').write_text('Documentation\n')
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'docs')
        (f.root / 'zzz.py').write_text('value = 2\n')
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')

    def test_deletion_and_docs_rename_are_checked_on_both_sides(self):
        f = self.fixture()
        (f.root / 'docs/guide.md').rename(f.root / 'docs/renamed.md')
        (f.root / 'README.md').unlink()
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'docs')
        (f.root / 'code.py').rename(f.root / 'docs/code.md')
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')

    def test_docs_renamed_to_code_runs_full(self):
        f = self.fixture()
        (f.root / 'docs/guide.md').rename(f.root / 'new.py')
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')

    def test_binary_invalid_utf8_executable_symlink_run_full(self):
        for kind in ('nul', 'utf8', 'executable', 'symlink', 'oversize'):
            with self.subTest(kind=kind):
                f = self.fixture()
                p = f.root / 'README.md'
                if kind == 'symlink':
                    p.unlink()
                    p.symlink_to('code.py')
                elif kind == 'executable':
                    p.chmod(0o755)
                else:
                    p.write_bytes({'nul': b'a\0b', 'utf8': b'\xff', 'whitespace': b'Trailing space \n',
                                   'oversize': b'a' * (1024 * 1024 + 1)}[kind])
                head = f.commit()
                self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')

    def test_empty_unknown_incomplete_and_foreign_identity_run_full(self):
        f = self.fixture()
        head = f.commit()
        self.assertEqual(classify(f.root, 'push', f.push(head), head), 'full')
        (f.root / 'README.md').write_text('Updated\n')
        head = f.commit()
        for event_name, event, sha in (
                ('workflow_dispatch', f.push(head), head), ('release', {}, head),
                ('push', {}, head), ('push', dict(f.push(head), before='0' * 40), head),
                ('push', dict(f.push(head), before='f' * 40), head),
                ('push', dict(f.push(head), ref='refs/heads/other'), head),
                ('push', dict(f.push(head), after=f.base), head),
                ('push', f.push(head), f.base), ('push', f.push(head), 'bad'),
                ('pull_request', {}, head)):
            with self.subTest(event=event):
                self.assertEqual(classify(f.root, event_name, event, sha), 'full')
        merge, event = f.merge()
        event['pull_request']['base']['sha'] = 'b' * 40
        self.assertEqual(classify(f.root, 'pull_request', event, merge), 'full')

    def test_missing_history_and_git_errors_run_full(self):
        with patch.dict(policy['classify'].__globals__, {'git': lambda *a: (_ for _ in ()).throw(subprocess.TimeoutExpired('git', 30))}):
            self.assertEqual(classify('.', 'push', {}, 'a' * 40), 'full')
        self.assertEqual(policy['classify_environment']({}, '.'), 'full')



class AdapterContractTests(unittest.TestCase):
    def test_native_context_and_trusted_credentials(self):
        profile = json.loads((ROOT / 'ci/docs-policy/profile.json').read_text())
        self.assertEqual(profile['repository'], policy['REPOSITORY'])
        workflow = (ROOT / '.github/workflows/docs-automerge.yml').read_text()
        self.assertIn('ref: refs/heads/main', workflow)
        self.assertIn('permission-statuses: write', workflow)
        self.assertNotIn('ci-ready', workflow)
        self.assertFalse((ROOT / '.github/workflows/review-control.yml').exists())

    def test_all_document_names_and_folders_are_admitted(self):
        for path in ('AGENTS.md', 'docs/AGENTS.md', 'docs/review-automation.md',
                     'GOVERNANCE.md', 'PROJECT_TRACKER.md', 'SECURITY.md',
                     'docs/operations/ci.md', 'docs/templates/guide.md',
                     'docs/fixtures/guide.md', '.agents/skills/example/SKILL.md'):
            self.assertTrue(policy['markdown_path'](path), path)

    def test_full_requires_exact_checks_and_docs_requires_skips(self):
        sha = 'a' * 40
        good = {'plan': {'result': 'success', 'outputs': {'scope': 'full', 'sha': sha}}, 'checks': {'result': 'success', 'outputs': {'sha': sha}}}
        policy['evaluate'](good, sha, 'full')
        for state in ('failure', 'skipped', 'cancelled'):
            bad = copy.deepcopy(good); bad['checks']['result'] = state
            with self.assertRaises(ValueError): policy['evaluate'](bad, sha, 'full')
        good['plan']['outputs']['scope'] = 'docs'; good['checks']['result'] = 'skipped'
        policy['evaluate'](good, sha, 'docs')
        good['checks']['result'] = 'success'
        with self.assertRaises(ValueError): policy['evaluate'](good, sha, 'docs')

class WorkflowDocsTests(unittest.TestCase):
    def test_deployed_plan_and_guard_accept_only_trusted_complete_scope(self):
        workflow = (ROOT / '.github/workflows/validate.yml').read_text()
        plan = __import__('re').split(r'\n  [a-z][\w-]*:\n', workflow.split('      - id: scope\n', 1)[1].split('        run: |\n', 1)[1], maxsplit=1)[0]
        code = '\n'.join(line[10:] for line in plan.splitlines())
        block = workflow.split('      - name: Independently verify exact validation result', 1)[1].split('        run: |\n', 1)[1].split('\n      - ', 1)[0]
        guard = '\n'.join(line[10:] for line in block.splitlines())
        for trusted in (False, True):
            for mixed in (False, True):
                with self.subTest(trusted=trusted, mixed=mixed), tempfile.TemporaryDirectory() as folder:
                    root = Path(folder); f = GitFixture(root / 'candidate')
                    (f.root / ('code.py' if mixed else 'README.md')).write_text('Updated\n')
                    head=f.commit(); (root / 'event.json').write_text(json.dumps(f.push(head)))
                    if trusted:
                        (root / 'policy/tools').mkdir(parents=True)
                        (root / 'policy/tools/docs_ci.py').write_bytes((ROOT / 'tools/docs_ci.py').read_bytes())
                    env = dict(os.environ, EXPECTED_SHA=head, GITHUB_EVENT_NAME='push', GITHUB_EVENT_PATH=str(root / 'event.json'), GITHUB_OUTPUT=str(root / 'output'), GITHUB_STEP_SUMMARY=str(root / 'summary'))
                    subprocess.run([__import__('sys').executable, '-c', code], cwd=root, env=env, check=True)
                    outputs=dict(line.split('=',1) for line in (root / 'output').read_text().splitlines())
                    scope='docs' if trusted and not mixed else 'full'
                    self.assertEqual(outputs['scope'],scope)
                    needs={'plan': {'result':'success','outputs':outputs},'checks': {'result':'skipped' if scope=='docs' else 'success','outputs':{'sha':head}}}
                    env['NEEDS']=json.dumps(needs)
                    subprocess.run([__import__('sys').executable, '-c', guard], cwd=root, env=env, check=True, stdout=subprocess.DEVNULL)
                    needs['plan']['outputs']['scope']='docs' if scope=='full' else 'full'
                    env['NEEDS']=json.dumps(needs)
                    result=subprocess.run([__import__('sys').executable,'-c',guard],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
                    self.assertNotEqual(result.returncode,0)


class AllProseTests(unittest.TestCase):
    fixture = DocsClassificationTests.fixture

    def test_all_document_categories_are_docs_in_real_pr_and_push(self):
        paths = ('AGENTS.md', 'AGENTS.override.md', 'SKILL.md', 'SECURITY.md',
                 'GOVERNANCE.md', 'PROJECT_TRACKER.md', 'PENDING_TASKS.md',
                 'DECISION_LOG.md', 'design-qa.md', 'LICENSE', 'NOTICE.txt',
                 'docs/governance/PROJECT_STANDARDS.md', 'docs/governance/DECISION_LOG.md',
                 'docs/governance/SECURITY_PRIVACY.md', 'docs/governance/RUNBOOK.md',
                 'docs/governance/TESTING.md', 'docs/review-automation.md',
                 'docs/templates/guide.md', 'docs/fixtures/guide.md',
                 'docs/instruction-audit/report.md', 'docs/skill-maintenance/report.md',
                 '.agents/skills/helper/SKILL.md', 'ci/CORE.md',
                 'docs/.hidden.md', 'nested/AGENTS.md', 'guide.markdown')
        f = self.fixture()
        for path in paths:
            p=f.root/path; p.parent.mkdir(parents=True,exist_ok=True)
            p.write_text('Plain documentation, including instructions.  \n')
            self.assertTrue(policy['markdown_path'](path),path)
        head=f.commit()
        self.assertEqual(classify(f.root,'push',f.push(head),head),'docs')
        merge,event=f.merge()
        self.assertEqual(classify(f.root,'pull_request',event,merge),'docs')
        files=[{'filename':path,'status':'added'} for path in paths]
        self.assertTrue(policy['pr_docs'](f.root,f.base,head,merge,files))

    def test_document_paths_never_admit_traversal_or_executable_types(self):
        for path in ('../AGENTS.md','docs/../guide.md','/AGENTS.md','docs//guide.md',
                     './AGENTS.md','docs/guide.md/','docs/guide\\name.md',
                     'docs/guide\n.md','requirements.txt','fixtures/payload.json',
                     '.github/workflows/ci.yml','docs/template.sql'):
            self.assertFalse(policy['markdown_path'](path),repr(path))
