import assert from 'node:assert/strict';
import { test } from 'node:test';
import { purgeRun, type RunApi } from './purge.ts';

const instant = { pollMs: 1, timeoutMs: 50, sleep: async () => {} };

function fakeRun(statuses: string[], options: { cancelFails?: boolean } = {}) {
	const calls: string[] = [];
	let index = 0;
	const api: RunApi = {
		status: async () => statuses[Math.min(index++, statuses.length - 1)],
		forceCancel: async () => {
			calls.push('force-cancel');
			if (options.cancelFails) throw new Error('GitHub answered 409');
		},
		remove: async () => {
			calls.push('delete');
		},
	};
	return { api, calls };
}

test('a finished run is deleted without a cancel', async () => {
	const { api, calls } = fakeRun(['completed']);
	await purgeRun(api, instant);
	assert.deepEqual(calls, ['delete']);
});

test('a running run is force cancelled, waited on, then deleted', async () => {
	const { api, calls } = fakeRun(['in_progress', 'in_progress', 'completed']);
	await purgeRun(api, instant);
	assert.deepEqual(calls, ['force-cancel', 'delete']);
});

test('a run that finishes before the cancel is still deleted', async () => {
	const { api, calls } = fakeRun(['in_progress', 'completed'], { cancelFails: true });
	await purgeRun(api, instant);
	assert.deepEqual(calls, ['force-cancel', 'delete']);
});

test('a refused cancel of a running run throws and deletes nothing', async () => {
	const { api, calls } = fakeRun(['in_progress'], { cancelFails: true });
	await assert.rejects(purgeRun(api, instant), /409/);
	assert.deepEqual(calls, ['force-cancel']);
});

test('a run that keeps running past the timeout is left in place', async () => {
	const { api, calls } = fakeRun(['in_progress']);
	await assert.rejects(purgeRun(api, { ...instant, timeoutMs: 0 }), /didn't stop/);
	assert.deepEqual(calls, ['force-cancel']);
});
