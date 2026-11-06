'use server';

import { revalidatePath } from 'next/cache';
import { recordCancel } from './cancel-log.ts';
import type { JobTiming } from './durations.ts';
import { callGitHub, forgetOrgStatus, forgetRunJobs, githubStatus, readJobTimings } from './org-status.ts';
import { purgeRun, purgeRuns } from './purge.ts';
import { orgName } from './settings.ts';
import { canRetryRun } from './retry-policy.ts';

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PurgeAllResult = { purged: number; failed: number; failedIds: number[]; error: string | null };

/** Retry a failed GitHub Actions workflow, either failed jobs alone or every job. */
export async function retryRun(repo: string, runId: number, failedOnly: boolean): Promise<ActionResult> {
  if (!isRun(repo, runId) || typeof failedOnly !== 'boolean') return { ok: false, error: 'Unknown run.' };
  try {
    const path = runPath(repo, runId);
    const { status, conclusion } = (await (await callGitHub(path)).json()) as {
      status: string;
      conclusion: string | null;
    };
    if (!canRetryRun(status, conclusion))
      return { ok: false, error: 'Only completed failed runs can be retried.' };
    await callGitHub(`${path}/${failedOnly ? 'rerun-failed-jobs' : 'rerun'}`, 'POST');
    return { ok: true };
  } catch (error) {
    const status = githubStatus(error);
    return {
      ok: false,
      error:
        status === 403
          ? 'GitHub refused the retry. The configured token needs Actions: write permission for this repository.'
          : status === 404
            ? 'The run no longer exists or is not accessible.'
            : status === 409 || status === 422
              ? 'GitHub cannot retry this run now. Refresh and try again.'
              : error instanceof Error
                ? error.message
                : String(error),
    };
  } finally {
    forgetRunJobs(runId);
    forgetOrgStatus();
    revalidatePath('/');
  }
}

/** Force cancels a run. It also skips steps with if: always(), so the runner takes the next job at once. */
export async function stopRun(repo: string, runId: number): Promise<ActionResult> {
  return runAction(
    repo,
    runId,
    async (path) => {
      await callGitHub(`${path}/force-cancel`, 'POST');
    },
    'Stopped from the page',
  );
}

/** Whether GitHub reads the run as completed. It only reads, so the page stays as it is. */
export async function runFinished(
  repo: string,
  runId: number,
): Promise<{ ok: true; finished: boolean } | { ok: false; error: string }> {
  if (!isRun(repo, runId)) return { ok: false, error: 'Unknown run.' };
  try {
    const { status } = (await (await callGitHub(runPath(repo, runId))).json()) as { status: string };
    return { ok: true, finished: status === 'completed' };
  } catch (error) {
    // A run deleted meanwhile has stopped too.
    if (githubStatus(error) === 404) return { ok: true, finished: true };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** The jobs and steps of a run with their times. It only reads, so the page stays as it is. */
export async function runTimings(
  repo: string,
  runId: number,
): Promise<{ ok: true; jobs: JobTiming[] } | { ok: false; error: string }> {
  if (!isRun(repo, runId)) return { ok: false, error: 'Unknown run.' };
  try {
    return { ok: true, jobs: await readJobTimings(repo, runId) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Force cancels a run when it hasn't finished, then deletes it from GitHub. */
export async function purgeRunById(repo: string, runId: number): Promise<ActionResult> {
  return runAction(repo, runId, purgeAt, 'Purged from the page');
}

/** Purges each run of the list, 5 at a time. */
export async function purgeAllRuns(runs: { repo: string; runId: number }[]): Promise<PurgeAllResult> {
  if (!Array.isArray(runs) || !runs.every((run) => isRun(run?.repo, run?.runId)))
    return { purged: 0, failed: 0, failedIds: [], error: 'Unknown run.' };
  try {
    const failures = await purgeRuns(runs, (run) => purgeAt(runPath(run.repo, run.runId)));
    const first = failures[0];
    const failedIds = new Set(failures.map((failure) => failure.run.runId));
    // Only the runs that truly went get a reason, so a refused one keeps its old story.
    await Promise.all(
      runs
        .filter((run) => !failedIds.has(run.runId))
        .map((run) => recordCancel(run.repo, run.runId, 'Purged from the page')),
    );
    return {
      purged: runs.length - failures.length,
      failed: failures.length,
      failedIds: [...failedIds],
      error: first ? `${first.run.repo}: ${first.error}` : null,
    };
  } finally {
    forgetOrgStatus();
    revalidatePath('/');
  }
}

function purgeAt(path: string): Promise<void> {
  return purgeRun({
    status: async () => ((await (await callGitHub(path)).json()) as { status: string }).status,
    forceCancel: async () => {
      const parts = path.split('/');
      const repo = parts[3];
      const runId = Number(parts[6]);
      await recordCancel(repo, runId, 'Purged from the page', { cause: { kind: 'manual' }, outcome: 'requested' });
      await callGitHub(`${path}/force-cancel`, 'POST');
      await recordCancel(repo, runId, 'Purged from the page', { cause: { kind: 'manual' }, outcome: 'accepted' });
    },
    remove: async () => {
      await callGitHub(path, 'DELETE');
    },
  });
}

// The browser sends these arguments, so each one is checked before it goes in a GitHub path.
function isRun(repo: unknown, runId: unknown): boolean {
  return (
    typeof repo === 'string' &&
    /^[\w.-]+$/.test(repo) &&
    typeof runId === 'number' &&
    Number.isSafeInteger(runId) &&
    runId > 0
  );
}

function runPath(repo: string, runId: number): string {
  return `/repos/${orgName}/${repo}/actions/runs/${runId}`;
}

async function runAction(
  repo: string,
  runId: number,
  act: (path: string) => Promise<void>,
  words: string,
): Promise<ActionResult> {
  if (!isRun(repo, runId)) return { ok: false, error: 'Unknown run.' };
  try {
    await recordCancel(repo, runId, words, { cause: { kind: 'manual' }, outcome: 'requested' });
    await act(runPath(repo, runId));
    // The reason reaches the Releases tab, so a stopped release says who stopped it.
    await recordCancel(repo, runId, words, { cause: { kind: 'manual' }, outcome: 'accepted' });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordCancel(repo, runId, words, { cause: { kind: 'manual' }, outcome: 'failed' }).catch(() => {});
    // GitHub answers 409 to a cancel of a run that has already finished, and 404 to a run deleted meanwhile.
    const status = githubStatus(error);
    return {
      ok: false,
      error: status === 409 ? 'The run has already finished.' : status === 404 ? 'The run is already gone.' : message,
    };
  } finally {
    forgetOrgStatus();
    revalidatePath('/');
  }
}
