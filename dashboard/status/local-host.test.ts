import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocalHost } from './local-host.ts';

test('localhost, 127.0.0.1 and [::1] pass, with or without a port', () => {
  for (const host of ['localhost', 'localhost:4280', '127.0.0.1:4281', 'LOCALHOST:4280', '[::1]:4280'])
    assert.equal(isLocalHost(host), true, host);
});

test('a rebound name, a missing Host and look-alikes are refused', () => {
  for (const host of [
    null,
    '',
    'rebind.example:4280',
    'localhost.example',
    '127.0.0.1.example:4280',
    'localhost:4280@evil',
  ])
    assert.equal(isLocalHost(host), false, String(host));
});
