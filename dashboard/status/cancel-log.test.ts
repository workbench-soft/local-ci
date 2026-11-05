import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readCancels, recordCancel } from './cancel-log.ts';

const file = join(tmpdir(), `local-ci-cancel-log-${process.pid}-${Date.now()}.jsonl`);
process.env.CANCEL_REASONS_FILE = file;

test.after(() => rm(file, { force: true }));

test('a missing file reads as no cancels', async () => {
  assert.equal((await readCancels()).size, 0);
});

test('each cancel appends its reason with the time', async () => {
  await recordCancel('tickalot', 101, 'a newer run replaced it');
  await recordCancel('keeppad', 202, 'Stopped from the page');
  assert.equal((await readFile(file, 'utf8')).trim().split('\n').length, 2);
  const cancels = await readCancels();
  assert.equal(cancels.get(101)?.words, 'a newer run replaced it');
  assert.equal(cancels.get(202)?.words, 'Stopped from the page');
  assert.ok(cancels.get(202)?.at);
});

test('the latest reason of a run wins', async () => {
  await recordCancel('tickalot', 101, 'Stopped from the page');
  assert.equal((await readCancels()).get(101)?.words, 'Stopped from the page');
});

test('a short line the file lost reads as no cancel of that run', async () => {
  await writeFile(file, '{"repo":"tickalot","runId":3', 'utf8');
  assert.equal((await readCancels()).size, 0);
});
