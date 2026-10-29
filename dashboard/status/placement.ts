import type { RunJob, WorkflowRun } from './org-status.ts';
import type { ThisPcStatus } from './this-pc.ts';

/** Statuses of a run or a job that hasn't finished. */
export const activeStatuses = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);

/** Where a run or a job is: on a runner of this PC, on another runner, in the GitHub queue, or finished. */
export type Place = 'local' | 'elsewhere' | 'waiting' | 'done';

/** An unfinished job, or a whole run when GitHub gave no jobs for it. */
export type LiveJob = {
	key: string;
	repo: string;
	workflow: string;
	name: string | null;
	place: Exclude<Place, 'done'>;
	runnerName: string | null;
	labels: string[];
	since: string;
	url: string;
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
		const base = { repo: run.repo, workflow: run.workflow };
		if (!run.jobs.length) {
			const place = placeOfRun(run, local) as LiveJob['place'];
			return [{ ...base, key: `run-${run.id}`, name: null, place, runnerName: null, labels: [], since: run.createdAt, url: run.url }];
		}
		return run.jobs.flatMap((job): LiveJob[] => {
			const place = placeOfJob(job, local);
			if (place === 'done') return [];
			return [{ ...base, key: `job-${job.id}`, name: job.name, place, runnerName: job.runnerName, labels: job.labels, since: job.startedAt ?? run.createdAt, url: job.url }];
		});
	});
	return jobs.sort((a, b) => placeOrder[a.place] - placeOrder[b.place] || Date.parse(a.since) - Date.parse(b.since));
}
