import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeLocalBuilds, cancelLocalRelease } from './local-build-runner.ts';

test('only tracked builds of configured apps can be cancelled', async () => {
  assert.deepEqual(activeLocalBuilds(), []);
  assert.deepEqual(await cancelLocalRelease('../unknown'), { ok: false, error: 'Unknown local build.' });
  assert.deepEqual(await cancelLocalRelease('shuttrix'), {
    ok: false,
    error: 'No local build of this app is running.',
  });
});
