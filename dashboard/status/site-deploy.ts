import { callGitHub } from './org-status.ts';
import { dispatchable, type RepoWorkflow, textOf, workflowsOf } from './release-workflow.ts';
import { orgName } from './settings.ts';

/** The workflow Deploy site dispatches on main for a repo. */
export type SiteWorkflow = { repo: string; workflow: number; name: string; file: string };

// A Worker that holds live calls, such as deploy:signal, stays out: a redeploy drops the calls.
const deploysLine =
  /\bwrangler\b[^\n]*\bdeploy\b|actions\/deploy-pages|mise run deploy(?!:(?:signal|worker))\b|deploy-(?:site|web)\b|-site\.git\b/;

/** True for a workflow a person can start that puts a site live. */
export function deploysSite(yaml: string): boolean {
  return /^\s*workflow_dispatch:/m.test(yaml) && deploysLine.test(yaml);
}

const fileOf = (workflow: RepoWorkflow) => workflow.path.split('/').pop() ?? '';
const rankOf = (file: string) => [/deploy/i, /pages/i, /release/i].findIndex((name) => name.test(file)) >>> 0;

/** Among the workflows that deploy, a deploy file wins, then pages, then release, then the first by name. */
export function pickSiteWorkflow(workflows: RepoWorkflow[], texts: string[]): RepoWorkflow | null {
  const found = workflows.filter((workflow, index) => dispatchable(workflow) && deploysSite(texts[index] ?? ''));
  return (
    found.toSorted((a, b) => rankOf(fileOf(a)) - rankOf(fileOf(b)) || fileOf(a).localeCompare(fileOf(b)))[0] ?? null
  );
}

// The org gains a repo rarely, so its list is read once an hour, like the workflows.
const ttlMs = 60 * 60_000;
let repos: { at: number; names: Promise<string[]> } | null = null;

function orgRepos(): Promise<string[]> {
  if (repos && Date.now() - repos.at < ttlMs) return repos.names;
  const names = callGitHub(`/orgs/${orgName}/repos?per_page=100`)
    .then(async (response) => (await response.json()) as { name: string; archived: boolean }[])
    .then((list) => list.filter((repo) => !repo.archived).map((repo) => repo.name))
    .catch(() => {
      repos = null;
      return [];
    });
  repos = { at: Date.now(), names };
  return names;
}

/** The site deploy workflow of a repo, or null when the repo deploys no site from a workflow. */
export async function siteWorkflowOf(repo: string): Promise<SiteWorkflow | null> {
  const workflows = (await workflowsOf(repo)).filter(dispatchable);
  const texts = await Promise.all(workflows.map((workflow) => textOf(repo, workflow.path)));
  const workflow = pickSiteWorkflow(workflows, texts);
  return workflow && { repo, workflow: workflow.id, name: workflow.name, file: fileOf(workflow) };
}

/** Each org repo with a site and the workflow that deploys it, by repo name. */
export async function siteWorkflows(): Promise<SiteWorkflow[]> {
  const found = await Promise.all((await orgRepos()).map(siteWorkflowOf));
  return found.filter((site) => site !== null).toSorted((a, b) => a.repo.localeCompare(b.repo));
}
