import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasUnfinishedRelease } from './release-dispatch-guard.ts';

test('a queued, requested, pending, waiting, or running release blocks another dispatch', () => {
  for (const status of ['queued', 'requested', 'pending', 'waiting', 'in_progress']) {
    assert.equal(hasUnfinishedRelease([{ status: 'completed' }, { status }]), true, status);
  }
});

test('completed and missing release runs do not block a new release', () => {
  assert.equal(hasUnfinishedRelease([]), false);
  assert.equal(hasUnfinishedRelease([{ status: 'completed' }]), false);
});
