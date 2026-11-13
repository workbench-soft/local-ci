import { callGitHub } from './org-status.ts';
import { localRunnerNames } from './placement.ts';
import {
  type HistoryRun,
  keepDays,
  mergeRuns,
  readHistoryFile,
  type RunHistory,
  type RunJobsSummary,
  writeHistoryFile,
} from './run-history-file.ts';
import { kindsOfRun } from './runner-kind.ts';
import { orgName } from './settings.ts';
import { readThisPc } from './this-pc.ts';

const dayMs = 86_400_000;
const refreshMs = 10 * 60_000;
const recentDays = 3;
const jobsDays = 14;
const jobsPerRefresh = 120;
const pagesPerRepo = 10;
const failed = new Set(['failure', 'timed_out', 'startup_failure']);

export type HistoryState = {
  history: RunHistory;
  refreshedAt: number | null;
  refreshing: boolean;
  error: string | null;
};

type Store = { state: HistoryState | null; refresh: Promise<void> | null };
// Next bundles this module for the page and for instrumentation, so both share one store.
const store: Store = ((globalThis as Record<symbol, Store | undefined>)[Symbol.for('local-ci.run-history')] ??= {
  state: null,
  refresh: null,
});

async function loaded(): Promise<HistoryState> {
  store.state ??= { history: await readHistoryFile(), refreshedAt: null, refreshing: false, error: null };
  return store.state;
}

/** The kept history at once. A refresh starts in the background when the last one is over 10 minutes old. */
export async function readRunHistory(): Promise<HistoryState> {
  const state = await loaded();
  if (!state.refreshedAt || Date.now() - state.refreshedAt > refreshMs) void refreshRunHistory();
  return state;
}

/** The built server refreshes at start and every 10 minutes, with no tab open. */
export function startRunHistory(): void {
  void refreshRunHistory();
  setInterval(() => void refreshRunHistory(), refreshMs).unref();
}

export function refreshRunHistory(): Promise<void> {
  store.refresh ??= (async () => {
    const state = await loaded();
    state.refreshing = true;
    try {
      const now = Date.now();
      const backfill = !state.history.backfilledAt;
      const fresh = await listFinishedRuns(now - (backfill ? keepDays : recentDays) * dayMs, now + 3_600_000);
      const runs = mergeRuns(state.history.runs, fresh, now);
      await addJobs(runs, now);
      state.history = { backfilledAt: state.history.backfilledAt ?? new Date(now).toISOString(), runs };
      await writeHistoryFile(state.history);
      state.error = null;
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.refreshedAt = Date.now();
      state.refreshing = false;
      store.refresh = null;
    }
  })();
  return store.refresh;
}

type ApiRun = {
  id: number;
  name: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string;
  run_attempt?: number;
  updated_at: string;
  html_url: string;
};

async function getJson<T>(path: string): Promise<T> {
  return (await (await callGitHub(path)).json()) as T;
}

async function listFinishedRuns(from: number, to: number): Promise<HistoryRun[]> {
  const repos = await getJson<{ name: string; archived: boolean }[]>(`/orgs/${orgName}/repos?per_page=100&sort=pushed`);
  const perRepo = await Promise.allSettled(
    repos.filter((repo) => !repo.archived).map((repo) => listWeeks(repo.name, from, to)),
  );
  // A repo with Actions turned off drops out alone.
  return perRepo.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

async function listWeeks(repo: string, from: number, to: number): Promise<HistoryRun[]> {
  const runs: HistoryRun[] = [];
  for (let start = from; start < to; start += 7 * dayMs)
    runs.push(...(await listRepo(repo, start, Math.min(to, start + 7 * dayMs))));
  return runs;
}

// GitHub answers a filtered list with 1000 runs at most, so a full window splits in two.
async function listRepo(repo: string, from: number, to: number): Promise<HistoryRun[]> {
  const created = `${new Date(from).toISOString()}..${new Date(to).toISOString()}`;
  const found: ApiRun[] = [];
  for (let page = 1; page <= pagesPerRepo; page++) {
    const { workflow_runs } = await getJson<{ workflow_runs: ApiRun[] }>(
      `/repos/${orgName}/${repo}/actions/runs?created=${encodeURIComponent(created)}&per_page=100&page=${page}`,
    );
    found.push(...workflow_runs);
    if (workflow_runs.length < 100) break;
  }
  if (found.length >= pagesPerRepo * 100 && to - from > 3_600_000) {
    const middle = Math.round((from + to) / 2);
    return [...(await listRepo(repo, from, middle)), ...(await listRepo(repo, middle, to))];
  }
  return found.filter((run) => run.status === 'completed').map((run) => toHistoryRun(repo, run));
}

export function toHistoryRun(repo: string, run: ApiRun): HistoryRun {
  return {
    id: run.id,
    attempt: run.run_attempt ?? 1,
    repo,
    workflow: run.name,
    branch: run.head_branch,
    event: run.event,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    startedAt: run.run_started_at ?? null,
    endedAt: run.updated_at,
    url: run.html_url,
  };
}

type ApiJob = {
  name: string;
  conclusion: string | null;
  runner_name: string | null;
  labels: string[];
  started_at: string | null;
  html_url: string;
  steps?: { name: string; conclusion: string | null }[];
};

// A finished attempt keeps its jobs, so each run's jobs are read once. Newest runs go first.
async function addJobs(runs: HistoryRun[], now: number): Promise<void> {
  const cutoff = now - jobsDays * dayMs;
  const todo = runs.filter((run) => !run.jobs && Date.parse(run.createdAt) >= cutoff).slice(0, jobsPerRefresh);
  if (!todo.length) return;
  const local = localRunnerNames(await readThisPc());
  for (let i = 0; i < todo.length; i += 10)
    await Promise.all(
      todo.slice(i, i + 10).map(async (run) => {
        try {
          const { jobs } = await getJson<{ jobs: ApiJob[] }>(
            `/repos/${orgName}/${run.repo}/actions/runs/${run.id}/attempts/${run.attempt}/jobs?per_page=100`,
          );
          run.jobs = summarizeJobs(jobs, run.attempt === 1 ? run.createdAt : run.startedAt, local);
        } catch {
          // The next refresh tries this run again.
        }
      }),
    );
}

/** The wait counts from queuedAt, the push or the rerun, to the start of the first job. */
export function summarizeJobs(jobs: ApiJob[], queuedAt: string | null, local: Set<string>): RunJobsSummary {
  const job = jobs.find((item) => failed.has(item.conclusion ?? ''));
  const starts = jobs.map((item) => (item.started_at ? Date.parse(item.started_at) : NaN)).filter(Number.isFinite);
  const first = starts.length ? Math.min(...starts) : null;
  return {
    kinds: kindsOfRun(
      jobs
        .filter((item) => item.runner_name || item.started_at)
        .map((item) => ({ runnerName: item.runner_name || null, labels: item.labels })),
      local,
    ),
    failedJob: job?.name ?? null,
    failedStep: job?.steps?.find((step) => failed.has(step.conclusion ?? ''))?.name ?? null,
    failedUrl: job?.html_url ?? null,
    waitMs: first !== null && queuedAt ? Math.max(0, first - Date.parse(queuedAt)) : null,
  };
}
