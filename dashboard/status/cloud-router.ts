import { blacksmithMinutes } from './blacksmith-usage.ts';
import { pickRoutes, type Routes, stuckOnBlacksmith, variablesToSet } from './cloud-route.ts';
import { githubMinutes, runningMinutes } from './github-usage.ts';
import { callGitHub, fetchOrgStatus, forgetOrgStatus } from './org-status.ts';
import { orgName } from './settings.ts';

/** What the Cloud card shows: the routes the variables hold now and why. */
export type RouterState = {
  at: number | null;
  routes: Routes | null;
  used: number | null;
  budget: number;
  /** Billed this month, Windows x2 and macOS x10, null until the billing API answers. */
  githubUsed: number | null;
  /** The minutes so far of the jobs running on GitHub runners now. */
  githubRunning: number;
  githubFree: number;
  /** The free minutes less the margin. Past it, jobs build on this PC. */
  githubStop: number;
  oracleOnline: boolean;
  blacksmithInstalled: boolean;
  blacksmithDownUntil: number;
  error: string | null;
};

const tickMs = 60_000;
const usageMs = 5 * 60_000;
const appsMs = 10 * 60_000;
const downMs = 60 * 60_000;
const syncMs = 30 * 60_000;
const budget = Number(process.env.BLACKSMITH_BUDGET) || 2700;
// GitHub Free gives 2000 minutes a month, and its billing API lags by hours.
// The margin lets a few 30 minute Gradle builds that start under the stop finish before GitHub cancels them.
const githubFree = Number(process.env.GITHUB_FREE) || 2000;
const githubStop = githubFree - (Number(process.env.GITHUB_MARGIN) || 300);
const githubMs = 10 * 60_000;

// Next bundles this module for the page and for the sweep, so both share one state on globalThis.
type Store = {
  state: RouterState;
  started: boolean;
  usageAt: number;
  githubAt: number;
  appsAt: number;
  rerun: Map<number, string>;
  restarted: Set<number>;
  /** The routes every private repo holds, and when the last full pass ran. */
  applied: string;
  appliedAt: number;
};
const store: Store = ((globalThis as Record<symbol, Store | undefined>)[Symbol.for('local-ci.cloud-router')] ??= {
  state: {
    at: null,
    routes: null,
    used: null,
    budget,
    githubUsed: null,
    githubRunning: 0,
    githubFree,
    githubStop,
    oracleOnline: false,
    blacksmithInstalled: false,
    blacksmithDownUntil: 0,
    error: null,
  },
  started: false,
  usageAt: 0,
  githubAt: 0,
  appsAt: 0,
  rerun: new Map(),
  restarted: new Set(),
  applied: '',
  appliedAt: 0,
});

export const routerState = (): RouterState => store.state;

/** Each minute points CI_RUNNER, CI_HEAVY_RUNNER and CI_WINDOWS_RUNNER at the free runner that fits. CLOUD_ROUTER=off stops it. */
export function startCloudRouter(): void {
  if (store.started || process.env.CLOUD_ROUTER === 'off') return;
  store.started = true;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await tick(Date.now());
      store.state.error = null;
    } catch (error) {
      store.state.error = error instanceof Error ? error.message : String(error);
      console.error(`${new Date().toISOString()} Cloud router: ${store.state.error}`);
    } finally {
      busy = false;
    }
  };
  void run();
  setInterval(run, tickMs).unref();
}

const read = async <T>(path: string) => (await (await callGitHub(path)).json()) as T;
const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function tick(now: number): Promise<void> {
  const state = store.state;
  const status = await fetchOrgStatus();
  if (!status.ok) throw new Error(status.error);
  state.oracleOnline = (status.runners ?? []).some(
    (runner) => runner.status === 'online' && runner.labels.some((label) => label.toLowerCase() === 'oracle'),
  );
  if (now - store.appsAt > appsMs) {
    const { installations } = await read<{ installations: { app_slug: string }[] }>(`/orgs/${orgName}/installations`);
    state.blacksmithInstalled = installations.some((app) => app.app_slug.includes('blacksmith'));
    store.appsAt = now;
  }
  if (state.blacksmithInstalled && (state.used === null || now - store.usageAt > usageMs)) {
    state.used = await blacksmithMinutes(new Date(now));
    store.usageAt = now;
  }
  if (now - store.githubAt > githubMs) {
    state.githubUsed = await githubMinutes(new Date(now));
    store.githubAt = now;
  }
  state.githubRunning = runningMinutes(status.runs, now);
  const stuck = stuckOnBlacksmith(status.runs, now);
  if (stuck.length && now > state.blacksmithDownUntil) {
    state.blacksmithDownUntil = now + downMs;
    log(
      `Blacksmith left ${stuck.length} run(s) queued over 5 minutes, so the next runner in line builds for the next hour.`,
    );
  }
  const routes = pickRoutes({
    oracleOnline: state.oracleOnline,
    blacksmithOn: state.blacksmithInstalled && now > state.blacksmithDownUntil,
    blacksmithUsed: state.used ?? 0,
    blacksmithBudget: budget,
    githubUsed: state.githubUsed === null ? null : state.githubUsed + state.githubRunning,
    githubBudget: githubStop,
  });
  await setVariables(routes, now);
  state.routes = routes;
  state.at = now;
  await restartStuck(stuck);
}

// GitHub Free hides org variables from private repos, so each private repo holds its own copy.
// The repos get a full pass when the routes change and every 30 minutes, which catches a new repo.
async function setVariables(routes: Routes, now: number): Promise<void> {
  const key = JSON.stringify([routes.light, routes.heavy, routes.windows]);
  if (store.applied === key && now - store.appliedAt < syncMs) return;
  const repos = await read<{ name: string; archived: boolean }[]>(`/orgs/${orgName}/repos?type=private&per_page=100`);
  const changed: string[] = [];
  for (const repo of repos.filter((item) => !item.archived)) {
    const path = `/repos/${orgName}/${repo.name}/actions/variables`;
    const { variables } = await read<{ variables: { name: string; value: string }[] }>(`${path}?per_page=30`);
    const current = Object.fromEntries(variables.map((item) => [item.name, item.value]));
    for (const [name, value] of variablesToSet(current, routes)) {
      if (name in current) await callGitHub(`${path}/${name}`, 'PATCH', {}, { name, value });
      else await callGitHub(path, 'POST', {}, { name, value });
      changed.push(repo.name);
    }
  }
  if (changed.length) {
    const lanes = (['light', 'heavy', 'windows'] as const).map((lane) => `${lane} ${JSON.stringify(routes[lane])}`);
    log(`Set the runners of ${new Set(changed).size} repo(s): ${lanes.join(', ')}. ${routes.why}`);
  }
  store.applied = key;
  store.appliedAt = now;
}

/**
 * A stuck run gets cancelled, then started again once GitHub ends it, so its jobs read the new variables.
 * Each run restarts once, so a run that asks for Blacksmith again stays cancelled.
 */
async function restartStuck(stuck: { id: number; repo: string }[]) {
  for (const run of stuck) {
    if (store.rerun.has(run.id) || store.restarted.has(run.id)) continue;
    await callGitHub(`/repos/${orgName}/${run.repo}/actions/runs/${run.id}/force-cancel`, 'POST');
    store.rerun.set(run.id, run.repo);
    log(`Cancelled ${run.repo} run ${run.id}, stuck on Blacksmith.`);
  }
  for (const [id, repo] of store.rerun) {
    const run = await read<{ status: string }>(`/repos/${orgName}/${repo}/actions/runs/${id}`);
    if (run.status !== 'completed') continue;
    store.rerun.delete(id);
    store.restarted.add(id);
    await callGitHub(`/repos/${orgName}/${repo}/actions/runs/${id}/rerun`, 'POST');
    log(`Started ${repo} run ${id} again on the new route.`);
  }
  if (stuck.length) forgetOrgStatus();
}
