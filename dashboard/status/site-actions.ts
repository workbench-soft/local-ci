'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { hasUnfinishedRelease } from './release-dispatch-guard.ts';
import { orgName } from './settings.ts';
import { siteWorkflowOf } from './site-deploy.ts';

export type SiteActionResult = { ok: true } | { ok: false; error: string };

const dispatching = new Set<string>();

/** Starts the site deploy workflow of a repo on main. */
export async function dispatchSiteDeploy(repo: string): Promise<SiteActionResult> {
  if (typeof repo !== 'string' || !/^[\w.-]+$/.test(repo)) return { ok: false, error: 'No repo given.' };
  if (dispatching.has(repo)) return { ok: false, error: 'This deploy is being queued.' };
  dispatching.add(repo);
  try {
    // The server finds the workflow itself, so the page can only start a site deploy of an org repo.
    const site = await siteWorkflowOf(repo);
    if (!site) return { ok: false, error: 'No site deploy workflow found for this repo.' };
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
    dispatching.delete(repo);
    forgetOrgStatus();
    revalidatePath('/');
  }
}
