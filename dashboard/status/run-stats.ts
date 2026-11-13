import type { HistoryRun } from './run-history-file.ts';
import { buildMs, outcomeOf, percentile } from './trends.ts';

const dayMs = 86_400_000;

/** How one workflow of one repo did over the last days. */
export type WorkflowStats = {
  repo: string;
  days: number;
  runs: number;
  failed: number;
  failRate: number | null;
  medianMs: number | null;
  p90Ms: number | null;
};

export const statsKey = (repo: string, workflow: string) => `${repo}\n${workflow}`;

function summarize(repo: string, days: number, runs: HistoryRun[]): WorkflowStats {
  const failed = runs.filter((run) => outcomeOf(run) === 'failure').length;
  const passed = runs.filter((run) => outcomeOf(run) === 'success').length;
  const times = runs.map(buildMs).filter((ms): ms is number => ms !== null);
  return {
    repo,
    days,
    runs: runs.length,
    failed,
    failRate: failed + passed ? failed / (failed + passed) : null,
    medianMs: percentile(times, 0.5),
    p90Ms: percentile(times, 0.9),
  };
}

/** The stats of each workflow over the last `days` days, keyed by statsKey. Skipped runs stay out. */
export function workflowStats(all: HistoryRun[], now: number, days = 30): Map<string, WorkflowStats> {
  const groups = new Map<string, HistoryRun[]>();
  for (const run of all) {
    if (!outcomeOf(run) || Date.parse(run.createdAt) < now - days * dayMs) continue;
    const key = statsKey(run.repo, run.workflow);
    const group = groups.get(key);
    if (group) group.push(run);
    else groups.set(key, [run]);
  }
  return new Map([...groups].map(([key, runs]) => [key, summarize(runs[0].repo, days, runs)]));
}

/** The share of failed runs over the last `days` days, cancelled ones left out. */
export function recentFailRate(all: HistoryRun[], now: number, days = 7): number | null {
  return summarize(
    '',
    days,
    all.filter((run) => outcomeOf(run) && Date.parse(run.createdAt) >= now - days * dayMs),
  ).failRate;
}
