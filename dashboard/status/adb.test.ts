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
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
