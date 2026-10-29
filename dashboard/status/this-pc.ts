import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { org } from './settings';

const run = promisify(execFile);

export const runnerDir = join(homedir(), 'actions-runner', org);
export const runnerTask = `GitHub Actions runner (${org})`;

export type LocalStatus =
	| { supported: false }
	| {
			supported: true;
			name: string | null;
			task: string | null;
			listener: boolean;
			worker: boolean;
			lastJobAt: string | null;
	  };

// tasklist prints the image name in quotes, whatever the Windows language.
async function running(image: string): Promise<boolean> {
	const { stdout } = await run('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH']);
	return stdout.includes(`"${image}"`);
}

// schtasks prints the state in the Windows language, the PowerShell enum doesn't.
async function taskState(): Promise<string | null> {
	try {
		const { stdout } = await run('powershell', [
			'-NoProfile',
			'-Command',
			`(Get-ScheduledTask -TaskName '${runnerTask}' -ErrorAction Stop).State`,
		]);
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

async function runnerName(): Promise<string | null> {
	try {
		// The runner writes .runner with a BOM.
		const text = await readFile(join(runnerDir, '.runner'), 'utf8');
		return JSON.parse(text.replace(/^﻿/, '')).agentName ?? null;
	} catch {
		return null;
	}
}

// The runner starts a Worker_*.log for each job it takes.
async function lastJobAt(): Promise<string | null> {
	try {
		const diag = join(runnerDir, '_diag');
		const logs = (await readdir(diag)).filter((f) => f.startsWith('Worker_'));
		const times = await Promise.all(logs.map(async (f) => (await stat(join(diag, f))).mtimeMs));
		return times.length ? new Date(Math.max(...times)).toISOString() : null;
	} catch {
		return null;
	}
}

export async function localStatus(): Promise<LocalStatus> {
	if (process.platform !== 'win32') return { supported: false };
	const [name, task, listener, worker, lastJob] = await Promise.all([
		runnerName(),
		taskState(),
		running('Runner.Listener.exe'),
		running('Runner.Worker.exe'),
		lastJobAt(),
	]);
	return { supported: true, name, task, listener, worker, lastJobAt: lastJob };
}
