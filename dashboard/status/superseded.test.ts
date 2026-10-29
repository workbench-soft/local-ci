import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reposWithPrRuns, supersededRuns } from './superseded.ts';

const run = (id: number, status: string, change: Partial<{ repo: string; workflowId: number; branch: string; event: string }> = {}) => ({
	id,
	repo: 'app',
	workflowId: 1,
	branch: 'main',
	event: 'push',
	status,
	...change,
});

const noPrs = new Map<string, Set<string>>();
const ids = (runs: { id: number }[]) => runs.map((item) => item.id);

test('a newer run replaces the queued and running runs before it', () => {
	assert.deepEqual(ids(supersededRuns([run(3, 'queued'), run(2, 'in_progress'), run(1, 'queued')], noPrs)), [2, 1]);
});

test('a newer run that already finished still replaces the older ones', () => {
	assert.deepEqual(ids(supersededRuns([run(2, 'completed'), run(1, 'queued')], noPrs)), [1]);
});

test('finished runs and the newest run stay', () => {
	assert.deepEqual(supersededRuns([run(2, 'queued'), run(1, 'completed')], noPrs), []);
});

test('other workflows, branches, events and repos of the same moment stay', () => {
	const open = new Map([['app', new Set(['main'])]]);
	const runs = [
		run(5, 'queued'),
		run(4, 'queued', { workflowId: 2 }),
		run(3, 'queued', { branch: 'feature' }),
		run(2, 'queued', { event: 'pull_request' }),
		run(1, 'queued', { repo: 'other' }),
	];
	assert.deepEqual(supersededRuns(runs, open), []);
});

test('a run of a merged or closed PR dies, a run of an open PR stays', () => {
	const open = new Map([['app', new Set(['open-pr'])]]);
	const runs = [run(3, 'queued', { event: 'pull_request', branch: 'open-pr' }), run(2, 'queued', { event: 'pull_request', branch: 'merged' }), run(1, 'queued', { branch: 'merged' })];
	assert.deepEqual(ids(supersededRuns(runs, open)), [2]);
});

test('open PRs are read only for repos with an unfinished PR run', () => {
	const runs = [run(3, 'queued', { event: 'pull_request' }), run(2, 'completed', { repo: 'done', event: 'pull_request' }), run(1, 'queued', { repo: 'push' })];
	assert.deepEqual(reposWithPrRuns(runs), ['app']);
});
