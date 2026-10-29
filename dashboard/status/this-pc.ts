import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { orgName } from './settings';

export type ThisPcStatus =
	| { supported: false }
	| {
			supported: true;
			name: string | null;
			task: string | null;
			listener: boolean;
			worker: boolean;
			lastJobAt: string | null;
	  };

export const runnerFolder = join(homedir(), 'actions-runner', orgName);
export const runnerTaskName = `GitHub Actions runner (${orgName})`;

const execFileAsync = promisify(execFile);

/** The runner on this PC: its boot task, its processes and its last job. The checks need Windows. */
export async function readThisPc(): Promise<ThisPcStatus> {
	if (process.platform !== 'win32') return { supported: false };
	const [name, task, listener, worker, lastJobAt] = await Promise.all([
		readRunnerName(),
		readBootTaskState(),
		isProcessRunning('Runner.Listener.exe'),
		isProcessRunning('Runner.Worker.exe'),
		readLastJobTime(),
	]);
	return { supported: true, name, task, listener, worker, lastJobAt };
}

// tasklist quotes the image name in CSV in every Windows language.
async function isProcessRunning(image: string): Promise<boolean> {
	const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH']);
	return stdout.includes(`"${image}"`);
}

// The PowerShell enum stays English, while schtasks prints the state in the Windows language.
async function readBootTaskState(): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync('powershell', [
			'-NoProfile',
			'-Command',
			`(Get-ScheduledTask -TaskName '${runnerTaskName}' -ErrorAction Stop).State`,
		]);
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

async function readRunnerName(): Promise<string | null> {
	try {
		const text = await readFile(join(runnerFolder, '.runner'), 'utf8');
		// The runner saves .runner with a byte order mark.
		return JSON.parse(text.replace(/^\uFEFF/, '')).agentName ?? null;
	} catch {
		return null;
	}
}

// Each job the runner takes opens a new _diag/Worker_*.log.
async function readLastJobTime(): Promise<string | null> {
	try {
		const diag = join(runnerFolder, '_diag');
		const logs = (await readdir(diag)).filter((file) => file.startsWith('Worker_'));
		if (!logs.length) return null;
		const times = await Promise.all(logs.map(async (file) => (await stat(join(diag, file))).mtimeMs));
		return new Date(Math.max(...times)).toISOString();
	} catch {
		return null;
	}
}
