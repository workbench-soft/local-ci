import { blacksmithMinutes } from './blacksmith-usage.ts';
import { pickRoutes, type Routes, stuckOnBlacksmith, variablesToSet } from './cloud-route.ts';
import { callGitHub, fetchOrgStatus, forgetOrgStatus } from './org-status.ts';
import { orgName } from './settings.ts';

/** What the Cloud card shows: the routes the variables hold now and why. */
export type RouterState = {
  at: number | null;
  routes: Routes | null;
  used: number | null;
  budget: number;
  oracleOnline: boolean;
  blacksmithInstalled: boolean;
  blacksmithDownUntil: number;
  error: string | null;
};

const tickMs = 60_000;
const usageMs = 5 * 60_000;
const appsMs = 10 * 60_000;
const downMs = 60 * 60_000;
const budget = Number(process.env.BLACKSMITH_BUDGET) || 2700;

// Next bundles this module for the page and for the sweep, so both share one state on globalThis.
type Store = {
  state: RouterState;
  started: boolean;
  usageAt: number;
  appsAt: number;
  rerun: Map<number, string>;
  restarted: Set<number>;
};
const store: Store = ((globalThis as Record<symbol, Store | undefined>)[Symbol.for('local-ci.cloud-router')] ??= {
  state: {
    at: null,
    routes: null,
    used: null,
    budget,
    oracleOnline: false,
    blacksmithInstalled: false,
    blacksmithDownUntil: 0,
    error: null,
  },
  started: false,
  usageAt: 0,
  appsAt: 0,
  rerun: new Map(),
  restarted: new Set(),
});

export const routerState = (): RouterState => store.state;

/** Each minute points CI_RUNNER and CI_HEAVY_RUNNER at the free runner that fits. CLOUD_ROUTER=off stops it. */
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
  const stuck = stuckOnBlacksmith(status.runs, now);
  if (stuck.length && now > state.blacksmithDownUntil) {
    state.blacksmithDownUntil = now + downMs;
    log(`Blacksmith left ${stuck.length} run(s) queued over 5 minutes, so this PC builds for the next hour.`);
  }
  const routes = pickRoutes({
    oracleOnline: state.oracleOnline,
    blacksmithOn: state.blacksmithInstalled && now > state.blacksmithDownUntil,
    blacksmithUsed: state.used ?? 0,
    blacksmithBudget: budget,
  });
  await setVariables(routes);
  state.routes = routes;
  state.at = now;
  await restartStuck(stuck);
}

async function setVariables(routes: Routes): Promise<void> {
  const { variables } = await read<{ variables: { name: string; value: string }[] }>(
    `/orgs/${orgName}/actions/variables?per_page=30`,
  );
  const current = Object.fromEntries(variables.map((item) => [item.name, item.value]));
  for (const [name, value] of variablesToSet(current, routes)) {
    const body = { name, value, visibility: 'all' };
    if (name in current) await callGitHub(`/orgs/${orgName}/actions/variables/${name}`, 'PATCH', {}, body);
    else await callGitHub(`/orgs/${orgName}/actions/variables`, 'POST', {}, body);
    log(`Set ${name} to ${value}. ${routes.why}`);
  }
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
