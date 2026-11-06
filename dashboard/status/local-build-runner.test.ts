import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { isLocalArtifactToken, localArtifact } from './local-build-runner.ts';

test('local APK tokens accept the UUIDs issued by the build', () => {
  assert.equal(isLocalArtifactToken('12345678-1234-4abc-8def-1234567890ab'), true);
  assert.equal(isLocalArtifactToken(randomUUID()), true);
});

test('local APK tokens reject malformed values and unknown builds', async () => {
  for (const token of [null, 1, '', '../artifact.apk', 'a'.repeat(36), '12345678-1234-4abc-8def-1234567890az']) {
    assert.equal(isLocalArtifactToken(token), false);
  }
  assert.equal(await localArtifact(randomUUID()), null);
});
