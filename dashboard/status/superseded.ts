import type { WorkflowRun } from './org-status.ts';
import { activeStatuses } from './placement.ts';

type RunKey = Pick<WorkflowRun, 'id' | 'repo' | 'workflowId' | 'branch' | 'event' | 'status'>;

/** The branches with an open PR, per repo. A repo whose list couldn't be read is missing. */
export type OpenPrBranches = Map<string, Set<string>>;

const prEvents = new Set(['pull_request', 'pull_request_target']);
// workflow_run and schedule runs all report the default branch, so their workflows group them with concurrency keys of their own.
const replaceableEvents = new Set(['push', ...prEvents]);

/**
 * The unfinished runs to kill: a newer run of the same repo, workflow, branch and event replaced them,
 * or they check a PR that is already merged or closed. Only push and PR runs get replaced. Other
 * workflows of the same push stay, since each builds a different thing. A PR run of a repo missing
 * from openPrBranches stays.
 */
export function supersededRuns<T extends RunKey>(runs: T[], openPrBranches: OpenPrBranches): T[] {
	// GitHub hands out run ids in order, so the highest id is the newest push.
	const newest = new Map<string, number>();
	for (const run of runs) newest.set(groupOf(run), Math.max(newest.get(groupOf(run)) ?? 0, run.id));
	return runs.filter(
		(run) =>
			activeStatuses.has(run.status) &&
			((replaceableEvents.has(run.event) && run.id < (newest.get(groupOf(run)) ?? 0)) || (prEvents.has(run.event) && openPrBranches.has(run.repo) && !openPrBranches.get(run.repo)?.has(run.branch))),
	);
}

/**
 * The repos whose open PR list needs a fresh read: never read, older than maxAgeMs, or read before
 * one of its PR runs started. A PR opened after the last read would otherwise look closed.
 */
export function prListsToRead(runs: (RunKey & Pick<WorkflowRun, 'createdAt'>)[], readAt: Map<string, number>, now: number, maxAgeMs: number): string[] {
	return reposWithPrRuns(runs).filter((repo) => {
		const at = readAt.get(repo);
		if (at === undefined || now - at >= maxAgeMs) return true;
		return runs.some((run) => run.repo === repo && activeStatuses.has(run.status) && prEvents.has(run.event) && Date.parse(run.createdAt) >= at);
	});
}

/** Repos with an unfinished PR run, the only ones whose open PRs need reading. */
export function reposWithPrRuns(runs: RunKey[]): string[] {
	return [...new Set(runs.filter((run) => activeStatuses.has(run.status) && prEvents.has(run.event)).map((run) => run.repo))];
}

function groupOf(run: RunKey): string {
	return JSON.stringify([run.repo, run.workflowId, run.branch, run.event]);
}
