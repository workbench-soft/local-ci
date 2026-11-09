'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { releaseTargetFor } from './release-config.ts';
import { orgName } from './settings.ts';
import { hasUnfinishedRelease } from './release-dispatch-guard.ts';

export type ReleaseActionResult = { ok: true } | { ok: false; error: string };

const dispatching = new Set<string>();
const recentlyDispatched = new Map<string, number>();
const dispatchVisibilityMs = 30_000;

/** Starts the app's release workflow on main. */
export async function dispatchRelease(app: string): Promise<ReleaseActionResult> {
  const target = typeof app === 'string' ? releaseTargetFor(app) : null;
  if (!target) return { ok: false, error: 'This app has no configured release workflow.' };
  if (dispatching.has(app)) return { ok: false, error: 'This release is being queued.' };
  dispatching.add(app);
  try {
    const workflow = `/repos/${orgName}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}`;
    const { workflow_runs: runs } = (await (await callGitHub(`${workflow}/runs?branch=main&per_page=100`)).json()) as {
      workflow_runs: { status: string; created_at: string }[];
    };
    if (hasUnfinishedRelease(runs))
      return { ok: false, error: 'This release is already queued or running. Stop it before starting another.' };
    const dispatchedAt = recentlyDispatched.get(app);
    if (
      dispatchedAt &&
      Date.now() - dispatchedAt < dispatchVisibilityMs &&
      !runs.some((run) => Date.parse(run.created_at) >= dispatchedAt - 5_000)
    )
      return { ok: false, error: 'A release was just queued. Wait for it to appear on GitHub.' };
    await callGitHub(
      `${workflow}/dispatches`,
      'POST',
      {},
      { ref: 'main', ...(target.inputs && { inputs: target.inputs }) },
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
