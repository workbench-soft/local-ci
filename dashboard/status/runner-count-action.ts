'use server';

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { maxRunners } from './runner-count.ts';
import { countFile, countTaskName } from './this-pc.ts';

export type CountResult = { ok: true } | { ok: false; error: string };

const execFileAsync = promisify(execFile);

/** Saves the count and starts the task that runs runner/install.ps1 as admin on the person's desktop. */
export async function applyRunnerCount(count: number): Promise<CountResult> {
	// The browser sends the count, so it is checked before it reaches the file.
	if (!Number.isInteger(count) || count < 1 || count > maxRunners) return { ok: false, error: `The count must be a whole number from 1 to ${maxRunners}.` };
	if (process.platform !== 'win32') return { ok: false, error: `Run RUNNER_COUNT=${count} runner/install.sh on the Mac.` };
	try {
		await mkdir(dirname(countFile), { recursive: true });
		await writeFile(countFile, `${count}\r\n`, 'ascii');
		const name = countTaskName.replaceAll("'", "''");
		await execFileAsync('powershell', ['-NoProfile', '-Command', `Start-ScheduledTask -TaskName '${name}' -ErrorAction Stop`], { timeout: 30_000 });
		return { ok: true };
	} catch (error) {
		const text = String((error as { stderr?: string }).stderr || error);
		// Windows reports a missing task in its own language, so the check reads the code.
		if (/0x80070002/.test(text)) {
			return { ok: false, error: `The count is saved. Run runner\\install.ps1 once as admin to apply it. That run also adds the task "${countTaskName}" this button starts.` };
		}
		return { ok: false, error: text.trim() };
	}
}
