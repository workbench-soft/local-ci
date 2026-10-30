import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appOfTag, latestReleases } from './latest-releases.ts';
import type { Release } from './releases.ts';

const release = (tag: string, createdAt: string): Release => ({ tag, name: tag, url: `https://github.com/${tag}`, createdAt, apk: null, notesHtml: '' });

const run = {
	repo: 'tickalot',
	workflow: 'Checks',
	branch: 'main',
	event: 'push',
	status: 'completed',
	conclusion: 'success',
	createdAt: '2026-10-31T10:00:00Z',
	url: 'https://github.com/run',
	place: 'done' as const,
};

test('the app of a tag drops the version', () => {
	assert.equal(appOfTag('memories-mobile-v2026.10.31.1'), 'memories-mobile');
	assert.equal(appOfTag('media-organizer-v0.0.17'), 'media-organizer');
	assert.equal(appOfTag('v2026.10.31.1'), null);
});

test('each app keeps its newest release, newest app first', () => {
	const apps = latestReleases(
		[release('tickalot-v1', '2026-10-30T10:00:00Z'), release('keeppad-v3', '2026-10-31T09:00:00Z'), release('tickalot-v2', '2026-10-31T08:00:00Z')],
		[],
	);
	assert.deepEqual(
		apps.map((app) => app.release.tag),
		['keeppad-v3', 'tickalot-v2'],
	);
});

test('an app from a renamed repo finds the repo that builds it', () => {
	const [app] = latestReleases([release('lumiere-v1', '2026-10-31T08:00:00Z')], []);
	assert.equal(app.repo, 'lumiere-player');
});

test('an unfinished run on main marks the app as building', () => {
	const runs = [{ ...run, status: 'in_progress', conclusion: null, place: 'local' as const }, { ...run, branch: 'fix-x', status: 'queued', place: 'waiting' as const }];
	const [app] = latestReleases([release('tickalot-v2', '2026-10-31T08:00:00Z')], runs);
	assert.deepEqual(app.build, { state: 'building', workflow: 'Checks', url: run.url, place: 'local' });
});

test('a run on a branch other than main leaves the app as it is', () => {
	const [app] = latestReleases([release('tickalot-v2', '2026-10-31T08:00:00Z')], [{ ...run, branch: 'fix-x', status: 'queued', place: 'waiting' }]);
	assert.equal(app.build, null);
});

test('a failed run on main after the release marks the last build as failed', () => {
	const [app] = latestReleases([release('tickalot-v2', '2026-10-31T08:00:00Z')], [{ ...run, conclusion: 'failure' }]);
	assert.equal(app.build?.state, 'failed');
	const [fixed] = latestReleases(
		[release('tickalot-v2', '2026-10-31T08:00:00Z')],
		[{ ...run, conclusion: 'failure' }, { ...run, createdAt: '2026-10-31T11:00:00Z' }],
	);
	assert.equal(fixed.build, null);
});

test('a Dependabot run on main leaves the app as it is', () => {
	const [app] = latestReleases([release('tickalot-v2', '2026-10-31T08:00:00Z')], [{ ...run, event: 'dynamic', status: 'in_progress', place: 'local' }]);
	assert.equal(app.build, null);
});
