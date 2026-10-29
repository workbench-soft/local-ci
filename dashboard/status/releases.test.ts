import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type Release, releaseOfRun, toRelease } from './releases.ts';

const release = (tag: string, createdAt: string): Release => ({ tag, name: tag, url: `https://github.com/${tag}`, createdAt, apk: null });

const run = { repo: 'tickalot', createdAt: '2025-10-29T12:00:00Z', updatedAt: '2025-10-29T12:10:00Z' };

test('a run owns the release of its repo created while it ran', () => {
	const releases = [release('tickalot-v2025.10.29.1', '2025-10-29T11:00:00Z'), release('tickalot-v2025.10.29.2', '2025-10-29T12:09:00Z')];
	assert.equal(releaseOfRun(run, releases)?.tag, 'tickalot-v2025.10.29.2');
});

test('a release of another repo or outside the run stays off it', () => {
	const releases = [release('keeppad-v1.0.0', '2025-10-29T12:05:00Z'), release('tickalot-v1.0.0', '2025-10-29T12:20:00Z')];
	assert.equal(releaseOfRun(run, releases), null);
});

test('a repo name that starts another one keeps its own releases', () => {
	const releases = [release('memories-mobile-v1.0.0', '2025-10-29T12:05:00Z')];
	assert.equal(releaseOfRun({ ...run, repo: 'memories' }, releases), null);
});

test('the APK asset comes out of the release assets', () => {
	const parsed = toRelease({
		tag_name: 'tickalot-v1',
		name: 'Tickalot v1',
		html_url: 'https://github.com/r',
		created_at: '2025-10-29T12:00:00Z',
		assets: [
			{ name: 'Tickalot.aab', browser_download_url: 'https://x/aab' },
			{ name: 'Tickalot-1-android.apk', browser_download_url: 'https://x/apk' },
		],
	});
	assert.deepEqual(parsed.apk, { name: 'Tickalot-1-android.apk', url: 'https://x/apk' });
});
