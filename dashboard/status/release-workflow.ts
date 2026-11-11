import { appOfTag, repoOfApp } from './latest-releases.ts';
import { callGitHub } from './org-status.ts';
import { type Release, releasesByRun } from './releases.ts';
import { orgName } from './settings.ts';

/** A workflow of a repo, as GitHub lists it. */
export type RepoWorkflow = { id: number; name: string; path: string; state: string };

/** The workflow Release on CI dispatches on main for an app. */
export type ReleaseWorkflow = { repo: string; workflow: number; name: string };

type ApiRun = { id: number; workflow_id: number; created_at: string; updated_at: string };

// A repo gains a release workflow rarely, so its list is read once an hour.
const ttlMs = 60 * 60_000;
const listed = new Map<string, { at: number; workflows: Promise<RepoWorkflow[]> }>();
const texts = new Map<string, { at: number; text: Promise<string> }>();
// The run that published a release never changes, so each tag is looked up once.
const makers = new Map<string, Promise<number | null>>();

const repoPath = (repo: string) => `/repos/${orgName}/${encodeURIComponent(repo)}/actions`;

export function workflowsOf(repo: string): Promise<RepoWorkflow[]> {
  const kept = listed.get(repo);
  if (kept && Date.now() - kept.at < ttlMs) return kept.workflows;
  const workflows = callGitHub(`${repoPath(repo)}/workflows?per_page=100`)
    .then(async (response) => ((await response.json()) as { workflows: RepoWorkflow[] }).workflows)
    .catch(() => {
      listed.delete(repo);
      return [];
    });
  listed.set(repo, { at: Date.now(), workflows });
  return workflows;
}

/** The YAML of a workflow on main, read once an hour. */
export function textOf(repo: string, path: string): Promise<string> {
  const key = `${repo}/${path}`;
  const kept = texts.get(key);
  if (kept && Date.now() - kept.at < ttlMs) return kept.text;
  const raw = { Accept: 'application/vnd.github.raw+json' };
  const text = callGitHub(`/repos/${orgName}/${encodeURIComponent(repo)}/contents/${path}?ref=main`, 'GET', raw)
    .then((response) => response.text())
    .catch(() => {
      texts.delete(key);
      return '';
    });
  texts.set(key, { at: Date.now(), text });
  return text;
}

/** True for a workflow a person can start that publishes a GitHub release. */
export function publishesRelease(yaml: string): boolean {
  return /^\s*workflow_dispatch:/m.test(yaml) && /gh release create|action-gh-release/.test(yaml);
}

/** The workflow of the run that published a release, from the repo's runs of the hours before it. */
function makerOf(repo: string, release: Release): Promise<number | null> {
  const kept = makers.get(release.tag);
  if (kept) return kept;
  const at = Date.parse(release.createdAt);
  const window = `${new Date(at - 6 * 60 * 60_000).toISOString()}..${new Date(at + 60_000).toISOString()}`;
  const maker = callGitHub(`${repoPath(repo)}/runs?per_page=100&created=${encodeURIComponent(window)}`)
    .then(async (response) => {
      const runs = ((await response.json()) as { workflow_runs: ApiRun[] }).workflow_runs.map((run) => ({
        id: run.id,
        repo,
        workflowId: run.workflow_id,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      }));
      const owner = [...releasesByRun(runs, [release])][0]?.[0];
      return runs.find((run) => run.id === owner)?.workflowId ?? null;
    })
    .catch(() => {
      makers.delete(release.tag);
      return null;
    });
  makers.set(release.tag, maker);
  return maker;
}

/**
 * The release workflow among a repo's workflows. A file named for a release or deploy wins, and the one
 * whose run published the newest release decides among several, then a lone release file beside deploy
 * files. Two release files with no such run pick none, since a wrong guess would ship another app.
 * A repo with no such file uses the workflow that published the release, such as a ci.yml.
 */
export function pickReleaseWorkflow(workflows: RepoWorkflow[], madeBy: number | null): RepoWorkflow | null {
  const active = workflows.filter(dispatchable);
  const file = (workflow: RepoWorkflow) => workflow.path.split('/').pop() ?? '';
  const named = active.filter((workflow) => /release|deploy/i.test(file(workflow)));
  const maker = active.find((workflow) => workflow.id === madeBy) ?? null;
  if (!named.length) return maker;
  const releases = named.filter((workflow) => /release/i.test(file(workflow)));
  return (
    named.find((workflow) => workflow === maker) ??
    (named.length === 1 ? named[0] : releases.length === 1 ? releases[0] : null)
  );
}

// GitHub's own workflows, such as pages-build-deployment, sit under dynamic/ and take no dispatch.
export const dispatchable = (workflow: RepoWorkflow) =>
  workflow.state === 'active' && !workflow.path.startsWith('dynamic/');

async function byText(repo: string, workflows: RepoWorkflow[]): Promise<RepoWorkflow | null> {
  const texts = await Promise.all(workflows.map((workflow) => textOf(repo, workflow.path)));
  const found = workflows.filter((_, index) => publishesRelease(texts[index]));
  return found.length === 1 ? found[0] : null;
}

/** The workflow that releases an app again from main, or null when the page can't tell which one it is. */
export async function releaseWorkflowFor(app: string, releases: Release[]): Promise<ReleaseWorkflow | null> {
  const repo = repoOfApp(app);
  // A draft that never got published carries the date of its commit, so the run of an older release may answer.
  const recent = releases
    .filter((release) => appOfTag(release.tag) === app)
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3);
  const firstMaker = async () => {
    for (const release of recent) {
      const maker = await makerOf(repo, release);
      if (maker !== null) return maker;
    }
    return null;
  };
  const [workflows, madeBy] = await Promise.all([workflowsOf(repo), firstMaker()]);
  // With no telling name and no run found, the one workflow whose YAML publishes a release answers.
  const workflow =
    pickReleaseWorkflow(workflows, madeBy) ??
    (recent.length ? await byText(repo, workflows.filter(dispatchable)) : null);
  return workflow && { repo, workflow: workflow.id, name: workflow.path.split('/').pop() ?? workflow.name };
}
