import { callGitHub } from './org-status.ts';
import { orgName } from './settings.ts';

type Run = { event: string };

/** The Checks workflow file the release gate of a Release workflow waits for, such as checks.yml. */
export function checksWorkflowOf(releaseYaml: string): string | null {
  return /^\s*CHECKS_WORKFLOW:\s*['"]?([\w.-]+\.ya?ml)/m.exec(releaseYaml)?.[1] ?? null;
}

/** True when no Checks run of the commit came from a push or a start by hand, so its build waits for none. */
export function lacksChecks(runs: readonly Run[]): boolean {
  return !runs.some((run) => run.event === 'push' || run.event === 'workflow_dispatch');
}

/**
 * Starts Checks on main when its tip has none, as after a docs change their push filter skips.
 * The release gate publishes a build through workflow_run of Checks, and GitHub fires that only for a run
 * a person's token started, so the page starts them here and not the gate with the job's token.
 */
export async function startMissingChecks(repo: string, releaseYaml: string): Promise<boolean> {
  const checks = checksWorkflowOf(releaseYaml);
  if (!checks) return false;
  const base = `/repos/${orgName}/${encodeURIComponent(repo)}`;
  const { sha } = (await (await callGitHub(`${base}/commits/main`)).json()) as { sha: string };
  const workflow = `${base}/actions/workflows/${checks}`;
  const { workflow_runs: runs } = (await (
    await callGitHub(`${workflow}/runs?head_sha=${sha}&branch=main&per_page=20`)
  ).json()) as { workflow_runs: Run[] };
  if (!lacksChecks(runs)) return false;
  await callGitHub(`${workflow}/dispatches`, 'POST', {}, { ref: 'main' });
  return true;
}
