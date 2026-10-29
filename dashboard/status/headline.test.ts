import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GitHubStatus, Run, Runner } from './org-status.ts';
import { ago, runTone, verdict } from './headline.ts';
import type { LocalStatus } from './this-pc.ts';

const now = Date.parse('2025-10-29T12:00:00Z');
const secondsBefore = (s: number) => new Date(now - s * 1000).toISOString();

const run = (status: string, conclusion: string | null = null): Run => ({
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

const runner = (status: 'online' | 'offline'): Runner => ({ id: 1, name: 'pc', os: 'Windows', status, busy: false, labels: [] });

const pcUp: LocalStatus = { supported: true, name: 'pc', task: 'Running', listener: true, worker: false, lastJobAt: null };
const pcDown: LocalStatus = { ...pcUp, listener: false };
const noPc: LocalStatus = { supported: false };
const gh = (runs: Run[], runners: Runner[] | null = [runner('online')]): GitHubStatus => ({ ok: true, runners, runnersError: null, runs });

test('ago picks seconds, minutes, hours and days', () => {
	assert.equal(ago(secondsBefore(0), now), '0 s ago');
	assert.equal(ago(secondsBefore(59), now), '59 s ago');
	assert.equal(ago(secondsBefore(60), now), '1 min ago');
	assert.equal(ago(secondsBefore(90), now), '2 min ago');
	assert.equal(ago(secondsBefore(3599), now), '60 min ago');
	assert.equal(ago(secondsBefore(3600), now), '1 h ago');
	assert.equal(ago(secondsBefore(86400), now), '1 d ago');
	assert.equal(ago(secondsBefore(86400 * 3), now), '3 d ago');
});

test('ago shows a time in the future as 0 s ago', () => {
	assert.equal(ago(secondsBefore(-30), now), '0 s ago');
});

test('runTone maps status and conclusion to a color', () => {
	for (const status of ['queued', 'waiting', 'pending']) assert.equal(runTone(run(status)), 'warn');
	for (const status of ['in_progress', 'requested']) assert.equal(runTone(run(status)), 'busy');
	assert.equal(runTone(run('completed', 'success')), 'ok');
	assert.equal(runTone(run('completed', 'skipped')), 'ok');
	assert.equal(runTone(run('completed', 'cancelled')), 'warn');
	assert.equal(runTone(run('completed', 'neutral')), 'warn');
	assert.equal(runTone(run('completed', 'failure')), 'bad');
	assert.equal(runTone(run('completed', 'timed_out')), 'bad');
	assert.equal(runTone(run('completed', null)), 'bad');
});

test('verdict puts a stopped listener first', () => {
	assert.deepEqual(verdict(pcDown, { ok: false, error: 'x' }), { tone: 'bad', text: 'The runner on this PC is down' });
});

test('verdict reports GitHub out of reach', () => {
	assert.deepEqual(verdict(pcUp, { ok: false, error: 'x' }), { tone: 'warn', text: 'GitHub is out of reach' });
	assert.deepEqual(verdict(noPc, { ok: false, error: 'x' }), { tone: 'warn', text: 'GitHub is out of reach' });
});

test('verdict reports no runner online, and skips the check without a runner list', () => {
	assert.deepEqual(verdict(pcUp, gh([], [runner('offline')])), { tone: 'bad', text: 'No runner is online' });
	assert.deepEqual(verdict(pcUp, gh([], [])), { tone: 'bad', text: 'No runner is online' });
	assert.deepEqual(verdict(pcUp, gh([], null)), { tone: 'ok', text: 'CI is up and idle' });
});

test('verdict counts builds and the queue', () => {
	assert.deepEqual(verdict(pcUp, gh([run('in_progress')])), { tone: 'busy', text: 'Building 1 run' });
	assert.deepEqual(verdict(pcUp, gh([run('in_progress'), run('in_progress'), run('queued')])), {
		tone: 'busy',
		text: 'Building 2 runs, 1 in the queue',
	});
	assert.deepEqual(verdict(pcUp, gh([run('queued'), run('requested')])), { tone: 'warn', text: 'No run builds, 2 in the queue' });
	assert.deepEqual(verdict(noPc, gh([run('completed', 'failure')])), { tone: 'ok', text: 'CI is up and idle' });
});
