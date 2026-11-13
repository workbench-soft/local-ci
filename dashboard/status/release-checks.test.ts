import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checksWorkflowOf, lacksChecks } from './release-checks.ts';

test('the Checks workflow comes from the CHECKS_WORKFLOW line of the release', () => {
  assert.equal(checksWorkflowOf('env:\n  CHECKS_WORKFLOW: checks.yml\n'), 'checks.yml');
  assert.equal(checksWorkflowOf("env:\n  CHECKS_WORKFLOW: 'desktop-checks.yml'\n"), 'desktop-checks.yml');
  assert.equal(checksWorkflowOf('jobs:\n  build:\n'), null);
});

test('a commit lacks Checks only when no push or start by hand ran them', () => {
  assert.equal(lacksChecks([]), true);
  assert.equal(lacksChecks([{ event: 'pull_request' }]), true);
  assert.equal(lacksChecks([{ event: 'push' }]), false);
  assert.equal(lacksChecks([{ event: 'workflow_dispatch' }]), false);
});
