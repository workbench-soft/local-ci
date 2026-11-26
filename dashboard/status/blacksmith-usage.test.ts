import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createdSince } from './blacksmith-usage.ts';

test('the first count of a month reads the whole month', () => {
  assert.equal(createdSince({ month: '2026-11', runs: {} }), '2026-11-01T00:00:00Z');
});

test('a later count reads the runs since the last one, less 12 hours', () => {
  const ledger = { month: '2026-11', runs: {}, checkedAt: '2026-11-26T05:30:12.345Z' };
  assert.equal(createdSince(ledger), '2026-11-25T17:30:12Z');
});

test('the look back stops at the start of the month', () => {
  const ledger = { month: '2026-12', runs: {}, checkedAt: '2026-12-01T03:00:00.000Z' };
  assert.equal(createdSince(ledger), '2026-12-01T00:00:00Z');
});
