import { appOfTag, repoOfApp } from './latest-releases.ts';
import { callGitHub } from './org-status.ts';
import { releaseTargetFor } from './release-config.ts';
import { type Release, releasesByRun } from './releases.ts';
import { orgName } from './settings.ts';

/** A workflow of a repo, as GitHub lists it. */
export type RepoWorkflow = { id: number; name: string; path: string; state: string };

/** The workflow Release on CI dispatches on main for an app. */
export type ReleaseWorkflow = {
  repo: string;
  workflow: string | number;
  name: string;
  inputs?: Record<string, string>;
};

type Run = { id: number; repo: string; workflowId: number; createdAt: string; updatedAt: string };

// A repo gains a release workflow rarely, so its list is read once an hour.
const ttlMs = 60 * 60_000;
const listed = new Map<string, { at: number; workflows: Promise<RepoWorkflow[]> }>();

function workflowsOf(repo: string): Promise<RepoWorkflow[]> {
  const kept = listed.get(repo);
  if (kept && Date.now() - kept.at < ttlMs) return kept.workflows;
  const workflows = callGitHub(`/repos/${orgName}/${encodeURIComponent(repo)}/actions/workflows?per_page=100`)
    .then((response) => response.json() as Promise<{ workflows: RepoWorkflow[] }>)
    .then((answer) => answer.workflows)
    .catch(() => {
      listed.delete(repo);
      return [];
    });
  listed.set(repo, { at: Date.now(), workflows });
  return workflows;
}

/**
 * The release workflow among a repo's workflows. A file named for a release or deploy wins. With several,
 * the one whose run made the newest release decides, then a lone release file beside deploy files. Two
 * release files with no such run pick none, since a wrong guess would ship another app. A repo with no
 * such file uses the workflow that made the release.
 */
export function pickReleaseWorkflow(workflows: RepoWorkflow[], madeBy: number | null): RepoWorkflow | null {
  const active = workflows.filter((workflow) => workflow.state === 'active');
  const named = active.filter((workflow) => /release|deploy/i.test(workflow.path.split('/').pop() ?? ''));
  const maker = active.find((workflow) => workflow.id === madeBy) ?? null;
  if (!named.length) return maker;
  const releases = named.filter((workflow) => /release/i.test(workflow.path.split('/').pop() ?? ''));
  return (
    named.find((workflow) => workflow === maker) ??
    (named.length === 1 ? named[0] : releases.length === 1 ? releases[0] : null)
  );
}

/** The workflow that releases an app again from main, or null when the page can't tell which one it is. */
export async function releaseWorkflowFor(
  app: string,
  runs: Run[],
  releases: Release[],
): Promise<ReleaseWorkflow | null> {
  const target = releaseTargetFor(app);
  if (target) return { repo: target.repo, workflow: target.workflow, name: target.workflow, inputs: target.inputs };
  const repo = repoOfApp(app);
  const newest = releases
    .filter((release) => appOfTag(release.tag) === app)
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  const madeBy = newest ? [...releasesByRun(runs, releases)].find(([, release]) => release === newest)?.[0] : undefined;
  const maker = runs.find((run) => run.id === madeBy)?.workflowId ?? null;
  const workflow = pickReleaseWorkflow(await workflowsOf(repo), maker);
  return workflow && { repo, workflow: workflow.id, name: workflow.path.split('/').pop() ?? workflow.name };
}
