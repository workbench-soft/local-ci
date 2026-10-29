import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration, runDuration, spanMs, toJobTimings } from './durations.ts';

const start = '2026-10-29T12:00:00Z';
const at = (seconds: number) => new Date(Date.parse(start) + seconds * 1000).toISOString();
const now = Date.parse(at(600));

test('spanMs counts up to now while it runs, and gives null without a start', () => {
	assert.equal(spanMs(start, at(90), now), 90_000);
	assert.equal(spanMs(start, null, now), 600_000);
	assert.equal(spanMs(null, null, now), null);
});

test('runDuration ends a finished run at its last update and skips a queued run', () => {
	assert.equal(runDuration({ status: 'completed', startedAt: start, updatedAt: at(252) }, now), 252_000);
	assert.equal(runDuration({ status: 'in_progress', startedAt: start, updatedAt: at(30) }, now), 600_000);
	assert.equal(runDuration({ status: 'queued', startedAt: start, updatedAt: start }, now), null);
});

test('formatDuration reads in seconds, minutes or hours', () => {
	assert.equal(formatDuration(42_000), '42 s');
	assert.equal(formatDuration(252_000), '4 min 12 s');
	assert.equal(formatDuration(240_000), '4 min');
	assert.equal(formatDuration(3_780_000), '1 h 3 min');
	assert.equal(formatDuration(7_200_000), '2 h');
});

test('toJobTimings gives each step its time, and none to a step that has not started', () => {
	const [job] = toJobTimings(
		[
			{
				name: 'build',
				status: 'in_progress',
				conclusion: null,
				started_at: start,
				completed_at: null,
				html_url: 'https://github.com/x',
				steps: [
					{ name: 'Set up job', status: 'completed', conclusion: 'success', started_at: start, completed_at: at(5) },
					{ name: 'Build', status: 'in_progress', conclusion: null, started_at: at(5), completed_at: null },
					{ name: 'Test', status: 'queued', conclusion: null, started_at: null, completed_at: null },
				],
			},
		],
		now,
	);
	assert.equal(job.ms, 600_000);
	assert.deepEqual(
		job.steps.map((step) => step.ms),
		[5_000, 595_000, null],
	);
});
