import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// The clean scripts repeat what runner/install.ps1 sets up. A change there that
// misses them fails here, and AGENTS.md names the scripts to update.
const repo = join(import.meta.dirname, '..', '..');
const read = (file: string) => readFileSync(join(repo, file), 'utf8');
const line = (source: string, name: string) => new RegExp(`^\\$${name} = .*$`, 'm').exec(source)?.[0];

const install = read('runner/install.ps1');
const cleanCi = read('windows/clean-ci.ps1');

test('CLEAN-CI.cmd empties the work root that runner/install.ps1 sets', () => {
  assert.ok(line(install, 'workRoot'));
  assert.equal(line(cleanCi, 'workRoot'), line(install, 'workRoot'));
  // Two missing lines are equal too, so the org line has to be there.
  assert.ok(line(install, 'org'));
  assert.equal(line(cleanCi, 'org'), line(install, 'org'));
});

test('the Defender exclusions and the watchdog read the work root and the org as runner/install.ps1 does', () => {
  assert.equal(line(read('windows/defender-exclusions.ps1'), 'workRoot'), line(install, 'workRoot'));
  // The watchdog sets the org inside a function, so its line is indented.
  assert.ok(read('windows/runner-watchdog.ps1').includes(line(install, 'org') ?? 'no org line'));
});

test('CLEAN-CI.cmd stops the runner tasks that runner/install.ps1 registers', () => {
  assert.match(install, /Task = "GitHub Actions runner \(\$org\$taskSuffix\)"/);
  assert.match(cleanCi, /TaskName -like "GitHub Actions runner \(\$org\*\)"/);
});

test('runner/install.ps1 copies the clean hook and points each runner at it', () => {
  assert.match(install, /Join-Path \$PSScriptRoot 'clean-work\.ps1'/);
  assert.match(install, /ACTIONS_RUNNER_HOOK_JOB_STARTED = \$cleanHook/);
  assert.match(read('CLEAN-CI.cmd'), /windows\\clean-ci\.ps1/);
});

// A folder that a process holds fails its move. Without the finally every runner stayed stopped.
test('CLEAN-CI.cmd starts the runner tasks again when a move fails', () => {
  assert.match(cleanCi, /\} finally \{[^}]*\$tasks \| Start-ScheduledTask/);
  assert.equal(cleanCi.match(/Start-ScheduledTask/g)?.length, 1);
});
