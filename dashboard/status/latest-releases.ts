import type { Place } from './placement.ts';
import { type Release, releasePrefixes } from './releases.ts';

type BuildRun = {
  repo: string;
  workflow: string;
  branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
  place: Place;
};

/** A run on main that may change the app's latest release: one that still builds, or one that failed after it. */
export type AppBuild = { state: 'building' | 'failed'; workflow: string; url: string; place: Place };

/** The newest release of an app, the repo that builds it, and that repo's build on main. */
export type AppRelease = { app: string; repo: string; release: Release; build: AppBuild | null };

const defaultBranches = new Set(['main', 'master']);
const failed = new Set(['failure', 'timed_out', 'startup_failure']);
// A merge starts Checks on push, and Release follows it as workflow_run. Dependabot runs on main come as dynamic and release nothing.
const releaseEvents = new Set(['push', 'workflow_run', 'workflow_dispatch']);

/** The app of a release tag such as memories-mobile-v2026.10.31.1, or null for another tag. */
export function appOfTag(tag: string): string | null {
  return /^(.+)-v\d[\w.]*$/.exec(tag)?.[1] ?? null;
}

function repoOfApp(app: string): string {
  return Object.entries(releasePrefixes).find(([, prefixes]) => prefixes.includes(app))?.[0] ?? app;
}

function buildOf(repo: string, release: Release, runs: BuildRun[]): AppBuild | null {
  const onMain = runs.filter(
    (run) => run.repo === repo && defaultBranches.has(run.branch) && releaseEvents.has(run.event),
  );
  const toBuild = (run: BuildRun, state: AppBuild['state']): AppBuild => ({
    state,
    workflow: run.workflow,
    url: run.url,
    place: run.place,
  });
  const building = onMain.find((run) => run.place !== 'done');
  if (building) return toBuild(building, 'building');
  const newest = onMain
    .filter((run) => Date.parse(run.createdAt) > Date.parse(release.createdAt))
    .toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  return newest && failed.has(newest.conclusion ?? '') ? toBuild(newest, 'failed') : null;
}

/** The newest release of each app, newest first, with the state of the build that comes after it. */
export function latestReleases(releases: Release[], runs: BuildRun[]): AppRelease[] {
  const newest = new Map<string, Release>();
  for (const release of releases) {
    const app = appOfTag(release.tag);
    const kept = app && newest.get(app);
    if (app && (!kept || Date.parse(release.createdAt) > Date.parse(kept.createdAt))) newest.set(app, release);
  }
  return [...newest]
    .map(([app, release]) => ({ app, repo: repoOfApp(app), release, build: buildOf(repoOfApp(app), release, runs) }))
    .toSorted((a, b) => Date.parse(b.release.createdAt) - Date.parse(a.release.createdAt));
}
