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
