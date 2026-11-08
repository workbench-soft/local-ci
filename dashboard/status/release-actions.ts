'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { releaseTargetFor } from './release-config.ts';
import { orgName } from './settings.ts';
import { activeStatuses } from './placement.ts';

export type ReleaseActionResult = { ok: true } | { ok: false; error: string };

const dispatching = new Set<string>();
const recentlyDispatched = new Map<string, number>();
const dispatchVisibilityMs = 30_000;

/** The workflow's active runs, rather than every run of a shared repository. */
export function hasUnfinishedRelease(runs: readonly { status: string }[]): boolean {
  return runs.some((run) => activeStatuses.has(run.status));
}

/** Starts the app's release workflow on main. */
export async function dispatchRelease(app: string): Promise<ReleaseActionResult> {
  const target = typeof app === 'string' ? releaseTargetFor(app) : null;
  if (!target) return { ok: false, error: 'This app has no configured release workflow.' };
  if (dispatching.has(app) || Date.now() - (recentlyDispatched.get(app) ?? 0) < dispatchVisibilityMs)
    return { ok: false, error: 'A release was just queued. Wait for its status to appear.' };
  dispatching.add(app);
  try {
    const workflow = `/repos/${orgName}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}`;
    const { workflow_runs: runs } = (await (await callGitHub(`${workflow}/runs?branch=main&per_page=30`)).json()) as {
      workflow_runs: { status: string }[];
    };
    if (hasUnfinishedRelease(runs))
      return { ok: false, error: 'This release is already queued or running. Stop it before starting another.' };
    await callGitHub(
      `/repos/${orgName}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}/dispatches`,
      'POST',
      {},
      { ref: 'main', ...(app === 'media-organizer' && { inputs: { bump: 'patch' } }) },
    );
    recentlyDispatched.set(app, Date.now());
    return { ok: true };
  } catch (error) {
    const status = githubStatus(error);
    return {
      ok: false,
      error:
        status === 404
          ? `${target.workflow} is missing or does not allow manual dispatch.`
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
