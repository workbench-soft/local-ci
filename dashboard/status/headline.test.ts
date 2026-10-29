import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrgRunner, OrgStatus, WorkflowRun } from './org-status.ts';
import { formatAge, summarizeCi, toneOfRun } from './headline.ts';
import type { ThisPcStatus } from './this-pc.ts';

const now = Date.parse('2025-10-29T12:00:00Z');
const secondsBefore = (s: number) => new Date(now - s * 1000).toISOString();

const run = (status: string, conclusion: string | null = null): WorkflowRun => ({
	id: 1,
	repo: 'app',
	workflow: 'ci',
	title: 't',
	branch: 'main',
	event: 'push',
	status,
	conclusion,
	createdAt: secondsBefore(0),
	updatedAt: secondsBefore(0),
	url: 'https://github.com',
});

const runner = (status: 'online' | 'offline'): OrgRunner => ({ id: 1, name: 'pc', os: 'Windows', status, busy: false, labels: [] });

const pcUp: ThisPcStatus = { supported: true, name: 'pc', task: 'Running', listener: true, worker: false, lastJobAt: null };
const pcDown: ThisPcStatus = { ...pcUp, listener: false };
const noPc: ThisPcStatus = { supported: false };
const orgWith = (runs: WorkflowRun[], runners: OrgRunner[] | null = [runner('online')]): OrgStatus => ({ ok: true, runners, runnersError: null, runs });

test('formatAge picks seconds, minutes, hours and days', () => {
	assert.equal(formatAge(secondsBefore(0), now), '0 s ago');
	assert.equal(formatAge(secondsBefore(59), now), '59 s ago');
	assert.equal(formatAge(secondsBefore(60), now), '1 min ago');
	assert.equal(formatAge(secondsBefore(90), now), '2 min ago');
	assert.equal(formatAge(secondsBefore(3599), now), '60 min ago');
	assert.equal(formatAge(secondsBefore(3600), now), '1 h ago');
	assert.equal(formatAge(secondsBefore(86400), now), '1 d ago');
	assert.equal(formatAge(secondsBefore(86400 * 3), now), '3 d ago');
});

test('formatAge shows a time in the future as 0 s ago', () => {
	assert.equal(formatAge(secondsBefore(-30), now), '0 s ago');
});

test('toneOfRun maps status and conclusion to a color', () => {
	for (const status of ['queued', 'waiting', 'pending']) assert.equal(toneOfRun(run(status)), 'warn');
	for (const status of ['in_progress', 'requested']) assert.equal(toneOfRun(run(status)), 'busy');
	assert.equal(toneOfRun(run('completed', 'success')), 'ok');
	assert.equal(toneOfRun(run('completed', 'skipped')), 'ok');
	assert.equal(toneOfRun(run('completed', 'cancelled')), 'warn');
	assert.equal(toneOfRun(run('completed', 'neutral')), 'warn');
	assert.equal(toneOfRun(run('completed', 'failure')), 'bad');
	assert.equal(toneOfRun(run('completed', 'timed_out')), 'bad');
	assert.equal(toneOfRun(run('completed', null)), 'bad');
});

test('summarizeCi puts a stopped listener first', () => {
	assert.deepEqual(summarizeCi(pcDown, { ok: false, error: 'x' }), { tone: 'bad', text: 'The runner on this PC is down' });
});

test('summarizeCi reports GitHub out of reach', () => {
	assert.deepEqual(summarizeCi(pcUp, { ok: false, error: 'x' }), { tone: 'warn', text: 'GitHub is out of reach' });
	assert.deepEqual(summarizeCi(noPc, { ok: false, error: 'x' }), { tone: 'warn', text: 'GitHub is out of reach' });
});

test('summarizeCi reports no runner online, and skips the check without a runner list', () => {
	assert.deepEqual(summarizeCi(pcUp, orgWith([], [runner('offline')])), { tone: 'bad', text: 'No runner is online' });
	assert.deepEqual(summarizeCi(pcUp, orgWith([], [])), { tone: 'bad', text: 'No runner is online' });
	assert.deepEqual(summarizeCi(pcUp, orgWith([], null)), { tone: 'ok', text: 'CI is up and idle' });
});

test('summarizeCi counts builds and the queue', () => {
	assert.deepEqual(summarizeCi(pcUp, orgWith([run('in_progress')])), { tone: 'busy', text: 'Building 1 run' });
	assert.deepEqual(summarizeCi(pcUp, orgWith([run('in_progress'), run('in_progress'), run('queued')])), {
		tone: 'busy',
		text: 'Building 2 runs, 1 in the queue',
	});
	assert.deepEqual(summarizeCi(pcUp, orgWith([run('queued'), run('requested')])), { tone: 'warn', text: 'No run builds, 2 in the queue' });
	assert.deepEqual(summarizeCi(noPc, orgWith([run('completed', 'failure')])), { tone: 'ok', text: 'CI is up and idle' });
});
