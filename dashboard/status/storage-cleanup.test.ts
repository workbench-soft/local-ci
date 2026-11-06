import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apkAppOf, obsoleteApkReleases, oldArtifacts, type StoredRelease } from './storage-cleanup.ts';

const release = (
  id: number,
  tag_name: string,
  published_at: string,
  names: string[] = ['app.apk'],
  extra: Partial<StoredRelease> = {},
): StoredRelease => ({
  id,
  tag_name,
  created_at: published_at,
  published_at,
  draft: false,
  prerelease: false,
  assets: names.map((name) => ({ name })),
  ...extra,
});

test('deletes completed-run artifacts but protects live-run files and expired ones', () => {
  assert.deepEqual(
    oldArtifacts(
      [
        { id: 1, size_in_bytes: 123, expired: false, workflow_run: { id: 5 } },
        { id: 2, size_in_bytes: 456, expired: false, workflow_run: { id: 6 } },
        { id: 3, size_in_bytes: 99, expired: true },
        { id: 4, size_in_bytes: 55, expired: false },
      ],
      new Set([5]),
    ).map((x) => x.id),
    [2, 4],
  );
});

test('keeps one latest APK release per app in the shared releases repo', () => {
  const items = [
    release(1, 'guitar-upscale-v2026.11.01.1', '2026-11-01T12:00:00Z', ['guitar.apk', 'tuner.apk']),
    release(2, 'skyaltar-v2026.11.01.1', '2026-11-01T13:00:00Z'),
    release(3, 'guitar-upscale-v2026.11.05.1', '2026-11-05T12:00:00Z', ['guitar.apk', 'tuner.apk']),
    release(4, 'skyaltar-v2026.11.06.1', '2026-11-06T12:00:00Z'),
    release(5, 'guitar-upscale-v2026.11.06.1', '2026-11-06T12:00:00Z'),
  ];
  const { obsolete, kept } = obsoleteApkReleases(items);
  assert.deepEqual(obsolete.map((x) => x.id).sort(), [1, 2, 3]);
  assert.deepEqual(kept, [
    { app: 'guitar-upscale', tag: 'guitar-upscale-v2026.11.06.1' },
    { app: 'skyaltar', tag: 'skyaltar-v2026.11.06.1' },
  ]);
});

test('leaves Windows releases, draft releases, prereleases and other tags alone', () => {
  const items = [
    release(1, 'reddit-desk-v1.0.1', '2026-11-01T10:00:00Z', ['setup.exe']),
    release(2, 'reddit-desk-v1.0.2', '2026-11-02T10:00:00Z', ['setup.exe']),
    release(3, 'latest', '2026-11-03T10:00:00Z'),
    release(4, 'memories-v1.0.1', '2026-11-01T10:00:00Z', ['app.apk'], { draft: true }),
    release(5, 'memories-v1.0.2', '2026-11-02T10:00:00Z', ['app.apk'], { prerelease: true }),
  ];
  assert.equal(apkAppOf(items[0]), null);
  assert.deepEqual(obsoleteApkReleases(items), { obsolete: [], kept: [] });
});

test('uses publication time rather than tag creation time and a stable id tie-breaker', () => {
  const items = [
    release(1, 'updater-v1.0', '2026-11-04T10:00:00Z', ['one.apk'], { created_at: '2026-11-06T00:00:00Z' }),
    release(2, 'updater-v1.1', '2026-11-05T10:00:00Z'),
    release(3, 'updater-v1.2', '2026-11-05T10:00:00Z'),
  ];
  assert.deepEqual(
    obsoleteApkReleases(items).obsolete.map((x) => x.id),
    [2, 1],
  );
});
