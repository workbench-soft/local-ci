import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// The sweep that cancels replaced runs lives in the page. On 2026-11-11 the install
// stopped the page, then built for over an hour on a busy PC, and no run got cancelled.
const repo = join(import.meta.dirname, '..', '..');
const read = (file: string) => readFileSync(join(repo, file), 'utf8');
const install = read('dashboard/install.ps1');

test('dashboard/install.ps1 stops the old page only after the new one is built', () => {
  const build = install.indexOf('pnpm build');
  // The first stop the script runs on its way down. The one inside Stop-Page is indented.
  const stop = install.search(/^(Stop-Page|Stop-ScheduledTask)\b/m);
  assert.ok(build > 0 && stop > 0);
  assert.ok(build < stop, 'the page stops ahead of the build');
});

test('the build goes to a folder of its own, which start.cmd then serves', () => {
  assert.match(read('dashboard/next.config.ts'), /distDir: process\.env\.NEXT_DIST_DIR/);
  assert.match(install, /\$env:NEXT_DIST_DIR = \$buildDir/);
  assert.match(install, /set NEXT_DIST_DIR=\$buildDir/);
  // Next adds a folder missing here to tsconfig.json, and the edit would block the next update.
  for (const dir of ['.next-a', '.next-b'])
    assert.ok(read('dashboard/tsconfig.json').includes(`"${dir}/types/**/*.ts"`));
});

test('windows/update.ps1 starts a page that died', () => {
  assert.match(
    read('windows/update.ps1'),
    /Get-NetTCPConnection -LocalPort \$pagePort[\s\S]{0,200}Start-ScheduledTask -TaskName \$pageTask/,
  );
});
