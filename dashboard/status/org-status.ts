import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { org } from './settings';

const run = promisify(execFile);
const cacheMs = 20_000;
const runsPerRepo = 5;

export type Runner = {
	id: number;
	name: string;
	os: string;
	status: 'online' | 'offline';
	busy: boolean;
	labels: string[];
};

export type Run = {
	id: number;
	repo: string;
	workflow: string;
	title: string;
	branch: string;
	event: string;
	status: string;
	conclusion: string | null;
	createdAt: string;
	updatedAt: string;
	url: string;
};

export type GitHubStatus =
	| { ok: true; runners: Runner[] | null; runnersError: string | null; runs: Run[] }
	| { ok: false; error: string };

let cache: { at: number; data: GitHubStatus } | null = null;
let token: string | null = null;

// The boot task can't read the gh login, so install.ps1 puts the token in .env.local.
async function getToken(): Promise<string> {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
	if (token) return token;
	const { stdout } = await run('gh', ['auth', 'token']);
	token = stdout.trim();
	return token;
}

async function api<T>(path: string): Promise<T> {
	const res = await fetch(`https://api.github.com${path}`, {
		headers: {
			Authorization: `Bearer ${await getToken()}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		cache: 'no-store',
	});
	if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
	return res.json() as Promise<T>;
}

type ApiRunner = { id: number; name: string; os: string; status: 'online' | 'offline'; busy: boolean; labels: { name: string }[] };
type ApiRun = {
	id: number;
	name: string;
	display_title: string;
	head_branch: string;
	event: string;
	status: string;
	conclusion: string | null;
	created_at: string;
	updated_at: string;
	html_url: string;
};

async function runners(): Promise<Runner[]> {
	const { runners } = await api<{ runners: ApiRunner[] }>(`/orgs/${org}/actions/runners?per_page=100`);
	return runners.map((r) => ({ id: r.id, name: r.name, os: r.os, status: r.status, busy: r.busy, labels: r.labels.map((l) => l.name) }));
}

async function runs(): Promise<Run[]> {
	const repos = await api<{ full_name: string; archived: boolean }[]>(`/orgs/${org}/repos?per_page=100&sort=pushed`);
	const lists = await Promise.all(
		repos
			.filter((r) => !r.archived)
			.map(async (repo) => {
				const { workflow_runs } = await api<{ workflow_runs: ApiRun[] }>(
					`/repos/${repo.full_name}/actions/runs?per_page=${runsPerRepo}`,
				);
				return workflow_runs.map((r) => ({
					id: r.id,
					repo: repo.full_name.split('/')[1],
					workflow: r.name,
					title: r.display_title,
					branch: r.head_branch,
					event: r.event,
					status: r.status,
					conclusion: r.conclusion,
					createdAt: r.created_at,
					updatedAt: r.updated_at,
					url: r.html_url,
				}));
			}),
	);
	return lists.flat();
}

async function load(): Promise<GitHubStatus> {
	try {
		const [runnerList, runList] = await Promise.allSettled([runners(), runs()]);
		if (runList.status === 'rejected') throw runList.reason;
		// Listing runners needs admin:org, so runs still show without it.
		return runnerList.status === 'fulfilled'
			? { ok: true, runners: runnerList.value, runnersError: null, runs: runList.value }
			: { ok: true, runners: null, runnersError: String(runnerList.reason?.message ?? runnerList.reason), runs: runList.value };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

export async function githubStatus(): Promise<GitHubStatus> {
	if (cache && Date.now() - cache.at < cacheMs) return cache.data;
	const data = await load();
	cache = { at: Date.now(), data };
	return data;
}
