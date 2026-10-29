import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RunJob, WorkflowRun } from './org-status.ts';
import { liveJobs, localRunnerNames, placeOfJob, placeOfRun } from './placement.ts';

const local = new Set(['pc', 'pc-2']);

const job = (id: number, status: string, runnerName: string | null = null, startedAt: string | null = null): RunJob => ({
	id,
	name: `job ${id}`,
	status,
	conclusion: status === 'completed' ? 'success' : null,
	runnerName,
	labels: ['self-hosted', 'local'],
	startedAt,
	url: `https://github.com/job/${id}`,
});

const run = (status: string, jobs: RunJob[] = []): WorkflowRun => ({
	id: 7,
	repo: 'app',
	workflow: 'ci',
	title: 't',
	branch: 'main',
	event: 'push',
	status,
	conclusion: null,
	createdAt: '2025-10-29T12:00:00Z',
	updatedAt: '2025-10-29T12:00:00Z',
	url: 'https://github.com/run/7',
	jobs,
});

test('localRunnerNames reads the agent names of this PC', () => {
	const runner = (name: string | null) => ({ folder: 'f', name, taskName: 't', task: null, listener: true, worker: false, lastJobAt: null });
	assert.deepEqual([...localRunnerNames({ supported: true, runners: [runner('pc'), runner(null)] })], ['pc']);
	assert.equal(localRunnerNames({ supported: false }).size, 0);
});

test('placeOfJob tells this PC from other runners and the queue', () => {
	assert.equal(placeOfJob(job(1, 'in_progress', 'pc-2'), local), 'local');
	assert.equal(placeOfJob(job(1, 'in_progress', 'GitHub Actions 3'), local), 'elsewhere');
	assert.equal(placeOfJob(job(1, 'queued'), local), 'waiting');
	assert.equal(placeOfJob(job(1, 'completed', 'pc'), local), 'done');
});

test('placeOfRun counts a run as local when any job builds here', () => {
	assert.equal(placeOfRun(run('in_progress', [job(1, 'in_progress', 'mac'), job(2, 'in_progress', 'pc')]), local), 'local');
	assert.equal(placeOfRun(run('in_progress', [job(1, 'completed', 'pc'), job(2, 'queued')]), local), 'waiting');
	assert.equal(placeOfRun(run('queued'), local), 'waiting');
	assert.equal(placeOfRun(run('in_progress'), local), 'elsewhere');
	assert.equal(placeOfRun(run('completed'), local), 'done');
});

test('liveJobs drops finished jobs and lists local ones first', () => {
	const runs = [
		run('in_progress', [job(1, 'queued'), job(2, 'in_progress', 'mac', '2025-10-29T12:01:00Z'), job(3, 'completed', 'pc'), job(4, 'in_progress', 'pc', '2025-10-29T12:02:00Z')]),
		run('completed'),
	];
	assert.deepEqual(
		liveJobs(runs, local).map((entry) => [entry.key, entry.place]),
		[
			['job-4', 'local'],
			['job-1', 'waiting'],
			['job-2', 'elsewhere'],
		],
	);
});

test('liveJobs stands in a whole run when GitHub gave no jobs', () => {
	const [entry] = liveJobs([run('queued')], local);
	assert.deepEqual([entry.key, entry.place, entry.name], ['run-7', 'waiting', null]);
});
