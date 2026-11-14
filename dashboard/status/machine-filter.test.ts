import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kindOfRunner, machineOf, touches } from './machine-filter.ts';

test('the address wins over the cookie, and all clears the pick', () => {
  assert.equal(machineOf('oracle', 'pc'), 'oracle');
  assert.equal(machineOf(undefined, 'blacksmith'), 'blacksmith');
  assert.equal(machineOf('all', 'pc'), null);
  assert.equal(machineOf(undefined, 'nonsense'), null);
  assert.equal(machineOf(['pc', 'oracle'], undefined), null);
});

test('a run touches the pick when one of its jobs ran there', () => {
  assert.equal(touches(['pc', 'oracle'], 'oracle'), true);
  assert.equal(touches(['pc'], 'github'), false);
  assert.equal(touches(undefined, 'pc'), false);
  assert.equal(touches(undefined, null), true);
});

test('a runner gets its machine from its folder, name or labels', () => {
  assert.equal(kindOfRunner(true, null), 'pc');
  assert.equal(kindOfRunner(false, { name: 'oracle-1', labels: ['self-hosted', 'Linux'] }), 'oracle');
  assert.equal(kindOfRunner(false, { name: 'mac', labels: ['self-hosted', 'macOS'] }), 'other');
});
