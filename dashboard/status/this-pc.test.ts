import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeRunner, runnerNumber, runnerTaskName } from './this-pc.ts';

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
test('the folders and tasks of runner/install.ps1 are the ones this page reads', { skip: process.platform !== 'win32' }, async () => {
	const { execFile } = await import('node:child_process');
	const { readFile } = await import('node:fs/promises');
	const source = await readFile(new URL('../../runner/install.ps1', import.meta.url), 'utf8');
	const getRunner = /function Get-Runner\b[\s\S]*?\n\}/.exec(source)?.[0];
	assert.ok(getRunner, 'runner/install.ps1 has no Get-Runner function');
	const script = `$org = 'workbench-soft'; ${getRunner}; 1..3 | ForEach-Object { $r = Get-Runner $_; "$(Split-Path $r.Dir -Leaf)|$($r.Task)" }`;
	const stdout = await new Promise<string>((resolve, reject) =>
		execFile('powershell', ['-NoProfile', '-Command', script], (error, out) => (error ? reject(error) : resolve(out))),
	);
	for (const line of stdout.trim().split(/\r?\n/)) {
		const [folder, task] = line.split('|');
		assert.notEqual(runnerNumber(folder), null, folder);
		assert.equal(runnerTaskName(folder), task);
	}
});
