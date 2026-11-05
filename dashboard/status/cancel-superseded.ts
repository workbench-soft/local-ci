import { loggedCancellation, readCancels, recordCancel, type CancelCause } from './cancel-log.ts';
import { callGitHub, fetchOrgStatus, forgetOrgStatus, githubStatus } from './org-status.ts';
import { orgName } from './settings.ts';
import { cancelCause, failedCheckReleases, replacementRuns } from './superseded.ts';

let started = false;

/** The production server alone cancels replaced builds and releases whose Checks failed. */
export function startCancellingSuperseded(): void {
  if (started || process.env.CANCEL_SUPERSEDED === 'off') return;
  started = true;
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await cancelSuperseded();
    } catch (error) {
      console.error(`${new Date().toISOString()} Couldn't check replaced runs: ${error}`);
    } finally {
      busy = false;
    }
  }, 10_000).unref();
}

async function cancelSuperseded(): Promise<void> {
  const status = await fetchOrgStatus();
  if (!status.ok) return;
  const blocked = failedCheckReleases(status.runs, true);
  if (blocked.length) {
    const recorded = await readCancels();
    await Promise.all(
      blocked
        .filter(({ run }) => !recorded.has(run.id))
        .map(({ run, replacement }) =>
          recordCancel(run.repo, run.id, 'Matching checks failed; publication was blocked', {
            cause: cancelCause('checks-failed', replacement),
            outcome: 'blocked',
          }),
        ),
    );
  }
  const decisions = new Map<number, { repo: string; words: string; cause: CancelCause }>();
  for (const { run, replacement } of replacementRuns(status.runs)) {
    decisions.set(run.id, {
      repo: run.repo,
      words: 'A newer commit started the same build',
      cause: cancelCause('superseded', replacement),
    });
  }
  for (const { run, replacement } of failedCheckReleases(status.runs)) {
    decisions.set(run.id, {
      repo: run.repo,
      words: 'Checks failed for this commit',
      cause: cancelCause('checks-failed', replacement),
    });
  }
  const recorded = await readCancels();
  for (const [id] of decisions) if (recorded.get(id)?.outcome === 'accepted') decisions.delete(id);
  const results = await Promise.allSettled(
    [...decisions].map(async ([id, { repo, words, cause }]) => {
      try {
        await loggedCancellation(repo, id, words, cause, () =>
          callGitHub(`/repos/${orgName}/${repo}/actions/runs/${id}/force-cancel`, 'POST'),
        );
      } catch (error) {
        if (githubStatus(error) === 409) return;
        throw error;
      }
      console.log(
        `${new Date().toISOString()} Cancelled ${repo} run ${id}: ${words}; caused by ${cause.url} (${cause.sha}).`,
      );
    }),
  );
  for (const result of results)
    if (result.status === 'rejected')
      console.error(`${new Date().toISOString()} Cancellation failed: ${result.reason}`);
  if (decisions.size) forgetOrgStatus();
}
