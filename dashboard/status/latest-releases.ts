import type { CancelEntry } from './cancel-log.ts';
import { activeStatuses, type Place } from './placement.ts';
import { typicalDuration } from './progress.ts';
import { type Release, releasesByRun, releasePrefixes } from './releases.ts';

/** A run of a repo, with the place it builds on and the failure inside it. */
export type PipelineRun = {
  id: number;
  repo: string;
  workflow: string;
  title: string;
  branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  url: string;
  place: Place;
  jobs: { name: string; conclusion: string | null; failedStep: string | null }[];
};

/** What an app's release pipeline does right now. */
export type ReleaseState =
  | 'released' // the newest release is the last word
  | 'building' // a run of the pipeline is in progress
  | 'queued' // a run waits for a runner
  | 'errored' // a run failed, so no release comes of it
  | 'cancelled' // a run was cancelled, with the reason
  | 'gate-held' // the release workflow waits while a PR is open
  | 'no-release'; // the app has no release yet

/** The run a state comes from, with what the row shows of it. */
export type RunView = {
  workflow: string;
  status: string;
  conclusion: string | null;
  url: string;
  place: Place;
  createdAt: string;
  failedJob: string | null;
  failedStep: string | null;
};

/** How long the current run has taken, and how long such a run usually takes from its creation. */
export type RunWait = { elapsedMs: number; usualMs: number | null };

/** An app, its newest release, and what its release pipeline does right now. */
export type AppRelease = {
  app: string;
  repo: string;
  release: Release | null;
  /** The workflow that builds the app's releases, read from the run that made the newest one. */
  pipeline: string | null;
  state: ReleaseState;
  run: RunView | null;
  wait: RunWait | null;
  /** The words a cancel was logged with, and when. */
  why: CancelEntry | null;
};

const defaultBranches = new Set(['main', 'master']);
const failed = new Set(['failure', 'timed_out', 'startup_failure']);
// A merge starts Checks on push, and Release follows it as workflow_run. Dependabot runs on main come as dynamic and release nothing.
const shipEvents = new Set(['push', 'workflow_run', 'workflow_dispatch']);

// The states a person waits on come first, the settled ones last.
const stateOrder: Record<ReleaseState, number> = {
  building: 0,
  queued: 1,
  errored: 2,
  cancelled: 3,
  'gate-held': 4,
  'no-release': 5,
  released: 6,
};

/** The app of a release tag such as memories-mobile-v2026.10.31.1, or null for another tag. */
export function appOfTag(tag: string): string | null {
  return /^(.+)-v\d[\w.]*$/.exec(tag)?.[1] ?? null;
}

function repoOfApp(app: string): string {
  return Object.entries(releasePrefixes).find(([, prefixes]) => prefixes.includes(app))?.[0] ?? app;
}

function viewOf(run: PipelineRun): RunView {
  const job = run.jobs.find((item) => failed.has(item.conclusion ?? ''));
  return {
    workflow: run.workflow,
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    place: run.place,
    createdAt: run.createdAt,
    failedJob: job?.name ?? null,
    failedStep: job?.failedStep ?? null,
  };
}

function newestFirst(a: PipelineRun, b: PipelineRun): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id;
}

// What a row sorts by: what the app does now, or when its release came out.
function activityAt(app: AppRelease): string {
  return app.run && app.state !== 'released' && app.state !== 'no-release'
    ? app.run.createdAt
    : (app.release?.createdAt ?? '');
}

/** The state the newest run of a repo leaves the app in. */
function stateOfRun(run: PipelineRun, pipeline: string | null, release: Release | null): ReleaseState {
  if (activeStatuses.has(run.status)) return run.status === 'in_progress' ? 'building' : 'queued';
  if (failed.has(run.conclusion ?? '')) return 'errored';
  if (run.conclusion === 'cancelled') return 'cancelled';
  if (run.conclusion === 'skipped') {
    // The release workflow skipped when its gate held it or the checks it follows failed. Other workflows skip on path filters, so they ship nothing.
    return run.workflow === pipeline ? 'gate-held' : release ? 'released' : 'no-release';
  }
  return release ? 'released' : 'no-release';
}

/**
 * The newest release of each app, with the state of its release pipeline.
 *
 * The pipeline is the workflow of the run that made the app's newest release. The runs of the repo
 * on the default branch newer than that release decide the state: the newest of them says whether
 * a release builds, waits, failed, was cancelled, or sits behind the gate. Runs of another app's
 * release pipeline in the same repo stay out, so a desktop release doesn't read as a phone release.
 *
 * A repo with runs but no release yet shows as an app too, so the first release is on the page
 * before it exists. Such a repo needs a workflow_run run: a workflow that runs after another,
 * which is how every release workflow here starts.
 */
export function latestReleases(
  releases: Release[],
  runs: PipelineRun[],
  cancels: Map<number, CancelEntry>,
  now: number,
): AppRelease[] {
  // The run that made each release names the workflow that owns the app's releases.
  const ownerOfRun = releasesByRun(runs, releases);
  const runById = new Map(runs.map((run) => [run.id, run]));
  const pipelineOfTag = new Map<string, string | null>();
  for (const [runId, release] of ownerOfRun) pipelineOfTag.set(release.tag, runById.get(runId)?.workflow ?? null);

  const newest = new Map<string, Release>();
  for (const release of releases) {
    const app = appOfTag(release.tag);
    const kept = app && newest.get(app);
    if (app && (!kept || Date.parse(release.createdAt) > Date.parse(kept.createdAt))) newest.set(app, release);
  }

  // The release workflows of each repo, so runs of another app's pipeline stay out of the decision.
  const pipelinesOfRepo = new Map<string, Set<string>>();
  for (const [app, release] of newest) {
    const pipeline = pipelineOfTag.get(release.tag);
    if (!pipeline) continue;
    const repo = repoOfApp(app);
    const set = pipelinesOfRepo.get(repo) ?? new Set<string>();
    set.add(pipeline);
    pipelinesOfRepo.set(repo, set);
  }

  const shipsOf = (repo: string) =>
    runs.filter((run) => run.repo === repo && defaultBranches.has(run.branch) && shipEvents.has(run.event));
  const decisionRuns = (repo: string, pipeline: string | null, after: PipelineRun[]) =>
    pipeline
      ? after.filter((run) => run.workflow === pipeline || !pipelinesOfRepo.get(repo)?.has(run.workflow))
      : after;

  const apps: AppRelease[] = [];
  for (const [app, release] of newest) {
    const repo = repoOfApp(app);
    const pipeline = pipelineOfTag.get(release.tag) ?? null;
    const releasedAt = Date.parse(release.createdAt);
    // A release lands while its run still builds, so an unfinished run of the pipeline counts even
    // though it started before the release. Its queue wait and build belong to this release.
    const after = shipsOf(repo).filter(
      (run) =>
        Date.parse(run.createdAt) > releasedAt ||
        (pipeline !== null && run.workflow === pipeline && activeStatuses.has(run.status)),
    );
    const candidates = decisionRuns(repo, pipeline, after);
    const run = candidates.toSorted(newestFirst)[0] ?? null;
    // A skipped release workflow says why only with the run that made it fail or hold.
    const feeder =
      run?.conclusion === 'skipped' && run.workflow === pipeline
        ? (candidates.find((item) => item.workflow !== pipeline && failed.has(item.conclusion ?? '')) ?? null)
        : null;
    const decided = feeder ?? run;
    const state = decided ? stateOfRun(decided, pipeline, release) : 'released';
    const why =
      state === 'cancelled' && decided && cancels.get(decided.id) ? (cancels.get(decided.id) as CancelEntry) : null;
    apps.push({
      app,
      repo,
      release,
      pipeline,
      state,
      run: decided && state !== 'released' ? viewOf(decided) : null,
      // The usual life comes from every finished run of the workflow in the repo, not only the
      // runs after this release: the ones that made the earlier releases sit before it.
      wait: decided && (state === 'building' || state === 'queued') ? waitOf(decided, shipsOf(repo), now) : null,
      why: why ?? null,
    });
  }

  const releasedRepos = new Set([...newest.keys()].map((app) => repoOfApp(app)));
  for (const repo of new Set(runs.map((run) => run.repo))) {
    if (releasedRepos.has(repo)) continue;
    const all = shipsOf(repo);
    if (!all.some((run) => run.event === 'workflow_run' || /release|deploy/i.test(run.workflow))) continue;
    const run = all.toSorted(newestFirst)[0] ?? null;
    const state = run ? stateOfRun(run, null, null) : 'no-release';
    const why = state === 'cancelled' && run && cancels.get(run.id) ? cancels.get(run.id) : null;
    apps.push({
      app: repo,
      repo,
      release: null,
      pipeline: null,
      state,
      run: run && state !== 'no-release' ? viewOf(run) : null,
      wait: run && (state === 'building' || state === 'queued') ? waitOf(run, all, now) : null,
      why: why ?? null,
    });
  }

  return apps.sort(
    (a, b) => stateOrder[a.state] - stateOrder[b.state] || Date.parse(activityAt(b)) - Date.parse(activityAt(a)),
  );
}

// The wait counts the whole life of a run, its queue time included, since that is what the person waits through.
function waitOf(run: PipelineRun, ships: PipelineRun[], now: number): RunWait {
  const elapsedMs = Math.max(0, now - Date.parse(run.createdAt));
  // The usual life of this workflow comes from its finished runs of the same repo, with the same
  // survival count the job estimate uses: a cancelled run gives a lower bound, a success the full time.
  const usualMs = typicalDuration(
    run.workflow,
    ships
      .filter((item) => item.workflow === run.workflow && item.status === 'completed' && item.id !== run.id)
      .map((item) => ({
        name: item.workflow,
        conclusion: item.conclusion,
        startedAt: item.createdAt,
        completedAt: item.updatedAt,
      })),
  );
  return { elapsedMs, usualMs };
}
