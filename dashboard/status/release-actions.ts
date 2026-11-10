'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, fetchOrgStatus, forgetOrgStatus, githubStatus } from './org-status.ts';
import { releaseWorkflowFor } from './release-workflow.ts';
import { orgName } from './settings.ts';
import { dispatchSlackMs, dispatchVisibilityMs, hasUnfinishedRelease } from './release-dispatch-guard.ts';

export type ReleaseActionResult = { ok: true } | { ok: false; error: string };

const dispatching = new Set<string>();
const recentlyDispatched = new Map<string, number>();

/** Starts the app's release workflow on main, also when main is already released. */
export async function dispatchRelease(app: string): Promise<ReleaseActionResult> {
  if (typeof app !== 'string') return { ok: false, error: 'No app given.' };
  if (dispatching.has(app)) return { ok: false, error: 'This release is being queued.' };
  dispatching.add(app);
  let target: Awaited<ReturnType<typeof releaseWorkflowFor>> = null;
  try {
    // The server finds the workflow itself, so the page can only start a release workflow of an org app.
    const org = await fetchOrgStatus();
    target = await releaseWorkflowFor(app, org.ok ? org.releases : []);
    if (!target) return { ok: false, error: 'No release workflow found for this app.' };
    const workflow = `/repos/${orgName}/${target.repo}/actions/workflows/${target.workflow}`;
    const { workflow_runs: runs } = (await (await callGitHub(`${workflow}/runs?branch=main&per_page=100`)).json()) as {
      workflow_runs: { status: string; created_at: string }[];
    };
    if (hasUnfinishedRelease(runs))
      return { ok: false, error: 'This release is already queued or running. Stop it before starting another.' };
    const dispatchedAt = recentlyDispatched.get(app);
    if (
      dispatchedAt &&
      Date.now() - dispatchedAt < dispatchVisibilityMs &&
      !runs.some((run) => Date.parse(run.created_at) >= dispatchedAt - dispatchSlackMs)
    )
      return { ok: false, error: 'A release was just queued. Wait for it to appear on GitHub.' };
    await callGitHub(
      `${workflow}/dispatches`,
      'POST',
      {},
      // Each input of the workflow takes its default.
      { ref: 'main' },
    );
    recentlyDispatched.set(app, Date.now());
    return { ok: true };
  } catch (error) {
    const status = githubStatus(error);
    return {
      ok: false,
      error:
        status === 404 || status === 422
          ? `${target?.name ?? 'The release workflow'} is missing or does not allow manual dispatch.`
          : error instanceof Error
            ? error.message
            : String(error),
    };
  } finally {
    dispatching.delete(app);
    forgetOrgStatus();
    revalidatePath('/');
  }
}
