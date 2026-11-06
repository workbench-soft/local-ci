import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDevKeyConfigured } from './dev-key.ts';

test('only an existing 64-character hexadecimal developer key is ready', () => {
  assert.equal(isDevKeyConfigured('A'.repeat(64)), true);
  assert.equal(isDevKeyConfigured('a4'.repeat(32)), true);
  assert.equal(isDevKeyConfigured(undefined), false);
  assert.equal(isDevKeyConfigured(''), false);
  assert.equal(isDevKeyConfigured('A'.repeat(63)), false);
  assert.equal(isDevKeyConfigured('A'.repeat(65)), false);
  assert.equal(isDevKeyConfigured('z'.repeat(64)), false);
  assert.equal(isDevKeyConfigured('a'.repeat(63) + '\n'), false);
});
