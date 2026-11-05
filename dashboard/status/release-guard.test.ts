import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
function guard(result: string) {
  return spawnSync(
    'bash',
    [
      '-c',
      'gh() { [[ "$2" == "repos/demo/app/actions/workflows/desktop-checks.yml/runs?head_sha=expected-sha&per_page=100" ]] || return 9; printf "%s\\n" "$MOCK_RESULT"; }; export -f gh; bash .github/scripts/wait-for-checks.sh',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_REPOSITORY: 'demo/app',
        GITHUB_SHA: 'expected-sha',
        GITHUB_REF_NAME: 'main',
        CHECKS_WORKFLOW: 'desktop-checks.yml',
        MOCK_RESULT: result,
      },
    },
  );
}

test('publication guard queries the matching workflow and commit', () => {
  const result = guard('success');
  assert.equal(result.status, 0, result.stderr);
});

test('failed or cancelled matching checks block publication', () => {
  for (const status of ['failure', 'cancelled', 'timed_out', 'skipped']) {
    const result = guard(status);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /Publication stopped/);
  }
});
