import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WorkflowRun } from './org-status.ts';
import { replacementRuns, failedCheckReleases } from './superseded.ts';

const run = (id: number, change: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id,
  repo: 'app',
  workflowId: 1,
  workflow: 'Checks',
  branch: 'main',
  event: 'push',
  headSha: `commit-${id}`,
  status: 'in_progress',
  conclusion: null,
  jobs: [],
  title: '',
  createdAt: '',
  startedAt: null,
  updatedAt: '',
  url: '',
  branchUrl: '',
  pullRequests: [],
  ...change,
});

test('a new commit replaces only the same product, workflow, branch and event', () => {
  const old = run(1);
  const newer = run(10);
  const others = [
    run(2, { repo: 'other' }),
    run(3, { branch: 'feature' }),
    run(4, { workflowId: 2 }),
    run(5, { event: 'pull_request' }),
  ];
  assert.deepEqual(replacementRuns([old, newer, ...others]), [{ run: old, replacement: newer }]);
});

test('reruns of the same commit and missing commit identities stop no build', () => {
  assert.deepEqual(replacementRuns([run(1), run(2, { headSha: 'commit-1' })]), []);
  assert.deepEqual(replacementRuns([run(1, { headSha: undefined }), run(2)]), []);
});

test('closing a PR without a new commit stops no build', () => {
  assert.deepEqual(replacementRuns([run(1, { event: 'pull_request' })]), []);
});

test('a finished newer build still replaces an older active build on any branch', () => {
  const old = run(1, { branch: 'feature/a' });
  const newer = run(2, { branch: 'feature/a', status: 'completed' });
  assert.deepEqual(replacementRuns([old, newer]), [{ run: old, replacement: newer }]);
});

test('schedule and workflow_run builds do not replace one another', () => {
  for (const event of ['schedule', 'workflow_run'])
    assert.deepEqual(replacementRuns([run(1, { event }), run(2, { event })]), []);
});

test('a different commit replaces a manual build with a push build and vice versa', () => {
  for (const event of ['push', 'workflow_dispatch']) {
    const old = run(1, { event });
    const replacement = run(2, { event: event === 'push' ? 'workflow_dispatch' : 'push' });
    assert.deepEqual(replacementRuns([old, replacement]), [{ run: old, replacement }]);
  }
});

test('fork PRs with the same branch name keep their separate scope', () => {
  const old = run(1, {
    event: 'pull_request',
    pullRequests: [{ number: 7, url: 'https://github.com/demo/app/pull/7' }],
  });
  const other = run(2, {
    event: 'pull_request',
    pullRequests: [{ number: 8, url: 'https://github.com/demo/app/pull/8' }],
  });
  assert.deepEqual(replacementRuns([old, other]), []);
});

test('failed Checks cancel releases only of the same repo, branch and SHA', () => {
  const checks = run(1, { status: 'completed', conclusion: 'failure' });
  const release = run(2, { workflow: 'Release Android', headSha: checks.headSha });
  const others = [
    run(3, { workflow: 'Release', headSha: 'different' }),
    run(4, { workflow: 'Release', headSha: checks.headSha, repo: 'other' }),
    run(5, { workflow: 'Release', headSha: checks.headSha, branch: 'feature' }),
    run(6, { workflow: 'Unrelated build', headSha: checks.headSha }),
  ];
  assert.deepEqual(failedCheckReleases([checks, release, ...others]), [{ run: release, replacement: checks }]);
});

test('a failed Checks job stops a release before other check jobs finish', () => {
  const checks = run(1, { jobs: [{ conclusion: 'failure' } as WorkflowRun['jobs'][number]] });
  const release = run(2, { workflow: 'Release', headSha: checks.headSha });
  assert.equal(failedCheckReleases([checks, release]).length, 1);
  assert.deepEqual(failedCheckReleases([{ ...checks, jobs: [] }, release]), []);
});

test('monorepo products use their own Checks workflow', () => {
  const mobile = run(1, { repo: 'memories', conclusion: 'failure' });
  const desktop = run(2, { repo: 'memories', workflow: 'Desktop release', headSha: mobile.headSha });
  const camera = run(3, { repo: 'memories', workflow: 'Shuttrix release', headSha: mobile.headSha });
  assert.deepEqual(failedCheckReleases([mobile, desktop, camera]), []);
  const checks = run(4, {
    repo: 'memories',
    workflow: 'Desktop checks',
    headSha: mobile.headSha,
    conclusion: 'failure',
  });
  assert.deepEqual(failedCheckReleases([mobile, checks, desktop, camera]), [{ run: desktop, replacement: checks }]);
});

test('a new check attempt supersedes an earlier failure of the same commit', () => {
  const old = run(1, { conclusion: 'failure' });
  const latest = run(2, { headSha: old.headSha });
  const release = run(3, { workflow: 'Release', headSha: old.headSha });
  assert.deepEqual(failedCheckReleases([old, latest, release]), []);
});

test('a release blocked by its publication guard records the matching failed check without another stop', () => {
  const checks = run(1, { conclusion: 'failure' });
  const release = run(2, {
    workflow: 'Release',
    headSha: checks.headSha,
    status: 'completed',
    conclusion: 'failure',
    jobs: [{ failedStep: 'Wait for matching checks before publication' } as WorkflowRun['jobs'][number]],
  });
  assert.deepEqual(failedCheckReleases([checks, release]), []);
  assert.deepEqual(failedCheckReleases([checks, release], true), [{ run: release, replacement: checks }]);
});
