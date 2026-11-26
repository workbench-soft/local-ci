import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetLine, kindOf, noteAnswer, quotaLow } from './github-budget.ts';

const answer = (status: number, remaining: number, reset = 2_000_000_000) => ({
  status,
  headers: new Headers({
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': String(remaining),
    'x-ratelimit-reset': String(reset),
  }),
});

test('a kind groups the calls of every repo and id', () => {
  assert.equal(
    kindOf('/repos/workbench-soft/memories/actions/runs/123/jobs?per_page=100'),
    '/repos/R/actions/runs/N/jobs',
  );
  assert.equal(kindOf('/orgs/workbench-soft/repos?per_page=100&page=2'), '/orgs/workbench-soft/repos');
});

test('a 304 costs nothing, and the line counts the paid calls most first', () => {
  budgetLine();
  noteAnswer('/repos/o/a/actions/runs?per_page=30', answer(200, 4000));
  noteAnswer('/repos/o/b/actions/runs?per_page=30', answer(200, 3999));
  noteAnswer('/repos/o/a/actions/runs/1/jobs', answer(200, 3998));
  noteAnswer('/repos/o/a/actions/runs/2/jobs', answer(304, 3998));
  const line = budgetLine();
  assert.match(line, /: 3, 3998 of 5000 left\. 2 \/repos\/R\/actions\/runs, 1 \/repos\/R\/actions\/runs\/N\/jobs$/);
  assert.match(budgetLine(), /: 0, /);
});

test('the quota is low below 30% until its reset', () => {
  noteAnswer('/x', answer(200, 1600, 1000));
  assert.equal(quotaLow(999_000), false);
  noteAnswer('/x', answer(200, 1400, 1000));
  assert.equal(quotaLow(999_000), true);
  assert.equal(quotaLow(1_000_000), false);
});
