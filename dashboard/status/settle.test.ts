import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settled } from './settle.ts';

test('an action that answers keeps its result', async () => {
  assert.deepEqual(await settled(Promise.resolve({ ok: true as const })), { ok: true });
});

test('an action that rejects, as when the page server is down, turns into an error the button shows', async () => {
  assert.deepEqual(await settled(Promise.reject(new TypeError('Failed to fetch'))), {
    ok: false,
    error: 'Failed to fetch',
  });
  assert.deepEqual(await settled(Promise.reject('offline')), { ok: false, error: 'offline' });
});
