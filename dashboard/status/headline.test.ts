import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrgRunner, OrgStatus, WorkflowRun } from './org-status.ts';
import { formatAge, summarizeCi, toneOfRun } from './headline.ts';
import { liveJobs } from './placement.ts';
import type { PcRunner, ThisPcStatus } from './this-pc.ts';

const now = Date.parse('2025-10-29T12:00:00Z');
const secondsBefore = (s: number) => new Date(now - s * 1000).toISOString();

const run = (status: string, conclusion: string | null = null): WorkflowRun => ({
  id: 1,
  repo: 'app',
  workflow: 'ci',
  title: 't',
  workflowId: 1,
  branch: 'main',
  event: 'push',
  status,
  conclusion,
  createdAt: secondsBefore(0),
  startedAt: secondsBefore(0),
  updatedAt: secondsBefore(0),
  url: 'https://github.com',
  branchUrl: 'https://github.com/tree/main',
  pullRequests: [],
  jobs: [],
});

const runner = (status: 'online' | 'offline'): OrgRunner => ({
  id: 1,
  name: 'pc',
  os: 'Windows',
  status,
  busy: false,
  labels: [],
});

const pcRunner = (listener: boolean): PcRunner => ({
  folder: 'workbench-soft',
  name: 'pc',
  taskName: 't',
  task: 'Running',
  listener,
  worker: false,
  lastJobAt: null,
});
const pcUp: ThisPcStatus = { supported: true, runners: [pcRunner(true), pcRunner(true)] };
const pcDown: ThisPcStatus = { supported: true, runners: [pcRunner(false)] };
const noPc: ThisPcStatus = { supported: false };
const orgWith = (runs: WorkflowRun[], runners: OrgRunner[] | null = [runner('online')]): OrgStatus => ({
  ok: true,
  runners,
  runnersError: null,
  runs,
  releases: [],
});

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
  assert.deepEqual(summarizeCi(pcDown, { ok: false, error: 'x' }, []), {
    tone: 'bad',
    text: 'The runner on this PC is down',
  });
});

test('summarizeCi counts the runners down when this PC has several', () => {
  const pc: ThisPcStatus = { supported: true, runners: [pcRunner(true), pcRunner(false), pcRunner(false)] };
  assert.deepEqual(summarizeCi(pc, orgWith([]), []), { tone: 'bad', text: '2 of 3 runners on this PC are down' });
  assert.deepEqual(summarizeCi({ supported: true, runners: [] }, orgWith([]), []), {
    tone: 'bad',
    text: 'No runner is installed on this PC',
  });
});

test('summarizeCi reports GitHub out of reach', () => {
  assert.deepEqual(summarizeCi(pcUp, { ok: false, error: 'x' }, []), { tone: 'warn', text: 'GitHub is out of reach' });
  assert.deepEqual(summarizeCi(noPc, { ok: false, error: 'x' }, []), { tone: 'warn', text: 'GitHub is out of reach' });
});

test('summarizeCi reports no runner online, and skips the check without a runner list', () => {
  assert.deepEqual(summarizeCi(pcUp, orgWith([], [runner('offline')]), []), {
    tone: 'bad',
    text: 'No runner is online',
  });
  assert.deepEqual(summarizeCi(pcUp, orgWith([], []), []), { tone: 'bad', text: 'No runner is online' });
  assert.deepEqual(summarizeCi(pcUp, orgWith([], null), []), { tone: 'ok', text: 'CI is up and idle' });
});

const job = (status: string, runnerName: string | null = null) => ({
  id: Math.random(),
  name: 'build',
  status,
  conclusion: null,
  runnerName,
  labels: ['self-hosted'],
  startedAt: null,
  url: 'https://github.com',
  failedStep: null,
  completedAt: null,
  steps: { done: 0, total: 0, current: null },
  typicalMs: null,
});
const runWith = (...jobs: ReturnType<typeof job>[]): WorkflowRun => ({ ...run('in_progress'), jobs });
const summarize = (runs: WorkflowRun[]) => summarizeCi(pcUp, orgWith(runs), liveJobs(runs, new Set(['pc'])));

test('summarizeCi puts jobs on this PC first, then other runners, then the GitHub queue', () => {
  assert.deepEqual(summarize([runWith(job('in_progress', 'pc'))]), { tone: 'busy', text: 'Building 1 job on this PC' });
  assert.deepEqual(summarize([runWith(job('in_progress', 'pc'), job('in_progress', 'mac'), job('queued'))]), {
    tone: 'busy',
    text: 'Building 1 job on this PC, 1 on other runners, 1 waiting on GitHub',
  });
  assert.deepEqual(summarize([runWith(job('in_progress', 'mac'), job('queued'))]), {
    tone: 'busy',
    text: '1 job on other runners, 1 waiting on GitHub',
  });
  assert.deepEqual(summarize([run('queued'), run('requested')]), {
    tone: 'warn',
    text: '2 jobs waiting on GitHub for a runner',
  });
  assert.deepEqual(summarize([run('completed', 'failure')]), { tone: 'ok', text: 'CI is up and idle' });
});

test('summarizeCi turns red when a runner of this PC sits idle while jobs wait', () => {
  const runs = [run('queued')];
  const live = liveJobs(runs, new Set(['pc']));
  assert.deepEqual(summarizeCi(pcUp, orgWith(runs), live, { idle: ['pc'], waiting: live }), {
    tone: 'bad',
    text: 'pc sits idle while 1 job waits on GitHub',
  });
});

test('the idle alert counts only the waiting jobs the idle runner could take', () => {
  const runs = [1, 2, 3].map((id) => ({ ...run('queued'), id }));
  const live = liveJobs(runs, new Set(['pc']));
  assert.equal(live.length, 3);
  assert.deepEqual(summarizeCi(pcUp, orgWith(runs), live, { idle: ['pc'], waiting: live.slice(0, 1) }), {
    tone: 'bad',
    text: 'pc sits idle while 1 job waits on GitHub',
  });
});
