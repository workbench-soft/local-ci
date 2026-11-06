import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Release, releasesByRun, toRelease } from './releases.ts';

const release = (tag: string, createdAt: string): Release => ({
  tag,
  name: tag,
  url: `https://github.com/${tag}`,
  createdAt,
  apk: null,
  notesHtml: '',
});

const run = { id: 1, repo: 'tickalot', createdAt: '2025-10-29T12:00:00Z', updatedAt: '2025-10-29T12:10:00Z' };
const releaseOfRun = (item: typeof run, releases: Release[]) => releasesByRun([item], releases).get(item.id) ?? null;

test('a run owns the release of its repo created while it ran', () => {
  const releases = [
    release('tickalot-v2025.10.29.1', '2025-10-29T11:00:00Z'),
    release('tickalot-v2025.10.29.2', '2025-10-29T12:09:00Z'),
  ];
  assert.equal(releaseOfRun(run, releases)?.tag, 'tickalot-v2025.10.29.2');
});

test('SpotTheCam owns both old and renamed release prefixes', () => {
  const appRun = { ...run, repo: 'spotthecam' };
  const legacy = release('speed-camera-map-v2025.10.29.2', '2025-10-29T12:07:00Z');
  const renamed = release('spotthecam-v2025.10.29.2', '2025-10-29T12:09:00Z');
  assert.equal(releaseOfRun(appRun, [legacy])?.tag, legacy.tag);
  assert.equal(releaseOfRun(appRun, [renamed])?.tag, renamed.tag);
  // Even if the API supplies the old tag first, link this run to its canonical release.
  assert.equal(releaseOfRun(appRun, [legacy, renamed])?.tag, renamed.tag);
});

test('a release of another repo or outside the run stays off it', () => {
  const releases = [
    release('keeppad-v1.0.0', '2025-10-29T12:05:00Z'),
    release('tickalot-v1.0.0', '2025-10-29T12:20:00Z'),
  ];
  assert.equal(releaseOfRun(run, releases), null);
});

test('a repo name that starts another one keeps its own releases', () => {
  const releases = [release('tickalot-pro-v1.0.0', '2025-10-29T12:05:00Z')];
  assert.equal(releaseOfRun(run, releases), null);
});

test('the memories repo owns the releases of the apps it took in', () => {
  const memories = { ...run, repo: 'memories' };
  assert.equal(
    releaseOfRun(memories, [release('memories-mobile-v1.0.0', '2025-10-29T12:05:00Z')])?.tag,
    'memories-mobile-v1.0.0',
  );
  assert.equal(
    releaseOfRun(memories, [release('media-organizer-v0.1.0', '2025-10-29T12:05:00Z')])?.tag,
    'media-organizer-v0.1.0',
  );
});

test('a release goes to the one overlapping run that ended nearest to it', () => {
  const releaseRun = { ...run, id: 2, createdAt: '2025-10-29T12:05:00Z', updatedAt: '2025-10-29T12:09:20Z' };
  const checks = { ...run, id: 3, createdAt: '2025-10-29T12:04:00Z', updatedAt: '2025-10-29T12:30:00Z' };
  const byRun = releasesByRun([run, releaseRun, checks], [release('tickalot-v2', '2025-10-29T12:09:00Z')]);
  assert.deepEqual([...byRun.keys()], [2]);
});

test('a release dates from its publish, since created_at is the date of the tagged commit', () => {
  const parsed = toRelease({
    tag_name: 'tickalot-v2',
    name: null,
    html_url: 'https://github.com/r',
    created_at: '2025-10-29T06:00:00Z',
    published_at: '2025-10-29T12:09:00Z',
    assets: [],
  });
  assert.equal(parsed.createdAt, '2025-10-29T12:09:00Z');
});

test('the APK asset comes out of the release assets', () => {
  const parsed = toRelease({
    tag_name: 'tickalot-v1',
    name: 'Tick-a-Lot v1',
    html_url: 'https://github.com/r',
    created_at: '2025-10-29T12:00:00Z',
    assets: [
      { name: 'Tick-a-Lot.aab', browser_download_url: 'https://x/aab' },
      { name: 'Tick-a-Lot-1-android.apk', browser_download_url: 'https://x/apk' },
    ],
  });
  assert.deepEqual(parsed.apk, { name: 'Tick-a-Lot-1-android.apk', url: 'https://x/apk' });
});
