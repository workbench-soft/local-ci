import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

// In a JS string `runner\install.ps1` loses its backslash, so the page would tell the person to run runnerinstall.ps1.
test('page text names Windows scripts with an escaped backslash', () => {
	const root = join(import.meta.dirname, '..');
	const sources = ['status', 'cards', 'app'].flatMap((folder) =>
		readdirSync(join(root, folder))
			.filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
			.map((file) => join(folder, file)),
	);
	const broken = sources.filter((file) => /[\w-]\\[\w-]+\.ps1/.test(readFileSync(join(root, file), 'utf8')));
	assert.deepEqual(broken, []);
});
