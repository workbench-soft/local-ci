'use server';

import { revalidatePath } from 'next/cache';
import type { JobTiming } from './durations.ts';
import { callGitHub, forgetOrgStatus, githubStatus, readJobTimings } from './org-status.ts';
import { purgeRun, purgeRuns } from './purge.ts';
import { orgName } from './settings.ts';

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PurgeAllResult = { purged: number; failed: number; error: string | null };

/** Cancels a run, the way the Cancel workflow button on GitHub does. */
export async function stopRun(repo: string, runId: number): Promise<ActionResult> {
	return runAction(repo, runId, async (path) => {
		await callGitHub(`${path}/cancel`, 'POST');
	});
}

/** The jobs and steps of a run with their times. It only reads, so the page stays as it is. */
export async function runTimings(repo: string, runId: number): Promise<{ ok: true; jobs: JobTiming[] } | { ok: false; error: string }> {
	if (!isRun(repo, runId)) return { ok: false, error: 'Unknown run.' };
	try {
		return { ok: true, jobs: await readJobTimings(repo, runId) };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Force cancels a run when it hasn't finished, then deletes it from GitHub. */
export async function purgeRunById(repo: string, runId: number): Promise<ActionResult> {
	return runAction(repo, runId, purgeAt);
}

/** Purges each run of the list, 5 at a time. */
export async function purgeAllRuns(runs: { repo: string; runId: number }[]): Promise<PurgeAllResult> {
	if (!Array.isArray(runs) || !runs.every((run) => isRun(run?.repo, run?.runId))) return { purged: 0, failed: 0, error: 'Unknown run.' };
	try {
		const failures = await purgeRuns(runs, (run) => purgeAt(runPath(run.repo, run.runId)));
		const first = failures[0];
		return { purged: runs.length - failures.length, failed: failures.length, error: first ? `${first.run.repo}: ${first.error}` : null };
	} finally {
		forgetOrgStatus();
		revalidatePath('/');
	}
}

function purgeAt(path: string): Promise<void> {
	return purgeRun({
		status: async () => ((await (await callGitHub(path)).json()) as { status: string }).status,
		forceCancel: async () => {
			await callGitHub(`${path}/force-cancel`, 'POST');
		},
		remove: async () => {
			await callGitHub(path, 'DELETE');
		},
	});
}

// The browser sends these arguments, so each one is checked before it goes in a GitHub path.
function isRun(repo: unknown, runId: unknown): boolean {
	return typeof repo === 'string' && /^[\w.-]+$/.test(repo) && typeof runId === 'number' && Number.isSafeInteger(runId) && runId > 0;
}

function runPath(repo: string, runId: number): string {
	return `/repos/${orgName}/${repo}/actions/runs/${runId}`;
}

async function runAction(repo: string, runId: number, act: (path: string) => Promise<void>): Promise<ActionResult> {
	if (!isRun(repo, runId)) return { ok: false, error: 'Unknown run.' };
	try {
		await act(runPath(repo, runId));
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// GitHub answers 409 to a cancel of a run that has already finished, and 404 to a run deleted meanwhile.
		const status = githubStatus(error);
		return { ok: false, error: status === 409 ? 'The run has already finished.' : status === 404 ? 'The run is already gone.' : message };
	} finally {
		forgetOrgStatus();
		revalidatePath('/');
	}
}
