import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCount, recommendRunners } from './runner-count.ts';

test('recommends 1 runner per 4 logical processors', () => {
	assert.equal(recommendRunners(16, 64), 4);
	assert.equal(recommendRunners(32, 128), 8);
});

test('memory caps the count after 8 GB for Windows', () => {
	assert.equal(recommendRunners(16, 16), 2);
	assert.equal(recommendRunners(16, 31), 4);
});

test('a small machine still gets 1 runner', () => {
	assert.equal(recommendRunners(2, 4), 1);
});

test('the count file holds a whole number of 1 or more', () => {
	assert.equal(parseCount('6\r\n'), 6);
	assert.equal(parseCount('0'), null);
	assert.equal(parseCount('2.5'), null);
	assert.equal(parseCount(''), null);
});
