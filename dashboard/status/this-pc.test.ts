import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeRunner, readThisPc, runnerNumber, runnerTaskName, type ThisPcStatus } from './this-pc.ts';

test('runnerNumber reads the folders runner/install.ps1 makes', () => {
  assert.equal(runnerNumber('workbench-soft'), 1);
  assert.equal(runnerNumber('workbench-soft-3'), 3);
  assert.equal(runnerNumber('workbench-soft-x'), null);
  assert.equal(runnerNumber('other-org'), null);
});

test('runnerTaskName keeps the first task name and numbers the rest', () => {
  assert.equal(runnerTaskName('workbench-soft'), 'GitHub Actions runner (workbench-soft)');
  assert.equal(runnerTaskName('workbench-soft-2'), 'GitHub Actions runner (workbench-soft 2)');
});

test('describeRunner matches its own task and logs', () => {
  const snapshot = {
    tasks: [{ name: 'GitHub Actions runner (workbench-soft)', state: 'Running' }],
    logs: [
      { folder: 'workbench-soft', listener: true, worker: false },
      { folder: 'workbench-soft-2', listener: false, worker: true },
    ],
  };
  const first = describeRunner('workbench-soft', snapshot);
  assert.deepEqual([first.task, first.listener, first.worker], ['Running', true, false]);
  const second = describeRunner('workbench-soft-2', snapshot);
  assert.deepEqual([second.task, second.listener, second.worker], [null, false, true]);
  const third = describeRunner('workbench-soft-3', snapshot);
  assert.deepEqual([third.task, third.listener, third.worker], [null, false, false]);
});

// runner/install.ps1 makes the folders and tasks this page looks for, so its Get-Runner runs here and the names must match.
test(
  'the folders and tasks of runner/install.ps1 are the ones this page reads',
  { skip: process.platform !== 'win32' },
  async () => {
    const { execFile } = await import('node:child_process');
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../../runner/install.ps1', import.meta.url), 'utf8');
    const getRunner = /function Get-Runner\b[\s\S]*?\n\}/.exec(source)?.[0];
    assert.ok(getRunner, 'runner/install.ps1 has no Get-Runner function');
    const script = `$org = 'workbench-soft'; $workRoot = 'C:/ci'; ${getRunner}; 1..3 | ForEach-Object { $r = Get-Runner $_; "$(Split-Path $r.Dir -Leaf)|$($r.Task)" }`;
    const stdout = await new Promise<string>((resolve, reject) =>
      execFile('powershell', ['-NoProfile', '-Command', script], (error, out) =>
        error ? reject(error) : resolve(out),
      ),
    );
    for (const line of stdout.trim().split(/\r?\n/)) {
      const [folder, task] = line.split('|');
      assert.notEqual(runnerNumber(folder), null, folder);
      assert.equal(runnerTaskName(folder), task);
    }
  },
);

test('readThisPc answers from the kept read while one new read runs', async () => {
  let clock = 0;
  const now = () => clock;
  const pending: ((status: ThisPcStatus) => void)[] = [];
  const load = () => new Promise<ThisPcStatus>((resolve) => pending.push(resolve));
  const answer = (folder: string): ThisPcStatus => ({
    supported: true,
    runners: [{ ...describeRunner(folder, { tasks: [], logs: [] }), name: folder, lastJobAt: null }],
  });
  const nameOf = async (status: Promise<ThisPcStatus>) => {
    const read = await status;
    return read.supported ? read.runners[0].name : null;
  };

  // The first read has no answer to show, so visitors wait for it together.
  const first = readThisPc(load, now);
  assert.equal(readThisPc(load, now), first);
  pending[0](answer('one'));
  assert.equal(await nameOf(first), 'one');
  await Promise.resolve();

  // Past 5 s the page gets the kept answer at once, and one read starts behind it.
  clock = 15_000;
  assert.equal(await nameOf(readThisPc(load, now)), 'one');
  assert.equal(await nameOf(readThisPc(load, now)), 'one');
  assert.equal(pending.length, 2);
  pending[1](answer('two'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await nameOf(readThisPc(load, now)), 'two');

  // Past 30 s the kept answer is too old to show, so the visit waits for a new read.
  clock = 60_000;
  const late = readThisPc(load, now);
  assert.equal(pending.length, 3);
  pending[2](answer('three'));
  assert.equal(await nameOf(late), 'three');
});
