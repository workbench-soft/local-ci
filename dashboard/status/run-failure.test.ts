import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, logExcerpt } from './run-failure.ts';

test('a PC turned off reads from the shutdown and lost runner annotations', () => {
  const shutdown = classify([
    'The runner has received a shutdown signal. This can happen when the runner service is stopped, or a manually started runner is canceled.',
    'The operation was canceled.',
  ]);
  assert.equal(shutdown.kind, 'shutdown');
  const lost = classify([
    'The self-hosted runner: NIFELHEIM-3 lost communication with the server. Verify the machine is running.',
  ]);
  assert.equal(lost.kind, 'lost-runner');
});

test('a concurrency cancel, a force cancel and a cancel by a person each get their kind', () => {
  const replaced = classify([
    'Canceling since a higher priority waiting request for Release-refs/heads/main exists',
    'The operation was canceled.',
  ]);
  assert.equal(replaced.kind, 'replaced');
  const forced = classify(['The run was canceled forcefully by @workbench-soft-admin.']);
  assert.deepEqual([forced.kind, forced.actor], ['forced', 'workbench-soft-admin']);
  const person = classify(['The run was canceled by @someone.']);
  assert.deepEqual([person.kind, person.actor], ['cancelled-by', 'someone']);
});

test('a full disk and a timeout win over a plain error', () => {
  const disk = classify(["There is not enough space on the disk. : 'C:\\ci\\2\\_actions\\x.js'"]);
  assert.equal(disk.kind, 'disk-full');
  assert.equal(classify(["Failed to create 'event.json' because the disk was full."]).kind, 'disk-full');
  const late = classify(['The job running on runner NIFELHEIM has exceeded the maximum execution time of 60 minutes.']);
  assert.equal(late.kind, 'timeout');
});

test('lint annotations become the message, and the exit code alone stays an error', () => {
  const lint = classify([
    'Process completed with exit code 1.',
    'react(set-state-in-effect): src/trips/TripList.tsx:163:5: Calling setState synchronously within an effect',
  ]);
  assert.equal(lint.kind, 'error');
  assert.match(lint.message ?? '', /^react\(set-state-in-effect\)/);
  assert.equal(classify(['Process completed with exit code 1.']).kind, 'error');
  assert.equal(classify([]).kind, 'unknown');
});

// Cut from the log of farnear Checks run 43329810179, job 131571397502.
const log = [
  '2026-11-12T23:33:45.5291136Z ##[group]Run mise run lint',
  '2026-11-12T23:33:45.5291489Z mise run lint',
  '2026-11-12T23:33:45.5319437Z env:',
  '2026-11-12T23:33:45.5319578Z   MISE_LOG_LEVEL: info',
  '2026-11-12T23:33:45.5321537Z ##[endgroup]',
  '2026-11-12T23:33:55.4327850Z Found 0 warnings and 0 errors.',
  '2026-11-12T23:33:57.3212109Z \x1b[36m[lint]\x1b[0m $ pnpm exec knip',
  '2026-11-12T23:34:05.3072261Z RangeError: Array buffer allocation failed',
  '2026-11-12T23:34:05.3072657Z     at new ArrayBuffer (<anonymous>)',
  '2026-11-12T23:34:05.3082289Z Node.js v24.22.3',
  '2026-11-12T23:34:06.3706299Z [lint] ERROR task failed',
  '2026-11-12T23:34:06.4051865Z ##[error]Process completed with exit code 1.',
  '2026-11-12T23:34:06.4738950Z Post job cleanup.',
].join('\r\n');

test('the log cut holds the failed step from after its env block up to the error', () => {
  const cut = logExcerpt(log);
  assert.ok(cut);
  assert.equal(cut.message, 'RangeError: Array buffer allocation failed');
  const lines = cut.excerpt.split('\n');
  assert.equal(lines[0], 'Found 0 warnings and 0 errors.');
  assert.equal(lines.at(-1), '[lint] ERROR task failed');
  assert.ok(!cut.excerpt.includes('MISE_LOG_LEVEL'));
  assert.ok(!cut.excerpt.includes('\x1b'));
  assert.equal(logExcerpt(log, 2)?.excerpt, 'Node.js v24.22.3\n[lint] ERROR task failed');
  assert.equal(logExcerpt('no error here'), null);
});
