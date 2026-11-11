import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';

const wrapper = join(import.meta.dirname, '..', '..', 'runner', 'gh');
const hasSh = (() => {
  try {
    execFileSync('sh', ['-c', 'exit 0']);
    return true;
  } catch {
    return false;
  }
})();

// A fake gh that fails with the given stderr on its first call and passes after, and a sleep that returns at once.
function runWrapper(firstError: string, args: string[], input = '') {
  const dir = mkdtempSync(join(tmpdir(), 'gh-retry-'));
  writeFileSync(
    join(dir, 'gh'),
    [
      '#!/bin/sh',
      `n=$(cat "${dir.replaceAll('\\', '/')}/calls" 2>/dev/null || echo 0)`,
      `echo $((n + 1)) >"${dir.replaceAll('\\', '/')}/calls"`,
      `cat >>"${dir.replaceAll('\\', '/')}/stdin"`,
      `[ "$n" = 0 ] && { echo "${firstError}" >&2; exit 1; }`,
      'exit 0',
    ].join('\n'),
    { mode: 0o755 },
  );
  writeFileSync(join(dir, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return new Promise<{ calls: number; stdin: string }>((resolve) => {
    const child = execFile(
      'sh',
      [wrapper, ...args],
      { env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` } },
      () =>
        resolve({
          calls: Number(readFileSync(join(dir, 'calls'), 'utf8')),
          stdin: readFileSync(join(dir, 'stdin'), 'utf8'),
        }),
    );
    child.stdin?.end(input);
  });
}

test('gh retries a call whose host name did not resolve', { skip: !hasSh }, async () => {
  // gh prints this, not "no such host", when DNS fails.
  const result = await runWrapper('error connecting to api.github.com', ['api', 'meta']);
  assert.equal(result.calls, 2);
});

test('gh retries a refused connect', { skip: !hasSh }, async () => {
  const result = await runWrapper('dial tcp 140.82.112.6:443: connectex: refused', ['api', 'meta']);
  assert.equal(result.calls, 2);
});

test('gh returns a 4xx at once', { skip: !hasSh }, async () => {
  const result = await runWrapper('HTTP 422: Validation Failed', ['api', 'x']);
  assert.equal(result.calls, 1);
});
