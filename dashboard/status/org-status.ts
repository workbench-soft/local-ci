import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { activeStatuses } from './placement.ts';
import { countSteps, type StepCount, typicalDuration } from './progress.ts';
import { type ApiRelease, type Release, releasesRepo, toRelease } from './releases.ts';
import { orgName } from './settings.ts';

export type OrgRunner = {
	id: number;
	name: string;
	os: string;
	status: 'online' | 'offline';
	busy: boolean;
	labels: string[];
};

export type WorkflowRun = {
	id: number;
	repo: string;
	workflow: string;
	workflowId: number;
	title: string;
	branch: string;
	event: string;
	status: string;
	conclusion: string | null;
	createdAt: string;
	updatedAt: string;
	url: string;
	/** The branch on GitHub. */
	branchUrl: string;
	/** The pull requests of the branch in the same repo. GitHub leaves out PRs from forks. */
	pullRequests: { number: number; url: string }[];
	/** Read only for runs that haven't finished or that failed. */
	jobs: RunJob[];
};

/** The first failed job of a run and its failed step. */
export type RunFailure = { job: string; step: string | null; url: string };

/** A job of a run, with the runner that took it. A queued job has no runner yet. */
export type RunJob = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	runnerName: string | null;
	labels: string[];
	startedAt: string | null;
	completedAt: string | null;
	url: string;
	/** The first step that failed, for a failed job. */
	failedStep: string | null;
	steps: StepCount;
	/** How long this job took in the latest successful runs of its workflow. Set only on running jobs. */
	typicalMs: number | null;
};

export type OrgStatus =
	| { ok: true; runners: OrgRunner[] | null; runnersError: string | null; runs: WorkflowRun[]; releases: Release[] }
	| { ok: false; error: string };

const execFileAsync = promisify(execFile);
const cacheTtlMs = 20_000;
const runsPerRepo = 5;
// One call reads 30 runs as cheaply as 5, and an unfinished run sits among the recent ones.
const runsRead = 30;
const queuedJobsTtlMs = 60_000;

let cached: { at: number; status: Promise<OrgStatus> } | null = null;
let ghToken: string | null = null;

/** The org's runners and the latest runs of its repos, kept for 20 s so open tabs share one set of calls. */
export function fetchOrgStatus(): Promise<OrgStatus> {
	if (cached && Date.now() - cached.at < cacheTtlMs) return cached.status;
	// The promise goes in the cache before it settles, so requests that arrive meanwhile wait for the same load.
	const status = loadOrgStatus();
	cached = { at: Date.now(), status };
	return status;
}

/** Drops the cached status, so the next render reads GitHub after a run changed. */
export function forgetOrgStatus(): void {
	cached = null;
}

async function loadOrgStatus(): Promise<OrgStatus> {
	try {
		const [runners, runs, releases] = await Promise.allSettled([listRunners(), listLatestRuns(), listReleases()]);
		if (runs.status === 'rejected') throw runs.reason;
		// Releases only add a column, so the page shows without them.
		const found = releases.status === 'fulfilled' ? releases.value : [];
		// Runners need admin:org. Without it the runs still show.
		if (runners.status === 'rejected') {
			return { ok: true, runners: null, runnersError: String(runners.reason?.message ?? runners.reason), runs: runs.value, releases: found };
		}
		return { ok: true, runners: runners.value, runnersError: null, runs: runs.value, releases: found };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

type ApiRunner = Omit<OrgRunner, 'labels'> & { labels: { name: string }[] };

type ApiRun = {
	workflow_id: number;
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
	pull_requests?: { number: number }[];
};

type ApiJob = {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	runner_name: string | null;
	labels: string[];
	started_at: string | null;
	completed_at: string | null;
	html_url: string;
	steps?: { name: string; status: string; conclusion: string | null }[];
};

async function listRunners(): Promise<OrgRunner[]> {
	const { runners } = await getJson<{ runners: ApiRunner[] }>(`/orgs/${orgName}/actions/runners?per_page=100`);
	return runners.map(({ id, name, os, status, busy, labels }) => ({ id, name, os, status, busy, labels: labels.map((label) => label.name) }));
}

async function listLatestRuns(): Promise<WorkflowRun[]> {
	const repos = await getJson<{ full_name: string; archived: boolean }[]>(`/orgs/${orgName}/repos?per_page=100&sort=pushed`);
	const perRepo = await Promise.allSettled(repos.filter((repo) => !repo.archived).map((repo) => listRepoRuns(repo.full_name)));
	// One repo that GitHub refuses, say with Actions turned off, drops out alone.
	return perRepo.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

/**
 * The latest runs of a repo, plus every unfinished run among the runs read.
 * A busy repo queues newer runs on top of the one that builds, so the latest 5 alone hide it.
 */
export function pickRuns<T extends Pick<ApiRun, 'status'>>(runs: T[]): T[] {
	return runs.filter((run, index) => index < runsPerRepo || activeStatuses.has(run.status));
}

async function listRepoRuns(fullName: string): Promise<WorkflowRun[]> {
	const { workflow_runs } = await getJson<{ workflow_runs: ApiRun[] }>(`/repos/${fullName}/actions/runs?per_page=${runsRead}`);
	const repo = fullName.split('/')[1];
	const runs = await Promise.all(
		pickRuns(workflow_runs).map(async (run) => ({
			id: run.id,
			repo,
			workflow: run.name,
			workflowId: run.workflow_id,
			title: run.display_title,
			branch: run.head_branch,
			event: run.event,
			status: run.status,
			conclusion: run.conclusion,
			createdAt: run.created_at,
			updatedAt: run.updated_at,
			url: run.html_url,
			branchUrl: `https://github.com/${fullName}/tree/${run.head_branch.split('/').map(encodeURIComponent).join('/')}`,
			pullRequests: (run.pull_requests ?? []).map(({ number }) => ({ number, url: `https://github.com/${fullName}/pull/${number}` })),
			jobs: activeStatuses.has(run.status)
				? await activeRunJobs(fullName, run)
				: failedConclusions.has(run.conclusion ?? '')
					? await listRunJobs(fullName, run.id)
					: [],
		})),
	);
	await addTypicalTimes(fullName, runs);
	return runs;
}

/** The 3 latest successful runs of a workflow give the usual length of each of its running jobs. */
async function addTypicalTimes(fullName: string, runs: WorkflowRun[]): Promise<void> {
	const running = runs.flatMap((run) => run.jobs.filter((job) => job.status === 'in_progress').map((job) => ({ run, job })));
	if (!running.length) return;
	const workflowIds = new Set(running.map(({ run }) => run.workflowId));
	const pastByWorkflow = new Map<number, RunJob[]>();
	await Promise.all(
		[...workflowIds].map(async (workflowId) => {
			const ids = await latestSuccessfulRuns(fullName, workflowId);
			const jobs = await Promise.all(ids.map((id) => finishedRunJobs(fullName, id)));
			pastByWorkflow.set(workflowId, jobs.flat().filter((job) => job.conclusion === 'success'));
		}),
	);
	for (const { run, job } of running) job.typicalMs = typicalDuration(job.name, pastByWorkflow.get(run.workflowId) ?? []);
}

// The latest 5 runs of a busy repo are often all queued, so the successful ones come from a call of their own.
async function latestSuccessfulRuns(fullName: string, workflowId: number): Promise<number[]> {
	try {
		const { workflow_runs } = await getJson<{ workflow_runs: { id: number }[] }>(
			`/repos/${fullName}/actions/workflows/${workflowId}/runs?status=success&per_page=3`,
		);
		return workflow_runs.map((run) => run.id);
	} catch {
		return [];
	}
}

// A queue of 20 runs would cost 20 calls a load. GitHub bumps updated_at when a job of the run starts.
const queuedJobs = new Map<number, { at: number; updatedAt: string; jobs: Promise<RunJob[]> }>();

async function activeRunJobs(fullName: string, run: ApiRun): Promise<RunJob[]> {
	if (run.status !== 'queued') {
		queuedJobs.delete(run.id);
		return listRunJobs(fullName, run.id);
	}
	const kept = queuedJobs.get(run.id);
	// A queued run can hold a job that builds already, and its steps move on each load.
	if (kept && kept.updatedAt === run.updated_at && Date.now() - kept.at < queuedJobsTtlMs) {
		const jobs = await kept.jobs;
		// A failed call gave no jobs, so it gets another try.
		if (jobs.length && !jobs.some((job) => job.status === 'in_progress')) return jobs;
	}
	const jobs = listRunJobs(fullName, run.id);
	queuedJobs.set(run.id, { at: Date.now(), updatedAt: run.updated_at, jobs });
	for (const [id, entry] of queuedJobs) if (Date.now() - entry.at >= queuedJobsTtlMs) queuedJobs.delete(id);
	return jobs;
}

// A finished run never changes, so its jobs are read once. The oldest entry goes past 200 runs.
const finishedJobs = new Map<number, Promise<RunJob[]>>();

function finishedRunJobs(fullName: string, runId: number): Promise<RunJob[]> {
	let jobs = finishedJobs.get(runId);
	if (!jobs) {
		jobs = listRunJobs(fullName, runId);
		finishedJobs.set(runId, jobs);
		// A failed call gives no jobs, so the next load tries again.
		void jobs.then((list) => list.length || finishedJobs.delete(runId));
		if (finishedJobs.size > 200) finishedJobs.delete(finishedJobs.keys().next().value as number);
	}
	return jobs;
}

const failedConclusions = new Set(['failure', 'timed_out', 'startup_failure']);

/** The first failed job of a failed run, so the table can say where it broke. */
export function failureOf(run: Pick<WorkflowRun, 'conclusion' | 'jobs'>): RunFailure | null {
	if (!failedConclusions.has(run.conclusion ?? '')) return null;
	const job = run.jobs.find((item) => failedConclusions.has(item.conclusion ?? ''));
	return job ? { job: job.name, step: job.failedStep, url: job.url } : null;
}

// The public repo keeps 3 releases per app, so one page holds them all.
async function listReleases(): Promise<Release[]> {
	const releases = await getJson<ApiRelease[]>(`/repos/${releasesRepo}/releases?per_page=100`);
	return Array.isArray(releases) ? releases.map(toRelease) : [];
}

// Only the jobs tell which runner builds a run, and which step failed. A failed call leaves the run without them.
async function listRunJobs(fullName: string, runId: number): Promise<RunJob[]> {
	try {
		const { jobs } = await getJson<{ jobs: ApiJob[] }>(`/repos/${fullName}/actions/runs/${runId}/jobs?per_page=100`);
		return jobs.map((job) => ({
			id: job.id,
			name: job.name,
			status: job.status,
			conclusion: job.conclusion,
			runnerName: job.runner_name || null,
			labels: job.labels,
			startedAt: job.started_at,
			completedAt: job.completed_at,
			url: job.html_url,
			failedStep: job.steps?.find((step) => failedConclusions.has(step.conclusion ?? ''))?.name ?? null,
			steps: countSteps(job.steps),
			typicalMs: null,
		}));
	} catch {
		return [];
	}
}

async function getJson<T>(path: string): Promise<T> {
	return (await callGitHub(path)).json() as Promise<T>;
}

/** One GitHub API call with the page's token. A status outside 2xx throws with the path in the message. */
export async function callGitHub(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET'): Promise<Response> {
	const response = await fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${await resolveToken()}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
		},
		cache: 'no-store',
	});
	if (!response.ok) throw new Error(`GitHub answered ${response.status} to ${method} ${path}`);
	return response;
}

// The boot task can't reach the gh login, so install.ps1 leaves GITHUB_TOKEN in .env.local.
async function resolveToken(): Promise<string> {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
	if (!ghToken) ghToken = (await execFileAsync('gh', ['auth', 'token'])).stdout.trim();
	return ghToken;
}
