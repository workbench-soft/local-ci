import type { WorkflowRun } from './org-status.ts';
import { activeStatuses } from './placement.ts';

type RunKey = Pick<WorkflowRun, 'id' | 'repo' | 'workflowId' | 'branch' | 'event' | 'status'>;

/** The branches with an open PR, per repo. */
export type OpenPrBranches = Map<string, Set<string>>;

const prEvents = new Set(['pull_request', 'pull_request_target']);

/**
 * The unfinished runs to kill: a newer run of the same repo, workflow, branch and event replaced them,
 * or they check a PR that is already merged or closed. Other workflows of the same push stay,
 * since each builds a different thing.
 */
export function supersededRuns<T extends RunKey>(runs: T[], openPrBranches: OpenPrBranches): T[] {
	// GitHub hands out run ids in order, so the highest id is the newest push.
	const newest = new Map<string, number>();
	for (const run of runs) newest.set(groupOf(run), Math.max(newest.get(groupOf(run)) ?? 0, run.id));
	return runs.filter(
		(run) =>
			activeStatuses.has(run.status) &&
			(run.id < (newest.get(groupOf(run)) ?? 0) || (prEvents.has(run.event) && !openPrBranches.get(run.repo)?.has(run.branch))),
	);
}

/** Repos with an unfinished PR run, the only ones whose open PRs need reading. */
export function reposWithPrRuns(runs: RunKey[]): string[] {
	return [...new Set(runs.filter((run) => activeStatuses.has(run.status) && prEvents.has(run.event)).map((run) => run.repo))];
}

function groupOf(run: RunKey): string {
	return JSON.stringify([run.repo, run.workflowId, run.branch, run.event]);
}
