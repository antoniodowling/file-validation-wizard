import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class FastRouting(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        (self.root / 'README.md').write_text('old\n')
        (self.root / 'source.ts').write_text('const a = 1;\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'base')
        self.base = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, text=True)

    def route(self):
        self.git('add', '-A')
        self.git('commit', '-qm', 'candidate')
        head = self.git('rev-parse', 'HEAD').strip()
        output = self.root / 'output'
        env = dict(os.environ, GITHUB_OUTPUT=str(output))
        run = subprocess.run(['python3', str(ROOT/'ci/fast-ci.py'), self.base, head,
                              str(ROOT/'tools/docs_ci.py')], cwd=self.root, env=env,
                             capture_output=True, text=True)
        return run, output.read_text() if output.exists() else ''

    def test_prose_only_skips_build(self):
        (self.root/'README.md').write_text('new\n')
        run, out = self.route()
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn('build=false', out)

    def test_mixed_unknown_and_deletion_require_build(self):
        (self.root/'README.md').write_text('new\n')
        (self.root/'source.ts').unlink()
        (self.root/'mystery.zzz').write_text('anything\n')
        run, out = self.route()
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn('build=true', out)

    def test_rename_from_source_to_prose_requires_build(self):
        (self.root/'source.ts').rename(self.root/'source.md')
        run, out = self.route()
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn('build=true', out)

    def test_invalid_json_fails(self):
        (self.root/'fixture.json').write_text('{invalid\n')
        run, _ = self.route()
        self.assertNotEqual(run.returncode, 0)

if __name__ == '__main__':
    unittest.main()
