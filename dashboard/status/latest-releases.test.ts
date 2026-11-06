import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CancelEntry } from './cancel-log.ts';
import { appOfTag, latestReleases, type PipelineRun } from './latest-releases.ts';
import type { Release } from './releases.ts';

const now = Date.parse('2026-11-05T12:00:00Z');
const release = (tag: string, createdAt: string): Release => ({
  tag,
  name: tag,
  url: `https://github.com/${tag}`,
  createdAt,
  apk: null,
  notesHtml: '',
});

type RunBits = Partial<PipelineRun> & { id: number };
const run = (bits: RunBits): PipelineRun => ({
  repo: 'tickalot',
  workflow: 'Checks',
  title: 'feat: sort the weekly shop',
  branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  createdAt: '2026-11-05T10:00:00Z',
  startedAt: '2026-11-05T10:00:00Z',
  updatedAt: '2026-11-05T10:05:00Z',
  url: `https://github.com/run/${bits.id}`,
  place: 'done',
  jobs: [],
  ...bits,
});
const tickalotRelease = release('tickalot-v2026.11.05.1', '2026-11-05T09:00:00Z');

// The run that made the release ran while GitHub created it: it starts a few minutes before and
// ends half a minute after the release lands.
const madeIt = (id: number, createdAt: string, workflow = 'Release'): PipelineRun =>
  run({ id, workflow, event: 'workflow_run', createdAt, updatedAt: '2026-11-05T09:00:30Z', conclusion: 'success' });

const noCancels = new Map<number, CancelEntry>();
const cancelOf = (runId: number, words: string): Map<number, CancelEntry> =>
  new Map([[runId, { repo: 'tickalot', runId, words, at: '2026-11-05T11:00:00Z' }]]);

test('the app of a tag drops the version', () => {
  assert.equal(appOfTag('memories-mobile-v2026.10.31.1'), 'memories-mobile');
  assert.equal(appOfTag('media-organizer-v0.0.17'), 'media-organizer');
  assert.equal(appOfTag('v2026.10.31.1'), null);
});

test('nothing after the release leaves it released', () => {
  const [app] = latestReleases([tickalotRelease], [madeIt(1, '2026-11-05T08:55:00Z')], noCancels, now);
  assert.equal(app.state, 'released');
  assert.equal(app.pipeline, 'Release');
  assert.equal(app.run, null);
});

test('a run on main newer than the release marks the app building, with its wait', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({ id: 2, status: 'in_progress', conclusion: null, createdAt: '2026-11-05T11:00:00Z', place: 'local' }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'building');
  assert.equal(app.run?.workflow, 'Checks');
  assert.equal(app.wait?.elapsedMs, 60 * 60_000);
});

test('a queued run marks the app queued, with the usual life of its workflow', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        workflow: 'Release',
        event: 'workflow_run',
        status: 'queued',
        conclusion: null,
        createdAt: '2026-11-05T11:00:00Z',
        startedAt: null,
        updatedAt: '2026-11-05T11:00:00Z',
        place: 'waiting',
      }),
      // Two past Release runs, 40 and 44 minutes, so the usual life is the median.
      run({
        id: 3,
        workflow: 'Release',
        event: 'workflow_run',
        createdAt: '2026-11-04T09:00:00Z',
        startedAt: '2026-11-04T09:10:00Z',
        updatedAt: '2026-11-04T09:40:00Z',
      }),
      run({
        id: 4,
        workflow: 'Release',
        event: 'workflow_run',
        createdAt: '2026-11-03T09:00:00Z',
        startedAt: '2026-11-03T09:02:00Z',
        updatedAt: '2026-11-03T09:44:00Z',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'queued');
  // The usual life counts the queue wait too, and the median picks the 40 min run of the 3 samples.
  assert.equal(app.wait?.usualMs, 40 * 60_000);
});

test('a failed run on main after the release marks the app errored', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        conclusion: 'failure',
        updatedAt: '2026-11-05T11:20:00Z',
        createdAt: '2026-11-05T11:00:00Z',
        jobs: [{ name: 'checks', conclusion: 'failure', failedStep: 'Unit tests' }],
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'errored');
  assert.equal(app.run?.failedStep, 'Unit tests');
});

test('a cancelled run names the reason from the cancel log', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        workflow: 'Release',
        event: 'workflow_run',
        conclusion: 'cancelled',
        createdAt: '2026-11-05T11:00:00Z',
        updatedAt: '2026-11-05T11:05:00Z',
      }),
    ],
    cancelOf(2, 'a newer run replaced it'),
    now,
  );
  assert.equal(app.state, 'cancelled');
  assert.equal(app.why?.words, 'a newer run replaced it');
});

test('a cancelled run with no logged reason still shows cancelled', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        workflow: 'Release',
        event: 'workflow_run',
        conclusion: 'cancelled',
        createdAt: '2026-11-05T11:00:00Z',
        updatedAt: '2026-11-05T11:05:00Z',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'cancelled');
  assert.equal(app.why, null);
});

test('a newer run that builds hides the cancelled one before it', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        workflow: 'Release',
        event: 'workflow_run',
        conclusion: 'cancelled',
        createdAt: '2026-11-05T10:30:00Z',
        updatedAt: '2026-11-05T10:35:00Z',
      }),
      run({ id: 3, status: 'in_progress', conclusion: null, createdAt: '2026-11-05T11:00:00Z', place: 'local' }),
    ],
    cancelOf(2, 'a newer run replaced it'),
    now,
  );
  assert.equal(app.state, 'building');
});

test('a skipped release workflow with passing checks says the gate held it', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({ id: 2, createdAt: '2026-11-05T10:00:00Z' }),
      run({
        id: 3,
        workflow: 'Release',
        event: 'workflow_run',
        conclusion: 'skipped',
        createdAt: '2026-11-05T10:10:00Z',
        updatedAt: '2026-11-05T10:10:00Z',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'gate-held');
  assert.equal(app.run?.workflow, 'Release');
});

test('a skipped release workflow over failed checks says errored', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({ id: 2, conclusion: 'failure', createdAt: '2026-11-05T10:00:00Z', updatedAt: '2026-11-05T10:20:00Z' }),
      run({
        id: 3,
        workflow: 'Release',
        event: 'workflow_run',
        conclusion: 'skipped',
        createdAt: '2026-11-05T10:21:00Z',
        updatedAt: '2026-11-05T10:21:00Z',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'errored');
  assert.equal(app.run?.workflow, 'Checks');
});

test('a run on a branch or a PR stays out of the decision', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        branch: 'fix-x',
        status: 'in_progress',
        conclusion: null,
        createdAt: '2026-11-05T11:00:00Z',
        place: 'waiting',
      }),
      run({
        id: 3,
        event: 'pull_request',
        status: 'queued',
        conclusion: null,
        createdAt: '2026-11-05T11:10:00Z',
        place: 'waiting',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'released');
});

test('a Dependabot run on main releases nothing and stays out', () => {
  const [app] = latestReleases(
    [tickalotRelease],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({ id: 2, event: 'dynamic', status: 'in_progress', conclusion: null, createdAt: '2026-11-05T11:00:00Z' }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.state, 'released');
});

test('a repo with runs and no release shows as an app before its first release', () => {
  const [app] = latestReleases(
    [],
    [
      run({
        id: 1,
        repo: 'spotthecam',
        createdAt: '2026-11-05T08:00:00Z',
        startedAt: '2026-11-05T08:00:00Z',
        updatedAt: '2026-11-05T08:30:00Z',
      }),
      run({
        id: 2,
        repo: 'spotthecam',
        workflow: 'Release',
        event: 'workflow_run',
        status: 'queued',
        conclusion: null,
        startedAt: null,
        createdAt: '2026-11-05T11:00:00Z',
        place: 'waiting',
      }),
    ],
    noCancels,
    now,
  );
  assert.equal(app.app, 'spotthecam');
  assert.equal(app.state, 'queued');
  assert.equal(app.release, null);
});

test('a repo with only checks runs shows no app row', () => {
  const apps = latestReleases([], [run({ id: 1, repo: 'git-aliases' })], noCancels, now);
  assert.equal(apps.length, 0);
});

test('the release pipeline of another app in the same repo stays out', () => {
  // The memories repo ships two apps: Release for memories-mobile, Desktop release for media-organizer.
  const runs: PipelineRun[] = [
    run({
      id: 1,
      repo: 'memories',
      workflow: 'Release',
      event: 'workflow_run',
      createdAt: '2026-11-05T08:50:00Z',
      updatedAt: '2026-11-05T08:56:00Z',
    }),
    run({
      id: 2,
      repo: 'memories',
      workflow: 'Desktop release',
      event: 'workflow_run',
      createdAt: '2026-11-05T08:50:00Z',
      updatedAt: '2026-11-05T08:57:00Z',
    }),
    run({
      id: 3,
      repo: 'memories',
      workflow: 'Desktop release',
      event: 'workflow_run',
      status: 'in_progress',
      conclusion: null,
      createdAt: '2026-11-05T11:00:00Z',
      place: 'local',
    }),
  ];
  const apps = latestReleases(
    [
      release('memories-mobile-v2026.11.05.1', '2026-11-05T08:56:00Z'),
      release('media-organizer-v2026.11.05.1', '2026-11-05T08:57:00Z'),
    ],
    runs,
    noCancels,
    now,
  );
  const mobile = apps.find((app) => app.app === 'memories-mobile');
  const desktop = apps.find((app) => app.app === 'media-organizer');
  assert.equal(mobile?.state, 'released');
  assert.equal(desktop?.state, 'building');
});

test('waiting apps come first, released ones last', () => {
  const apps = latestReleases(
    [tickalotRelease, release('keeppad-v2026.11.05.1', '2026-11-05T09:00:00Z')],
    [
      madeIt(1, '2026-11-05T08:55:00Z'),
      run({
        id: 2,
        repo: 'keeppad',
        status: 'in_progress',
        conclusion: null,
        createdAt: '2026-11-05T11:00:00Z',
        place: 'local',
      }),
      run({
        id: 3,
        repo: 'keeppad',
        workflow: 'Release',
        event: 'workflow_run',
        createdAt: '2026-11-05T08:55:00Z',
        updatedAt: '2026-11-05T08:59:00Z',
      }),
    ],
    noCancels,
    now,
  );
  assert.deepEqual(
    apps.map((app) => app.app),
    ['keeppad', 'tickalot'],
  );
  assert.deepEqual(
    apps.map((app) => app.state),
    ['building', 'released'],
  );
});

test('apps group by release status and then alphabetically instead of by run time', () => {
  const apps = latestReleases(
    [
      release('zeta-v2026.11.05.1', '2026-11-05T09:00:00Z'),
      release('beta-v2026.11.05.1', '2026-11-05T09:30:00Z'),
      release('delta-v2026.11.05.1', '2026-11-05T09:10:00Z'),
      release('alpha-v2026.11.05.1', '2026-11-05T09:20:00Z'),
    ],
    [
      run({ id: 10, repo: 'zeta', conclusion: 'failure', createdAt: '2026-11-05T10:00:00Z' }),
      run({ id: 11, repo: 'delta', conclusion: 'failure', createdAt: '2026-11-05T11:00:00Z' }),
    ],
    noCancels,
    now,
  );

  assert.deepEqual(
    apps.map((app) => [app.app, app.state]),
    [
      ['delta', 'errored'],
      ['zeta', 'errored'],
      ['alpha', 'released'],
      ['beta', 'released'],
    ],
  );
});

test('names within a status sort case-insensitively with natural numbers regardless of release date', () => {
  const apps = latestReleases(
    [
      release('zulu-v2026.11.05.1', '2026-11-05T09:50:00Z'),
      release('app10-v2026.11.05.1', '2026-11-05T09:40:00Z'),
      release('Beta-v2026.11.05.1', '2026-11-05T09:30:00Z'),
      release('app2-v2026.11.05.1', '2026-11-05T09:20:00Z'),
      release('alpha-v2026.11.05.1', '2026-11-05T09:10:00Z'),
    ],
    [],
    noCancels,
    now,
  );

  assert.deepEqual(
    apps.map((app) => app.app),
    ['alpha', 'app2', 'app10', 'Beta', 'zulu'],
  );
});
