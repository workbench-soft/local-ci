import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prListsToRead, reposWithPrRuns, supersededRuns } from './superseded.ts';

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

test('a PR run of a repo whose open PR list failed stays', () => {
	const runs = [run(2, 'queued', { event: 'pull_request', branch: 'new-pr' }), run(1, 'queued', { repo: 'other', event: 'pull_request', branch: 'gone' })];
	assert.deepEqual(ids(supersededRuns(runs, new Map([['other', new Set<string>()]]))), [1]);
});

test('a PR run that started after the last read of the open PRs gets a fresh read', () => {
	const at = Date.parse('2026-10-29T10:00:00Z');
	const pr = (id: number, createdAt: string, repo = 'app') => ({ ...run(id, 'queued', { repo, event: 'pull_request' }), createdAt });
	const readAt = new Map([
		['app', at],
		['old', at],
	]);
	const runs = [pr(2, '2026-10-29T10:00:30Z'), pr(1, '2026-10-29T09:59:00Z', 'old'), pr(3, '2026-10-29T10:00:30Z', 'new')];
	assert.deepEqual(prListsToRead(runs, readAt, at + 40_000, 60_000), ['app', 'new']);
	assert.deepEqual(prListsToRead(runs, readAt, at + 60_000, 60_000), ['app', 'old', 'new']);
});
