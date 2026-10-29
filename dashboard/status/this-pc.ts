import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { orgName } from './settings.ts';

/** One runner folder on this PC, its boot task, its processes and its last job. */
export type PcRunner = {
	folder: string;
	name: string | null;
	taskName: string;
	task: string | null;
	listener: boolean;
	worker: boolean;
	lastJobAt: string | null;
};

export type ThisPcStatus = { supported: false } | { supported: true; runners: PcRunner[] };

/** What PowerShell reports for every runner at once. */
export type ProcessSnapshot = {
	tasks: { name: string; state: string }[];
	logs: { folder: string; listener: boolean; worker: boolean }[];
};

const runnersRoot = join(homedir(), 'actions-runner');
const execFileAsync = promisify(execFile);

/** runner/install.ps1 numbers the folders and tasks from the second runner on. */
export function runnerNumber(folder: string): number | null {
	if (folder === orgName) return 1;
	const match = folder.startsWith(`${orgName}-`) && /^\d+$/.exec(folder.slice(orgName.length + 1));
	return match ? Number(match[0]) : null;
}

export function runnerTaskName(folder: string): string {
	const number = runnerNumber(folder);
	return `GitHub Actions runner (${orgName}${number && number > 1 ? ` ${number}` : ''})`;
}

/** Matches a folder to its boot task and to the logs its processes hold open. */
export function describeRunner(folder: string, snapshot: ProcessSnapshot): Omit<PcRunner, 'name' | 'lastJobAt'> {
	const taskName = runnerTaskName(folder);
	const logs = snapshot.logs.find((entry) => entry.folder === folder);
	return {
		folder,
		taskName,
		task: snapshot.tasks.find((task) => task.name === taskName)?.state ?? null,
		listener: logs?.listener ?? false,
		worker: logs?.worker ?? false,
	};
}

/** The runners on this PC. The checks need Windows. */
export async function readThisPc(): Promise<ThisPcStatus> {
	if (process.platform !== 'win32') return { supported: false };
	const folders = await listRunnerFolders();
	const snapshot = await readProcessSnapshot(folders);
	const runners = await Promise.all(
		folders.map(async (folder) => {
			const dir = join(runnersRoot, folder);
			const [name, lastJobAt] = await Promise.all([readRunnerName(dir), readLastJobTime(dir)]);
			return { ...describeRunner(folder, snapshot), name, lastJobAt };
		}),
	);
	return { supported: true, runners };
}

async function listRunnerFolders(): Promise<string[]> {
	try {
		const entries = await readdir(runnersRoot, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory() && runnerNumber(entry.name) !== null)
			.map((entry) => entry.name)
			.sort((a, b) => (runnerNumber(a) ?? 0) - (runnerNumber(b) ?? 0));
	} catch {
		return [];
	}
}

// The PowerShell enum stays English, while schtasks prints the state in the
// Windows language. The boot task runs the runner without a login, so its
// process path is hidden from the page. A live listener or worker holds its
// newest _diag log open for writing, and opening that log for read only fails.
async function readProcessSnapshot(folders: string[]): Promise<ProcessSnapshot> {
	const list = folders.map((folder) => `'${folder.replaceAll("'", "''")}'`).join(', ');
	const script = [
		`$tasks = @(Get-ScheduledTask -TaskName 'GitHub Actions runner (${orgName}*' -ErrorAction SilentlyContinue | ForEach-Object { @{ name = $_.TaskName; state = "$($_.State)" } })`,
		`function Test-Held($folder, $filter) { $log = Get-ChildItem (Join-Path '${runnersRoot}' "$folder\\_diag") -Filter $filter -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $log) { return $false }; try { [IO.File]::Open($log.FullName, 'Open', 'Read', 'Read').Close(); $false } catch { $true } }`,
		`$logs = @(foreach ($folder in @(${list})) { @{ folder = $folder; listener = Test-Held $folder 'Runner_*.log'; worker = Test-Held $folder 'Worker_*.log' } })`,
		'ConvertTo-Json -Compress -Depth 3 @{ tasks = $tasks; logs = $logs }',
	].join('; ');
	try {
		const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
		const parsed = JSON.parse(stdout);
		return { tasks: parsed.tasks ?? [], logs: parsed.logs ?? [] };
	} catch {
		return { tasks: [], logs: [] };
	}
}

async function readRunnerName(dir: string): Promise<string | null> {
	try {
		const text = await readFile(join(dir, '.runner'), 'utf8');
		// The runner saves .runner with a byte order mark.
		return JSON.parse(text.replace(/^\uFEFF/, '')).agentName ?? null;
	} catch {
		return null;
	}
}

// Each job the runner takes opens a new _diag/Worker_*.log.
async function readLastJobTime(dir: string): Promise<string | null> {
	try {
		const diag = join(dir, '_diag');
		const logs = (await readdir(diag)).filter((file) => file.startsWith('Worker_'));
		if (!logs.length) return null;
		const times = await Promise.all(logs.map(async (file) => (await stat(join(diag, file))).mtimeMs));
		return new Date(Math.max(...times)).toISOString();
	} catch {
		return null;
	}
}
