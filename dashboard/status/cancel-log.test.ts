import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loggedCancellation, readCancels, recordCancel } from './cancel-log.ts';

const file = join(tmpdir(), `local-ci-cancel-log-${process.pid}-${Date.now()}.jsonl`);
process.env.CANCEL_REASONS_FILE = file;

test.after(() => rm(file, { force: true }));

test('a missing file reads as no cancels', async () => {
  assert.equal((await readCancels()).size, 0);
});

test('each cancel appends its reason with the time', async () => {
  await recordCancel('tickalot', 101, 'a newer run replaced it');
  await recordCancel('keeppad', 202, 'Stopped from the page');
  assert.equal((await readFile(file, 'utf8')).split('\n').filter(Boolean).length, 2);
  const cancels = await readCancels();
  assert.equal(cancels.get(101)?.words, 'a newer run replaced it');
  assert.equal(cancels.get(202)?.words, 'Stopped from the page');
  assert.ok(cancels.get(202)?.at);
});

test('the latest reason of a run wins', async () => {
  await recordCancel('tickalot', 101, 'Stopped from the page');
  assert.equal((await readCancels()).get(101)?.words, 'Stopped from the page');
});

test('replacement evidence survives saving and reloading', async () => {
  const cause = {
    kind: 'superseded' as const,
    runId: 303,
    url: 'https://github.com/workbench-soft/app/actions/runs/303',
    sha: 'abc123',
    branch: 'main',
    pullRequests: [{ number: 7, url: 'https://github.com/workbench-soft/app/pull/7' }],
  };
  await recordCancel('app', 302, 'New commit', { cause, outcome: 'requested' });
  await recordCancel('app', 302, 'New commit', { cause, outcome: 'accepted' });
  assert.deepEqual((await readCancels()).get(302)?.cause, cause);
  assert.equal((await readCancels()).get(302)?.outcome, 'accepted');
});

test('a short line the file lost reads as no cancel of that run', async () => {
  await writeFile(file, '{"repo":"tickalot","runId":3', 'utf8');
  assert.equal((await readCancels()).size, 0);
});

test('a cancellation request is durable before the external call and records refusal', async () => {
  await assert.rejects(
    loggedCancellation('app', 401, 'Checks failed', { kind: 'checks-failed' }, async () => {
      assert.equal((await readCancels()).get(401)?.outcome, 'requested');
      throw new Error('refused');
    }),
    /refused/,
  );
  assert.equal((await readCancels()).get(401)?.outcome, 'failed');
});

test('a failed log write prevents cancellation and later requests recover', async () => {
  const original = process.env.CANCEL_REASONS_FILE;
  process.env.CANCEL_REASONS_FILE = join(file, 'not-a-folder.jsonl');
  let called = false;
  try {
    await assert.rejects(
      loggedCancellation('app', 402, 'Stop', { kind: 'manual' }, async () => {
        called = true;
      }),
    );
    assert.equal(called, false);
  } finally {
    process.env.CANCEL_REASONS_FILE = original;
  }
  await recordCancel('app', 403, 'Recovered');
  assert.equal((await readCancels()).get(403)?.words, 'Recovered');
});
