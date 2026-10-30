import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrgRunner } from './org-status.ts';
import { mergeRunners } from './runners.ts';
import type { PcRunner } from './this-pc.ts';

const pc = (name: string, listener = true, worker = false): PcRunner => ({
  folder: name,
  name,
  taskName: `task ${name}`,
  task: 'Running',
  listener,
  worker,
  lastJobAt: null,
});

const gh = (name: string, status: OrgRunner['status'] = 'online', busy = false): OrgRunner => ({
  id: name.length,
  name,
  os: 'Windows',
  status,
  busy,
  labels: ['self-hosted'],
});

test('a runner on both sides that agrees gets no hint', () => {
  const [row] = mergeRunners([pc('pc', true, true)], [gh('pc', 'online', true)]);
  assert.equal(row.tone, 'busy');
  assert.equal(row.hint, null);
});

test('a live process that GitHub sees offline gets a hint', () => {
  const [row] = mergeRunners([pc('pc')], [gh('pc', 'offline')]);
  assert.equal(row.tone, 'warn');
  assert.match(row.hint ?? '', /GitHub sees it offline/);
});

test('a folder GitHub has no runner for gets a hint', () => {
  const [row] = mergeRunners([pc('pc')], []);
  assert.match(row.hint ?? '', /no runner with this name/);
});

test('a stopped runner that GitHub sees offline says how to start it', () => {
  const [row] = mergeRunners([pc('pc', false)], [gh('pc', 'offline')]);
  assert.equal(row.tone, 'bad');
  assert.match(row.hint ?? '', /START\.cmd/);
});

test('a stopped runner that GitHub sees online points at another machine', () => {
  const [row] = mergeRunners([pc('pc', false)], [gh('pc')]);
  assert.match(row.hint ?? '', /another machine/);
});

test('runners on other machines follow the ones of this PC', () => {
  const rows = mergeRunners([pc('pc')], [gh('mac', 'online', true), gh('pc')]);
  assert.deepEqual(
    rows.map((row) => [row.name, row.here !== null]),
    [
      ['pc', true],
      ['mac', false],
    ],
  );
  assert.equal(rows[1].tone, 'busy');
});

test('without a GitHub list the PC side alone sets the row', () => {
  const [row] = mergeRunners([pc('pc', false)], null);
  assert.equal(row.tone, 'bad');
  assert.equal(row.hint, null);
});
