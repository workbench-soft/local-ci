import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

const scripts = join(import.meta.dirname, '..', '..', '.github', 'scripts');
// The scripts run on a GitHub runner. A PC without Git's sh on PATH skips them.
const noSh = spawnSync('sh', ['-c', 'exit 0']).status !== 0;

const identity = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

/** A repo with one commit per message, the first one tagged v1.0.0. */
function repoWith(messages: string[]): string {
  const repo = mkdtempSync(join(tmpdir(), 'release-scripts-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, env: { ...process.env, ...identity }, encoding: 'utf8' });
  git('init', '--quiet', '--initial-branch=main');
  git('commit', '--quiet', '--allow-empty', '-m', 'chore: start');
  git('tag', 'v1.0.0');
  for (const message of messages) git('commit', '--quiet', '--allow-empty', '-m', message);
  return repo;
}

test('release notes leave out the co-author line in any letter case', { skip: noSh }, () => {
  const repo = repoWith([
    'fix(runner): one store per runner\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
    'feat: a new card\n\nIt shows the queue.\n\nCo-authored-by: Someone <someone@example.com>',
  ]);
  try {
    const notes = execFileSync('sh', [join(scripts, 'release-notes.sh'), 'v1.0.1'], { cwd: repo, encoding: 'utf8' });
    assert.match(notes, /- One store per runner \([0-9a-f]+\)\n\n/);
    assert.match(notes, /- A new card \([0-9a-f]+\)\n {2}It shows the queue\.\n/);
    assert.doesNotMatch(notes, /co-authored-by/i);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

// Git Bash has no zone data, so the script asks powershell.exe. A PATH without it stands for a runner with neither.
test(
  'the next version fails without a date, where it once printed .1',
  { skip: noSh || process.platform !== 'win32' },
  () => {
    const repo = repoWith([]);
    const path = (process.env.PATH ?? '')
      .split(delimiter)
      .filter((dir) => dir && !existsSync(join(dir, 'powershell.exe')))
      .join(delimiter);
    try {
      const run = spawnSync('sh', [join(scripts, 'next-version.sh')], {
        cwd: repo,
        env: { ...process.env, PATH: path, Path: path },
        encoding: 'utf8',
      });
      assert.equal(run.stdout, '');
      assert.equal(run.status, 1);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);
