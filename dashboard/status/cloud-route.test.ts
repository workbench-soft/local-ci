import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blacksmithHeavy,
  blacksmithLight,
  localHeavy,
  localLight,
  oracleLight,
  pickRoutes,
  stuckOnBlacksmith,
  variablesToSet,
} from './cloud-route.ts';
import { blacksmithCpus, kindOfJob, kindsOfRun } from './runner-kind.ts';

const state = { oracleOnline: false, blacksmithOn: true, blacksmithUsed: 100, blacksmithBudget: 2700 };

test('Blacksmith takes both lanes while minutes last', () => {
  const routes = pickRoutes(state);
  assert.deepEqual([routes.light, routes.heavy], [blacksmithLight, blacksmithHeavy]);
  assert.match(routes.why, /2600 of 2700 minutes left/);
});

test('Oracle takes the light lane when it is online', () => {
  const routes = pickRoutes({ ...state, oracleOnline: true });
  assert.deepEqual([routes.light, routes.heavy], [oracleLight, blacksmithHeavy]);
});

test('this PC takes over once the budget is spent or Blacksmith is off', () => {
  for (const changed of [{ blacksmithUsed: 2700 }, { blacksmithOn: false }]) {
    const routes = pickRoutes({ ...state, ...changed });
    assert.deepEqual([routes.light, routes.heavy], [localLight, localHeavy]);
  }
});

test('only variables with other labels get set', () => {
  const routes = pickRoutes(state);
  const current = { CI_RUNNER: JSON.stringify(blacksmithLight), CI_HEAVY_RUNNER: '["self-hosted","heavy"]' };
  assert.deepEqual(variablesToSet(current, routes), [['CI_HEAVY_RUNNER', JSON.stringify(blacksmithHeavy)]]);
  assert.equal(variablesToSet({}, routes).length, 2);
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
});
