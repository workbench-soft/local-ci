'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus } from './org-status.ts';
import { purgeRun } from './purge.ts';
import { orgName } from './settings.ts';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Cancels a run, the way the Cancel workflow button on GitHub does. */
export async function stopRun(repo: string, runId: number): Promise<ActionResult> {
	return runAction(repo, runId, async (path) => {
		await callGitHub(`${path}/cancel`, 'POST');
	});
}

/** Force cancels a run when it hasn't finished, then deletes it from GitHub. */
export async function purgeRunById(repo: string, runId: number): Promise<ActionResult> {
	return runAction(repo, runId, (path) =>
		purgeRun({
			status: async () => ((await (await callGitHub(path)).json()) as { status: string }).status,
			forceCancel: async () => {
				await callGitHub(`${path}/force-cancel`, 'POST');
			},
			remove: async () => {
				await callGitHub(path, 'DELETE');
			},
		}),
	);
}

// The browser sends these arguments, so each one is checked before it goes in a GitHub path.
async function runAction(repo: string, runId: number, act: (path: string) => Promise<void>): Promise<ActionResult> {
	if (!/^[\w.-]+$/.test(repo) || !Number.isSafeInteger(runId) || runId <= 0) return { ok: false, error: 'Unknown run.' };
	try {
		await act(`/repos/${orgName}/${repo}/actions/runs/${runId}`);
		return { ok: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// GitHub answers 409 to a cancel of a run that has already finished.
		return { ok: false, error: message.includes(' 409 ') ? 'The run has already finished.' : message };
	} finally {
		forgetOrgStatus();
		revalidatePath('/');
	}
}
