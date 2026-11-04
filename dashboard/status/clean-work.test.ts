import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const hook = join(import.meta.dirname, '..', '..', 'runner', 'clean-work.ps1');

// A work folder like C:\ci\3: the current repo, an old one, a fresh one and the runner's own folders.
function workFolder() {
  const root = mkdtempSync(join(tmpdir(), 'clean-work-'));
  for (const name of ['current', 'old', 'fresh', '_actions', '_temp']) mkdirSync(join(root, name));
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  utimesSync(join(root, 'old'), tenDaysAgo, tenDaysAgo);
  return root;
}

function runHook(root: string, minFreeGb: number) {
  return new Promise<string>((resolve, reject) =>
    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', hook, '-Workspace', join(root, 'current')],
      { env: { ...process.env, RUNNER_CLEAN_MIN_FREE_GB: String(minFreeGb) } },
      (error, out) => (error ? reject(error) : resolve(out)),
    ),
  );
}

// The detached delete may still run, so a removed folder shows as gone or as _trash-*.
const kept = (root: string) =>
  readdirSync(root)
    .filter((name) => !name.startsWith('_trash-'))
    .sort();

test(
  'the hook removes repos unused for 3 days and keeps the rest',
  { skip: process.platform !== 'win32' },
  async () => {
    const root = workFolder();
    await runHook(root, 0);
    assert.deepEqual(kept(root), ['_actions', '_temp', 'current', 'fresh']);
  },
);

test('on a full disk the hook keeps only the current repo', { skip: process.platform !== 'win32' }, async () => {
  const root = workFolder();
  await runHook(root, 1_000_000);
  assert.deepEqual(kept(root), ['_actions', '_temp', 'current']);
});
