import assert from 'node:assert/strict';
import { test } from 'node:test';
import { purgeRun, purgeRuns, type RunApi } from './purge.ts';

const instant = { pollMs: 1, timeoutMs: 50, sleep: async () => {} };

function fakeRun(statuses: string[], options: { cancelFails?: boolean } = {}) {
  const calls: string[] = [];
  let index = 0;
  const api: RunApi = {
    status: async () => statuses[Math.min(index++, statuses.length - 1)],
    forceCancel: async () => {
      calls.push('force-cancel');
      if (options.cancelFails) throw new Error('GitHub answered 409');
    },
    remove: async () => {
      calls.push('delete');
    },
  };
  return { api, calls };
}

test('a finished run is deleted without a cancel', async () => {
  const { api, calls } = fakeRun(['completed']);
  await purgeRun(api, instant);
  assert.deepEqual(calls, ['delete']);
});

test('a running run is force cancelled, waited on, then deleted', async () => {
  const { api, calls } = fakeRun(['in_progress', 'in_progress', 'completed']);
  await purgeRun(api, instant);
  assert.deepEqual(calls, ['force-cancel', 'delete']);
});

test('a run that finishes before the cancel is still deleted', async () => {
  const { api, calls } = fakeRun(['in_progress', 'completed'], { cancelFails: true });
  await purgeRun(api, instant);
  assert.deepEqual(calls, ['force-cancel', 'delete']);
});

test('a refused cancel of a running run throws and deletes nothing', async () => {
  const { api, calls } = fakeRun(['in_progress'], { cancelFails: true });
  await assert.rejects(purgeRun(api, instant), /409/);
  assert.deepEqual(calls, ['force-cancel']);
});

test('a run that keeps running past the timeout is left in place', async () => {
  const { api, calls } = fakeRun(['in_progress']);
  await assert.rejects(purgeRun(api, { ...instant, timeoutMs: 0 }), /didn't stop/);
  assert.deepEqual(calls, ['force-cancel']);
});

test('purgeRuns purges every run and returns the ones that failed', async () => {
  const done: number[] = [];
  const failures = await purgeRuns([1, 2, 3, 4], async (run) => {
    if (run === 3) throw new Error('GitHub answered 403');
    done.push(run);
  });
  assert.deepEqual(done.toSorted(), [1, 2, 4]);
  assert.deepEqual(failures, [{ run: 3, error: 'GitHub answered 403' }]);
});

test('purgeRuns keeps at most the given number of purges going', async () => {
  let running = 0;
  let most = 0;
  await purgeRuns(
    [1, 2, 3, 4, 5, 6, 7],
    async () => {
      most = Math.max(most, ++running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running--;
    },
    3,
  );
  assert.equal(most, 3);
});
