import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kindOfJob, kindsOfRun } from './runner-kind.ts';

const local = new Set(['NIFELHEIM-1']);

test('classifies hosted Blacksmith and GitHub Actions jobs as cloud, not local', () => {
  assert.equal(kindOfJob({ runnerName: 'Blacksmith runner', labels: [] }, local), 'blacksmith');
  assert.equal(kindOfJob({ runnerName: 'GitHub Actions 1000001861', labels: ['ubuntu-latest'] }, local), 'github');
  assert.equal(kindOfJob({ runnerName: null, labels: ['blacksmith-4vcpu-ubuntu-2404'] }, local), 'blacksmith');
  assert.equal(kindOfJob({ runnerName: 'NIFELHEIM-1', labels: ['self-hosted', 'local'] }, local), 'pc');
});

test('a workflow spanning Blacksmith, GitHub, and this PC retains every provider', () => {
  assert.deepEqual(
    kindsOfRun(
      [
        { runnerName: 'Blacksmith runner', labels: [] },
        { runnerName: 'GitHub Actions 1000001861', labels: ['ubuntu-latest'] },
        { runnerName: 'NIFELHEIM-1', labels: ['self-hosted', 'local'] },
        { runnerName: 'Blacksmith runner', labels: [] },
      ],
      local,
    ),
    ['blacksmith', 'github', 'pc'],
  );
});
