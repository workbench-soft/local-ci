import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countSteps, jobProgress, typicalDuration } from './progress.ts';

const start = '2025-10-29T12:00:00Z';
const at = (minutes: number) => Date.parse(start) + minutes * 60_000;
const finished = (name: string, minutes: number) => ({ name, startedAt: start, completedAt: new Date(at(minutes)).toISOString() });

test('countSteps counts finished steps and names the running one', () => {
	const steps = countSteps([
		{ name: 'Set up job', status: 'completed' },
		{ name: 'Build', status: 'in_progress' },
		{ name: 'Test', status: 'queued' },
	]);
	assert.deepEqual(steps, { done: 1, total: 3, current: 'Build' });
});

test('typicalDuration takes the median of jobs with the same name', () => {
	const past = [finished('test', 4), finished('test', 10), finished('test', 6), finished('build', 1)];
	assert.equal(typicalDuration('test', past), 6 * 60_000);
	assert.equal(typicalDuration('lint', past), null);
});

test('with a usual time the bar fills by time and says what is left', () => {
	const progress = jobProgress({ done: 1, total: 4, current: 'Build' }, 10 * 60_000, start, at(4));
	assert.equal(progress.fraction, 0.4);
	assert.equal(progress.step, 'step 2 of 4: Build');
	assert.equal(progress.time, 'about 6 min left');
	assert.equal(progress.over, false);
});

test('a job past its usual time stays below full and says how much over', () => {
	const progress = jobProgress({ done: 3, total: 4, current: 'Test' }, 5 * 60_000, start, at(7));
	assert.equal(progress.fraction, 0.99);
	assert.equal(progress.time, '2 min over the usual 5 min');
	assert.equal(progress.over, true);
});

test('without a usual time the bar fills by steps', () => {
	const progress = jobProgress({ done: 2, total: 8, current: null }, null, start, at(1));
	assert.equal(progress.fraction, 0.25);
	assert.equal(progress.step, 'step 3 of 8');
	assert.equal(progress.time, null);
});
