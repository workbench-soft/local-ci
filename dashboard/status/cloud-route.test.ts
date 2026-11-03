import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blacksmithHeavy,
  blacksmithLight,
  blacksmithWindows,
  type CloudState,
  githubLinux,
  githubWindows,
  localHeavy,
  localLight,
  oracleLight,
  pickRoutes,
  stuckOnBlacksmith,
  variablesToSet,
} from './cloud-route.ts';
import { blacksmithCpus, kindOfJob, kindsOfRun } from './runner-kind.ts';

const state: CloudState = {
  oracleOnline: false,
  blacksmithOn: true,
  blacksmithUsed: 100,
  blacksmithBudget: 2700,
  githubUsed: 500,
  githubBudget: 1800,
};
const lanes = (changed: Partial<CloudState> = {}) => {
  const routes = pickRoutes({ ...state, ...changed });
  return [routes.light, routes.heavy, routes.windows];
};

test('Blacksmith takes every lane while its minutes last, Oracle online or not', () => {
  assert.deepEqual(lanes(), [blacksmithLight, blacksmithHeavy, blacksmithWindows]);
  assert.deepEqual(lanes({ oracleOnline: true }), [blacksmithLight, blacksmithHeavy, blacksmithWindows]);
  assert.match(pickRoutes(state).why, /2600 of 2700 minutes left/);
});

test('Oracle takes only the light lane once Blacksmith runs out', () => {
  assert.deepEqual(lanes({ blacksmithUsed: 2700, oracleOnline: true }), [oracleLight, githubLinux, githubWindows]);
});

test('GitHub runners come next, then this PC', () => {
  assert.deepEqual(lanes({ blacksmithOn: false }), [githubLinux, githubLinux, githubWindows]);
  for (const githubUsed of [1800, null])
    assert.deepEqual(lanes({ blacksmithOn: false, githubUsed }), [localLight, localHeavy, localHeavy]);
});

test('only variables with other labels get set', () => {
  const routes = pickRoutes(state);
  const current = {
    CI_RUNNER: JSON.stringify(blacksmithLight),
    CI_HEAVY_RUNNER: '["self-hosted","heavy"]',
    CI_WINDOWS_RUNNER: JSON.stringify(blacksmithWindows),
  };
  assert.deepEqual(variablesToSet(current, routes), [['CI_HEAVY_RUNNER', JSON.stringify(blacksmithHeavy)]]);
  assert.equal(variablesToSet({}, routes).length, 3);
});

test('a job queued on Blacksmith over 5 minutes marks its run stuck', () => {
  const now = Date.parse('2026-11-02T10:00:00Z');
  const run = (id: number, createdAt: string, labels: string[]) => ({
    id,
    createdAt,
    jobs: [{ status: 'queued', labels, startedAt: null }],
  });
  const runs = [
    run(1, '2026-11-02T09:50:00Z', blacksmithHeavy),
    run(2, '2026-11-02T09:58:00Z', blacksmithHeavy),
    run(3, '2026-11-02T09:50:00Z', localHeavy),
  ];
  assert.deepEqual(
    stuckOnBlacksmith(runs, now).map((item) => item.id),
    [1],
  );
});

test('a job names the machine it built on', () => {
  const local = new Set(['PC', 'PC-2']);
  const of = (runnerName: string | null, labels: string[]) => kindOfJob({ runnerName, labels }, local);
  assert.equal(of('PC-2', localHeavy), 'pc');
  assert.equal(of('oracle-1', ['self-hosted', 'Linux', 'ARM64', 'oracle']), 'oracle');
  assert.equal(of('blacksmith-4vcpu-ubuntu-2404-abc', blacksmithHeavy), 'blacksmith');
  assert.equal(of(null, blacksmithLight), 'blacksmith');
  assert.equal(of('GitHub Actions 12', ['ubuntu-latest']), 'github');
  assert.equal(of(null, ['ubuntu-latest']), 'github');
  assert.equal(of(null, localLight), 'pc');
  assert.equal(of('mac-mini', ['self-hosted', 'macOS']), 'other');
  assert.deepEqual(
    kindsOfRun(
      [
        { runnerName: 'PC', labels: localLight },
        { runnerName: 'PC-2', labels: localLight },
        { runnerName: null, labels: blacksmithHeavy },
      ],
      local,
    ),
    ['pc', 'blacksmith'],
  );
});

test('the vCPU count comes from the Blacksmith label', () => {
  assert.equal(blacksmithCpus(blacksmithHeavy), 4);
  assert.equal(blacksmithCpus(localLight), null);
});

test('a Blacksmith job counts its minutes rounded up, times its vCPUs over 2', async () => {
  const { jobMinutes } = await import('./blacksmith-usage.ts');
  const job = (labels: string[], seconds: number) => ({
    labels,
    started_at: '2026-11-02T10:00:00Z',
    completed_at: new Date(Date.parse('2026-11-02T10:00:00Z') + seconds * 1000).toISOString(),
  });
  assert.equal(jobMinutes(job(blacksmithLight, 61)), 2);
  assert.equal(jobMinutes(job(blacksmithHeavy, 600)), 20);
  assert.equal(jobMinutes(job(localHeavy, 600)), 0);
  assert.equal(jobMinutes(job(['blacksmith-4vcpu-windows-2025'], 600)), 40);
});

test('GitHub minutes count every repo, Windows twice and macOS 10 times', async () => {
  const { quotaMinutes } = await import('./github-usage.ts');
  const item = (sku: string, quantity: number, unitType = 'Minutes') => ({
    product: 'actions',
    unitType,
    sku,
    quantity,
  });
  const items = [
    item('Actions Linux', 1338),
    item('Actions Windows', 256),
    item('Actions macOS 3-core', 8),
    item('Actions storage', 127, 'GigabyteHours'),
  ];
  assert.equal(quotaMinutes(items), 1930);
});

test('running GitHub jobs count their minutes so far, weighted, and PC jobs count none', async () => {
  const { runningMinutes } = await import('./github-usage.ts');
  const now = Date.parse('2026-11-03T07:00:00Z');
  const job = (labels: string[], startedAt: string, status = 'in_progress') => ({ labels, startedAt, status });
  const runs = [
    { jobs: [job(githubLinux, '2026-11-03T06:50:00Z'), job(githubWindows, '2026-11-03T06:55:00Z')] },
    { jobs: [job(localHeavy, '2026-11-03T06:00:00Z'), job(githubLinux, '2026-11-03T06:00:00Z', 'completed')] },
  ] as unknown as Parameters<typeof runningMinutes>[0];
  assert.equal(runningMinutes(runs, now), 10 + 5 * 2);
});

test('jobs move to the PC labels once billed and running minutes reach the free 2000 less the margin', () => {
  const stop = { blacksmithOn: false, githubBudget: 2000 - 300 };
  assert.deepEqual(lanes({ ...stop, githubUsed: 1699 }), [githubLinux, githubLinux, githubWindows]);
  assert.deepEqual(lanes({ ...stop, githubUsed: 1700 }), [localLight, localHeavy, localHeavy]);
  assert.deepEqual(lanes({ ...stop, githubUsed: 1930 }), [localLight, localHeavy, localHeavy]);
});
