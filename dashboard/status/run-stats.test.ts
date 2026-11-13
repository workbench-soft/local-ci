import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryRun } from './run-history-file.ts';
import { recentFailRate, statsKey, workflowStats } from './run-stats.ts';

const now = Date.parse('2026-11-13T12:00:00Z');
const run = (id: number, daysAgo: number, conclusion: string, minutes = 10): HistoryRun => {
  const created = new Date(now - daysAgo * 86_400_000).toISOString();
  return {
    id,
    attempt: 1,
    repo: 'keeppad',
    workflow: 'Release',
    branch: 'main',
    event: 'push',
    conclusion,
    createdAt: created,
    startedAt: created,
    endedAt: new Date(Date.parse(created) + minutes * 60_000).toISOString(),
    url: `https://github.com/acme/keeppad/actions/runs/${id}`,
  };
};

test('workflowStats counts 30 days of one workflow and leaves skipped and older runs out', () => {
  const runs = [
    run(1, 1, 'success', 10),
    run(2, 2, 'success', 20),
    run(3, 3, 'failure'),
    run(4, 4, 'skipped'),
    run(5, 40, 'failure'),
  ];
  const stats = workflowStats(runs, now).get(statsKey('keeppad', 'Release'));
  assert.deepEqual(stats, {
    repo: 'keeppad',
    days: 30,
    runs: 3,
    failed: 1,
    failRate: 1 / 3,
    medianMs: 600_000,
    p90Ms: 1_200_000,
  });
});

test('recentFailRate looks at the last 7 days and skips cancelled runs', () => {
  const runs = [run(1, 1, 'success'), run(2, 2, 'failure'), run(3, 3, 'cancelled'), run(4, 10, 'failure')];
  assert.equal(recentFailRate(runs, now), 0.5);
  assert.equal(recentFailRate([], now), null);
});
