import type { OrgRunner, RunJob, WorkflowRun } from './org-status.ts';
import type { StepCount } from './progress.ts';
import type { PcRunner, ThisPcStatus } from './this-pc.ts';

/** Statuses of a run or a job that hasn't finished. */
export const activeStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

/** Where a run or a job is: on a runner of this PC, on another runner, in the GitHub queue, or finished. */
export type Place = 'local' | 'elsewhere' | 'waiting' | 'done';

/** An unfinished job, or a whole run when GitHub gave no jobs for it. */
export type LiveJob = {
	key: string;
	/** GitHub cancels whole runs, so a job's buttons act on this run. */
	runId: number;
	repo: string;
	workflow: string;
	name: string | null;
	place: Exclude<Place, 'done'>;
	runnerName: string | null;
	labels: string[];
	since: string;
	url: string;
	/** Null for a whole run without jobs, which has no steps to count. */
	steps: StepCount | null;
	typicalMs: number | null;
};

/** Local first, then the queue, then other runners. */
export const placeOrder: Record<Place, number> = { local: 0, waiting: 1, elsewhere: 2, done: 3 };

/** GitHub names the runner of a job after the runner's agentName, which each runner folder keeps in .runner. */
export function localRunnerNames(pc: ThisPcStatus): Set<string> {
	if (!pc.supported) return new Set();
	return new Set(pc.runners.flatMap((runner) => (runner.name ? [runner.name] : [])));
}

export function placeOfJob(job: Pick<RunJob, 'status' | 'runnerName'>, local: Set<string>): Place {
	if (!activeStatuses.has(job.status)) return 'done';
	if (job.status !== 'in_progress' || !job.runnerName) return 'waiting';
	return local.has(job.runnerName) ? 'local' : 'elsewhere';
}

/** A run is local when any of its jobs builds here, so the person sees each run this PC takes part in. */
export function placeOfRun(run: WorkflowRun, local: Set<string>): Place {
	if (!activeStatuses.has(run.status)) return 'done';
	if (!run.jobs.length) return run.status === 'in_progress' ? 'elsewhere' : 'waiting';
	const places = new Set(run.jobs.map((job) => placeOfJob(job, local)));
	if (places.has('local')) return 'local';
	if (places.has('elsewhere')) return 'elsewhere';
	if (places.has('waiting')) return 'waiting';
	// Every job has finished while the run still wraps up.
	return 'elsewhere';
}

/** The unfinished jobs of all runs, local ones first, then the oldest first. */
export function liveJobs(runs: WorkflowRun[], local: Set<string>): LiveJob[] {
	const jobs = runs.flatMap((run): LiveJob[] => {
		if (!activeStatuses.has(run.status)) return [];
		const base = { runId: run.id, repo: run.repo, workflow: run.workflow };
		if (!run.jobs.length) {
			const place = placeOfRun(run, local) as LiveJob['place'];
			return [{ ...base, key: `run-${run.id}`, name: null, place, runnerName: null, labels: [], since: run.createdAt, url: run.url, steps: null, typicalMs: null }];
		}
		return run.jobs.flatMap((job): LiveJob[] => {
			const place = placeOfJob(job, local);
			if (place === 'done') return [];
			return [{ ...base, key: `job-${job.id}`, name: job.name, place, runnerName: job.runnerName, labels: job.labels, since: job.startedAt ?? run.createdAt, url: job.url, steps: job.steps, typicalMs: job.typicalMs }];
		});
	});
	return jobs.sort((a, b) => placeOrder[a.place] - placeOrder[b.place] || Date.parse(a.since) - Date.parse(b.since));
}

/** A runner of this PC with the job it builds, or a local job whose runner has no folder here. */
export type RunnerSlot = { runner: PcRunner | null; job: LiveJob | undefined };

/** A row per runner of this PC, idle ones too, so the person sees every runner at once. */
export function runnerSlots(pc: ThisPcStatus, jobs: LiveJob[]): RunnerSlot[] {
	const runners = pc.supported ? pc.runners : [];
	const local = jobs.filter((job) => job.place === 'local');
	const slots: RunnerSlot[] = runners.map((runner) => ({ runner, job: local.find((job) => job.runnerName === runner.name) }));
	const names = new Set(runners.map((runner) => runner.name));
	return [...slots, ...local.filter((job) => !names.has(job.runnerName)).map((job) => ({ runner: null, job }))];
}

// GitHub hands a job to a free runner within seconds, so a shorter wait is normal.
const stuckAfterMs = 60_000;

/** A runner takes a job when it has each label the job asks for. */
function fits(job: LiveJob, runner: OrgRunner): boolean {
	const labels = new Set(runner.labels.map((label) => label.toLowerCase()));
	return job.labels.every((label) => labels.has(label.toLowerCase()));
}

/** Runners of this PC that sit idle while a job they could take waits on GitHub for over a minute. */
export function idleWhileQueued(runners: OrgRunner[] | null, local: Set<string>, jobs: LiveJob[], now: number): { idle: string[]; waiting: LiveJob[] } {
	const building = new Set(jobs.filter((job) => job.place === 'local').map((job) => job.runnerName));
	const free = (runners ?? []).filter((runner) => local.has(runner.name) && runner.status === 'online' && !runner.busy && !building.has(runner.name));
	const waiting = jobs.filter((job) => job.place === 'waiting' && now - Date.parse(job.since) > stuckAfterMs && free.some((runner) => fits(job, runner)));
	const idle = free.filter((runner) => waiting.some((job) => fits(job, runner))).map((runner) => runner.name);
	return { idle, waiting };
}
