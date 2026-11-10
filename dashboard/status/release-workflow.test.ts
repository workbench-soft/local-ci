import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickReleaseWorkflow, type RepoWorkflow } from './release-workflow.ts';

const flow = (id: number, file: string, state = 'active'): RepoWorkflow => ({
  id,
  name: file,
  path: `.github/workflows/${file}`,
  state,
});

test('takes the one release or deploy workflow of a repo', () => {
  assert.equal(pickReleaseWorkflow([flow(1, 'checks.yml'), flow(2, 'release.yml')], null)?.id, 2);
  assert.equal(pickReleaseWorkflow([flow(1, 'ci.yml'), flow(2, 'deploy.yml')], 1)?.id, 2);
});

test('lets the run that made the release choose among several, then a lone release file', () => {
  const workflows = [flow(1, 'deploy.yml'), flow(2, 'release.yml')];
  assert.equal(pickReleaseWorkflow(workflows, 1)?.id, 1);
  assert.equal(pickReleaseWorkflow(workflows, null)?.id, 2);
  const two = [flow(1, 'release.yml'), flow(2, 'desktop-release.yml')];
  assert.equal(pickReleaseWorkflow(two, 2)?.id, 2);
  assert.equal(pickReleaseWorkflow(two, null), null);
});

test('falls back to the workflow that made the release, and skips disabled ones', () => {
  assert.equal(pickReleaseWorkflow([flow(1, 'checks.yml'), flow(2, 'ci.yml')], 2)?.id, 2);
  assert.equal(pickReleaseWorkflow([flow(1, 'release.yml', 'disabled_manually')], null), null);
});
