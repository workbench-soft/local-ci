import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { localBuildOf } from './local-build-target.ts';

async function workspace(scripts: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'local-build-target-'));
  for (const script of scripts) {
    await mkdir(join(root, script, '..'), { recursive: true });
    await writeFile(join(root, script), '');
  }
  return root;
}

test('finds the build script of an app by the repo layout', async () => {
  const root = await workspace([
    'memories/apps/mobile/scripts/build-apk.sh',
    'memories/apps/shuttrix/scripts/build-apk.sh',
    'tickalot/scripts/build-apk.sh',
    'app-updater/scripts/build-apk.sh',
  ]);
  assert.deepEqual(await localBuildOf('memories-mobile', root), { repo: 'memories', dir: 'apps/mobile' });
  assert.deepEqual(await localBuildOf('shuttrix', root), { repo: 'memories', dir: 'apps/shuttrix' });
  assert.deepEqual(await localBuildOf('tickalot', root), { repo: 'tickalot', dir: '.' });
  assert.deepEqual(await localBuildOf('updater', root), { repo: 'app-updater', dir: '.' });
});

test('gives no build for an app without a script or with a path in its name', async () => {
  const root = await workspace(['tickalot/scripts/build-apk.sh']);
  assert.equal(await localBuildOf('media-organizer', root), null);
  assert.equal(await localBuildOf('songfactory', root), null);
  assert.equal(await localBuildOf('../tickalot', root), null);
});
