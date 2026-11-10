import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { installThenRemove } from './adb.ts';

test('a downloaded APK goes once its install ends, whether it worked or threw', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'local-ci-adb-test-'));
  try {
    const file = join(folder, 'app-2026.11.10.1.apk');
    await writeFile(file, 'apk');
    assert.deepEqual(await installThenRemove(file, async () => ({ ok: true, device: 'phone' })), {
      ok: true,
      device: 'phone',
    });
    assert.equal(existsSync(file), false);

    await writeFile(file, 'apk');
    await assert.rejects(
      installThenRemove(file, async () => {
        throw new Error('adb timed out');
      }),
      /adb timed out/,
    );
    assert.equal(existsSync(file), false);

    // An install in its own folder takes the folder with it, so a second install keeps its file.
    const own = await mkdtemp(join(folder, 'i-'));
    const other = await mkdtemp(join(folder, 'i-'));
    await writeFile(join(own, 'app.apk'), 'apk');
    await writeFile(join(other, 'app.apk'), 'apk');
    await installThenRemove(own, async () => ({ ok: true, device: 'phone' }));
    assert.equal(existsSync(own), false);
    assert.equal(existsSync(join(other, 'app.apk')), true);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
