import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRetryRun } from './retry-policy.ts';

test('only completed failed runs offer retry', () => {
  for (const conclusion of ['failure', 'timed_out', 'startup_failure']) {
    assert.equal(canRetryRun('completed', conclusion), true);
    assert.equal(canRetryRun('in_progress', conclusion), false);
    assert.equal(canRetryRun('queued', conclusion), false);
  }
});

test('successful, cancelled and unfinished runs cannot be retried as failures', () => {
  for (const conclusion of ['success', 'cancelled', 'skipped', 'neutral', 'action_required', null]) {
    assert.equal(canRetryRun('completed', conclusion), false);
  }
});
