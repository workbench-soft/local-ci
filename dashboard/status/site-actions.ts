'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { hasUnfinishedRelease } from './release-dispatch-guard.ts';
import { orgName } from './settings.ts';
import { siteWorkflowsOf } from './site-deploy.ts';

export type SiteActionResult = { ok: true } | { ok: false; error: string };

const dispatching = new Set<string>();

/** Starts exactly the selected validated site deployment workflow on main. */
export async function dispatchSiteDeploy(repo: string, workflowId: number): Promise<SiteActionResult> {
  if (typeof repo !== 'string' || !/^[\w.-]+$/.test(repo)) return { ok: false, error: 'No repo given.' };
  if (!Number.isSafeInteger(workflowId) || workflowId <= 0) return { ok: false, error: 'Invalid workflow.' };
  const key = `${repo}/${workflowId}`;
  if (dispatching.has(key)) return { ok: false, error: 'This deploy is being queued.' };
  dispatching.add(key);
  try {
    // Validate the workflow on the server; a browser-provided ID cannot dispatch an arbitrary workflow.
    const site = (await siteWorkflowsOf(repo)).find((item) => item.workflow === workflowId && item.manual);
    if (!site) return { ok: false, error: 'No manually dispatchable site workflow found.' };
    const workflow = `/repos/${orgName}/${repo}/actions/workflows/${site.workflow}`;
    const { workflow_runs: runs } = (await (await callGitHub(`${workflow}/runs?branch=main&per_page=20`)).json()) as {
      workflow_runs: { status: string }[];
    };
    if (hasUnfinishedRelease(runs)) return { ok: false, error: 'A deploy of this site is already queued or running.' };
    await callGitHub(`${workflow}/dispatches`, 'POST', {}, { ref: 'main' });
    return { ok: true };
  } catch (error) {
    const status = githubStatus(error);
    return {
      ok: false,
      error:
        status === 404 || status === 422
          ? 'The deploy workflow is missing or does not allow manual dispatch.'
          : error instanceof Error
            ? error.message
            : String(error),
    };
  } finally {
    dispatching.delete(key);
    forgetOrgStatus();
    revalidatePath('/');
  }
}
