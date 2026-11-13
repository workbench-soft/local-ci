import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type HistoryRun, mergeRuns } from './run-history-file.ts';
import { summarizeJobs } from './run-history.ts';
import { computeTrends, dayKey, outcomeOf, percentile } from './trends.ts';

const now = Date.parse('2026-11-13T12:00:00');
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

function run(id: number, hours: number, conclusion: string, extra: Partial<HistoryRun> = {}): HistoryRun {
  const created = hoursAgo(hours);
  return {
    id,
    attempt: 1,
    repo: 'memories',
    workflow: 'Checks',
    branch: 'main',
    event: 'push',
    conclusion,
    createdAt: created,
    startedAt: created,
    endedAt: new Date(Date.parse(created) + 10 * 60_000).toISOString(),
    url: `https://github.com/acme/memories/actions/runs/${id}`,
    ...extra,
  };
}

test('percentile takes the nearest rank', () => {
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([5, 1, 3], 0.5), 3);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9), 9);
});

test('a skipped run counts as no outcome, a timeout as a failure', () => {
  assert.equal(outcomeOf({ conclusion: 'skipped' }), null);
  assert.equal(outcomeOf({ conclusion: 'timed_out' }), 'failure');
  assert.equal(outcomeOf({ conclusion: 'cancelled' }), 'cancelled');
});

test('computeTrends counts each day and leaves cancelled runs out of the fail rate', () => {
  const runs = [
    run(1, 1, 'success'),
    run(2, 2, 'failure', {
      jobs: { kinds: ['pc'], failedJob: 'lint', failedStep: 'Lint', failedUrl: 'https://x/job', waitMs: 4000 },
    }),
    run(3, 3, 'cancelled'),
    run(4, 4, 'skipped'),
    run(5, 30, 'success', { repo: 'tickalot' }),
  ];
  const trends = computeTrends(runs, { now, days: 7 });
  assert.equal(trends.days.length, 7);
  const today = trends.days.at(-1)!;
  assert.equal(today.key, dayKey(now));
  assert.deepEqual([today.success, today.failure, today.cancelled], [1, 1, 1]);
  assert.equal(today.build.median, 600_000);
  assert.equal(trends.now.runs, 4);
  assert.equal(trends.now.failRate, 1 / 3);
  assert.equal(trends.now.wait, 4000);
  assert.equal(trends.before, null);
  assert.deepEqual(
    trends.steps.map((row) => [row.job, row.step, row.count]),
    [['lint', 'Lint', 1]],
  );
  assert.deepEqual(
    trends.machines.map((row) => [row.kind, row.runs, row.failed]),
    [['pc', 1, 1]],
  );
  assert.deepEqual(trends.repos, ['memories', 'tickalot']);
  assert.equal(computeTrends(runs, { now, days: 7, repo: 'tickalot' }).now.runs, 1);
});

test('computeTrends compares with the period before once the history reaches it', () => {
  const runs = [run(1, 1, 'success'), run(2, 24 * 10, 'failure')];
  const trends = computeTrends(runs, { now, days: 7, coveredFrom: now - 90 * 86_400_000 });
  assert.deepEqual(trends.before, { runs: 1, failRate: 1, build: null, wait: null });
});

test('mergeRuns keeps the jobs of an unchanged run and drops them for a rerun', () => {
  const jobs = { kinds: ['github' as const], failedJob: null, failedStep: null, failedUrl: null, waitMs: 1 };
  const kept = [run(1, 1, 'failure', { jobs }), run(2, 24 * 100, 'success')];
  const same = mergeRuns(kept, [run(1, 1, 'failure')], now);
  assert.equal(same.length, 1);
  assert.deepEqual(same[0].jobs, jobs);
  const rerun = mergeRuns(kept, [run(1, 1, 'success', { attempt: 2 })], now);
  assert.equal(rerun[0].jobs, undefined);
  assert.equal(mergeRuns(rerun, [run(1, 1, 'failure')], now)[0].attempt, 2);
});

test('summarizeJobs names the failed step, the machine and the wait for the first job', () => {
  const summary = summarizeJobs(
    [
      {
        name: 'build',
        conclusion: 'success',
        runner_name: 'BUILD-PC',
        labels: ['self-hosted'],
        started_at: '2026-11-13T10:00:30Z',
        html_url: 'a',
      },
      {
        name: 'test',
        conclusion: 'failure',
        runner_name: 'GitHub Actions 3',
        labels: ['ubuntu-latest'],
        started_at: '2026-11-13T10:02:00Z',
        html_url: 'b',
        steps: [
          { name: 'Checkout', conclusion: 'success' },
          { name: 'Unit tests', conclusion: 'failure' },
        ],
      },
    ],
    '2026-11-13T10:00:00Z',
    new Set(['BUILD-PC']),
  );
  assert.deepEqual(summary, {
    kinds: ['pc', 'github'],
    failedJob: 'test',
    failedStep: 'Unit tests',
    failedUrl: 'b',
    waitMs: 30_000,
  });
});
