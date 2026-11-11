import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

test(
  'gh runs once a call that reads a field from stdin, so a retry never sends it empty',
  { skip: !hasSh },
  async () => {
    const result = await runWrapper('dial tcp: connectex: refused', ['api', 'x', '-F', 'body=@-'], 'notes');
    assert.equal(result.calls, 1);
    assert.equal(result.stdin, 'notes');
  },
);

test('gh returns a 4xx at once', { skip: !hasSh }, async () => {
  const result = await runWrapper('HTTP 422: Validation Failed', ['api', 'x']);
  assert.equal(result.calls, 1);
});

// runner/gh sits first on the jobs' PATH as gh, so it has to find the real gh after itself.
function runGh(stub: string, args: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'gh-retry-'));
  const bin = join(root, 'bin');
  const real = join(root, 'real');
  mkdirSync(bin);
  mkdirSync(real);
  copyFileSync(wrapper, join(bin, 'gh'));
  const calls = join(root, 'calls');
  writeFileSync(join(real, 'gh'), `#!/bin/sh\necho call >> "${calls.replaceAll('\\', '/')}"\n${stub}\n`, {
    mode: 0o755,
  });
  const result = spawnSync('sh', [join(bin, 'gh'), ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, PATH: [bin, real, process.env.PATH].join(delimiter) },
  });
  const count = readFileSync(calls, 'utf8').split('\n').filter(Boolean).length;
  return { code: result.status, out: result.stdout, err: result.stderr, count };
}

test('runner/gh skips itself on PATH and passes the real answer through', { skip: !hasSh }, () => {
  const ok = runGh('echo "gh version 2"', ['--version']);
  assert.deepEqual([ok.code, ok.out.trim(), ok.count], [0, 'gh version 2', 1]);
});

test('runner/gh runs a call GitHub answered with an error once', { skip: !hasSh }, () => {
  const missing = runGh('echo "HTTP 404: Not Found" >&2; exit 1', ['api', 'repos/x/y']);
  assert.deepEqual([missing.code, missing.err.trim(), missing.count], [1, 'HTTP 404: Not Found', 1]);
});
