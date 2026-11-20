import { callGitHub } from './org-status.ts';
import { dispatchable, type RepoWorkflow, textOf, workflowsOf } from './release-workflow.ts';
import { orgName } from './settings.ts';

/** The workflow Deploy site dispatches on main for a repo. */
export type SiteWorkflow = {
  repo: string;
  workflow: number;
  name: string;
  file: string;
  /** Whether GitHub lets us start this deployment from the dashboard. */
  manual: boolean;
};

// A Worker that holds live calls, such as deploy:signal, stays out: a redeploy drops the calls.
const deploysLine =
  /\bwrangler\b[^\n]*\bdeploy\b|actions\/deploy-pages|\bmise\s+run\s+deploy(?!(?::(?:signal|worker)\b))(?::[\w-]+)?\b|deploy-(?:site|web)\b|-site\.git\b/;

/** True for a workflow that puts a website live, including automatic-only deployments. */
export function deploysSite(yaml: string): boolean {
  return deploysLine.test(yaml);
}

export const canDispatch = (yaml: string): boolean => /^\s*workflow_dispatch\s*:/m.test(yaml);

const fileOf = (workflow: RepoWorkflow) => workflow.path.split('/').pop() ?? '';
const rankOf = (file: string) => [/deploy/i, /pages/i, /release/i].findIndex((name) => name.test(file)) >>> 0;

/** All active website deployments of a repo, not just the first one. */
export function findSiteWorkflows(
  workflows: RepoWorkflow[],
  texts: string[],
): { workflow: RepoWorkflow; manual: boolean }[] {
  return workflows.flatMap((workflow, index) => {
    const yaml = texts[index] ?? '';
    return dispatchable(workflow) && deploysSite(yaml) ? [{ workflow, manual: canDispatch(yaml) }] : [];
  });
}

/** The preferred manually dispatchable site workflow, for legacy callers. */
export function pickSiteWorkflow(workflows: RepoWorkflow[], texts: string[]): RepoWorkflow | null {
  const found = findSiteWorkflows(workflows, texts)
    .filter((item) => item.manual)
    .map((item) => item.workflow);
  return (
    found.toSorted((a, b) => rankOf(fileOf(a)) - rankOf(fileOf(b)) || fileOf(a).localeCompare(fileOf(b)))[0] ?? null
  );
}

// The org gains a repo rarely, so its list is read once an hour, like the workflows.
const ttlMs = 60 * 60_000;
let repos: { at: number; names: Promise<string[]> } | null = null;
let lastRepos: string[] = [];

function orgRepos(): Promise<string[]> {
  if (repos && Date.now() - repos.at < ttlMs) return repos.names;
  const names = (async () => {
    const names: string[] = [];
    // The organisation can grow beyond GitHub's 100-repo page.
    for (let page = 1; ; page++) {
      const response = await callGitHub(`/orgs/${orgName}/repos?per_page=100&page=${page}`);
      const batch = (await response.json()) as { name: string; archived: boolean }[];
      names.push(...batch.filter((repo) => !repo.archived).map((repo) => repo.name));
      if (batch.length < 100) break;
    }
    lastRepos = names;
    return names;
  })().catch(() => {
    repos = null;
    return lastRepos;
  });
  repos = { at: Date.now(), names };
  return names;
}

/** Every website workflow in a repository, including ones that deploy only on push. */
export async function siteWorkflowsOf(repo: string): Promise<SiteWorkflow[]> {
  const workflows = (await workflowsOf(repo)).filter(dispatchable);
  const texts = await Promise.all(workflows.map((workflow) => textOf(repo, workflow.path)));
  return findSiteWorkflows(workflows, texts).map(({ workflow, manual }) => ({
    repo,
    workflow: workflow.id,
    name: workflow.name,
    file: fileOf(workflow),
    manual,
  }));
}

/** The site's preferred manually dispatchable workflow, or null when none exists. */
export async function siteWorkflowOf(repo: string): Promise<SiteWorkflow | null> {
  const sites = await siteWorkflowsOf(repo);
  return (
    sites
      .filter((site) => site.manual)
      .toSorted((a, b) => rankOf(a.file) - rankOf(b.file) || a.file.localeCompare(b.file))[0] ?? null
  );
}

/** All distinct site deployments across every org repo, including multi-site repos. */
export async function siteWorkflows(): Promise<SiteWorkflow[]> {
  const names = await orgRepos();
  const found: SiteWorkflow[][] = Array.from({ length: names.length }, () => []);
  let next = 0;
  // Spreading one request per repo plus its YAML requests across the whole org at once
  // trips GitHub's secondary limits and silently leaves sites out. Keep a small pool.
  await Promise.all(
    Array.from({ length: Math.min(6, names.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= names.length) return;
        found[index] = await siteWorkflowsOf(names[index]);
      }
    }),
  );
  return found
    .flat()
    .toSorted((a, b) => a.repo.localeCompare(b.repo) || a.name.localeCompare(b.name) || a.workflow - b.workflow);
}
