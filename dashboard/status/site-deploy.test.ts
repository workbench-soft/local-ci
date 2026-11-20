import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RepoWorkflow } from './release-workflow.ts';
import { deploysSite, findSiteWorkflows, pickSiteWorkflow } from './site-deploy.ts';

const flow = (id: number, file: string, state = 'active'): RepoWorkflow => ({
  id,
  name: file,
  path: `.github/workflows/${file}`,
  state,
});
const yaml = (run: string) => `on:\n  push:\n  workflow_dispatch:\njobs:\n  go:\n    steps:\n      - run: ${run}\n`;

test('a dispatchable workflow that deploys a site counts', () => {
  for (const run of [
    'pnpm exec wrangler deploy',
    'pnpm exec wrangler pages deploy dist',
    'mise run deploy:web',
    'mise run deploy',
    'sh .github/scripts/deploy-site.sh',
    'git push https://github.com/workbench-soft/aspirationstyle-site.git',
  ])
    assert.ok(deploysSite(yaml(run)), run);
  assert.ok(deploysSite('on:\n  workflow_dispatch:\njobs:\n  d:\n    steps:\n      - uses: actions/deploy-pages@v4\n'));
});

test('automatic-only site workflows are discoverable, but tests and signalling Workers stay out', () => {
  assert.equal(deploysSite('on:\n  push:\njobs:\n  d:\n    steps:\n      - run: wrangler deploy\n'), true);
  assert.equal(deploysSite(yaml('mise run test')), false);
  assert.equal(deploysSite(yaml('mise run deploy:signal')), false);
  assert.equal(deploysSite(yaml('mise run deploy:worker')), false);
  assert.equal(deploysSite(yaml('mise run deploy:site')), true);
});

test('a deploy file wins over pages, release and others', () => {
  const site = yaml('wrangler deploy');
  assert.equal(pickSiteWorkflow([flow(1, 'release.yml'), flow(2, 'deploy-web.yml')], [site, site])?.id, 2);
  assert.equal(pickSiteWorkflow([flow(1, 'games.yml'), flow(2, 'pages.yml')], [site, site])?.id, 2);
  assert.equal(pickSiteWorkflow([flow(1, 'checks.yml'), flow(2, 'release.yml')], [site, site])?.id, 2);
  assert.equal(pickSiteWorkflow([flow(1, 'deploy.yml'), flow(2, 'checks.yml')], [yaml('mise run test'), site])?.id, 2);
});

test('disabled and dynamic workflows and repos with no deploy pick none', () => {
  const site = yaml('wrangler deploy');
  assert.equal(pickSiteWorkflow([flow(1, 'deploy.yml', 'disabled_manually')], [site]), null);
  const pages = {
    id: 3,
    name: 'pages-build-deployment',
    path: 'dynamic/pages/pages-build-deployment',
    state: 'active',
  };
  assert.equal(pickSiteWorkflow([pages], [site]), null);
  assert.equal(pickSiteWorkflow([flow(1, 'ci.yml')], [yaml('mise run test')]), null);
});

test('all site workflows are found, including two sites in one repo and an automatic-only deploy', () => {
  const pages = flow(1, 'pages.yml');
  const games = flow(2, 'games.yml');
  const automatic = flow(3, 'automatic.yml');
  const ignored = flow(4, 'checks.yml');
  const discovered = findSiteWorkflows(
    [pages, games, automatic, ignored],
    [
      yaml('mise run deploy'),
      yaml('pnpm exec wrangler deploy'),
      'on:\\n  push:\\n  steps:\\n    - run: mise run deploy:web\\n'.replaceAll('\\n', '\n'),
      yaml('mise run lint'),
    ],
  );
  assert.deepEqual(
    discovered.map(({ workflow, manual }) => [workflow.id, manual]),
    [
      [1, true],
      [2, true],
      [3, false],
    ],
  );
  assert.equal(pickSiteWorkflow([automatic], ['on:\n  push:\n  run: mise run deploy:web']), null);
});
