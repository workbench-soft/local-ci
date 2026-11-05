'use server';

import { revalidatePath } from 'next/cache';
import { callGitHub, forgetOrgStatus, githubStatus } from './org-status.ts';
import { releaseTargetFor } from './release-config.ts';
import { orgName } from './settings.ts';

export type ReleaseActionResult = { ok: true } | { ok: false; error: string };

/** Starts the app's release workflow on main. */
export async function dispatchRelease(app: string): Promise<ReleaseActionResult> {
  const target = typeof app === 'string' ? releaseTargetFor(app) : null;
  if (!target) return { ok: false, error: 'This app has no configured release workflow.' };
  try {
    await callGitHub(
      `/repos/${orgName}/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}/dispatches`,
      'POST',
      {},
      { ref: 'main', ...(app === 'media-organizer' && { inputs: { bump: 'patch' } }) },
    );
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
    forgetOrgStatus();
    revalidatePath('/');
  }
}
