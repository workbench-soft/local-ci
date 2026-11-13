import type { HistoryRun } from './run-history-file.ts';
import type { RunnerKind } from './runner-kind.ts';

const dayMs = 86_400_000;
const failedResults = new Set(['failure', 'timed_out', 'startup_failure']);

export type Outcome = 'success' | 'failure' | 'cancelled';
export type Spread = { median: number | null; p90: number | null };
export type TrendDay = {
  key: string;
  success: number;
  failure: number;
  cancelled: number;
  build: Spread;
  wait: Spread;
};
export type PeriodTotals = { runs: number; failRate: number | null; build: number | null; wait: number | null };
export type WorkflowRow = {
  repo: string;
  workflow: string;
  runs: number;
  failed: number;
  build: Spread;
  lastFailUrl: string | null;
};
export type MachineRow = { kind: RunnerKind; runs: number; failed: number; build: number | null; wait: number | null };
export type StepRow = { repo: string; job: string; step: string; count: number; lastAt: string; lastUrl: string };
export type Trends = {
  days: TrendDay[];
  now: PeriodTotals;
  before: PeriodTotals | null;
  workflows: WorkflowRow[];
  machines: MachineRow[];
  steps: StepRow[];
  repos: string[];
};

/** A skipped run built nothing, such as a release the gate held, so it stays out of every count. */
export function outcomeOf(run: Pick<HistoryRun, 'conclusion'>): Outcome | null {
  if (run.conclusion === 'success') return 'success';
  if (failedResults.has(run.conclusion ?? '')) return 'failure';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return null;
}

/** The nearest rank percentile, or null for an empty list. */
export function percentile(values: number[], share: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1))];
}

const spread = (values: number[]): Spread => ({ median: percentile(values, 0.5), p90: percentile(values, 0.9) });

/** The day of a time on this PC's clock, as 2026-11-13. */
export function dayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** A failed run stops early, so only a successful run counts toward the build time. */
export function buildMs(run: HistoryRun): number | null {
  if (run.conclusion !== 'success' || !run.startedAt) return null;
  return Math.max(0, Date.parse(run.endedAt) - Date.parse(run.startedAt));
}

const numbers = (values: (number | null | undefined)[]) => values.filter((value): value is number => value != null);

function totals(runs: HistoryRun[]): PeriodTotals {
  const failed = runs.filter((run) => outcomeOf(run) === 'failure').length;
  const passed = runs.filter((run) => outcomeOf(run) === 'success').length;
  return {
    runs: runs.length,
    // A cancelled run is mostly a newer push, so it counts neither way.
    failRate: failed + passed ? failed / (failed + passed) : null,
    build: percentile(numbers(runs.map(buildMs)), 0.5),
    wait: percentile(numbers(runs.map((run) => run.jobs?.waitMs)), 0.5),
  };
}

/** The numbers of the Trends tab for the last `days` days, optionally for one repo. */
export function computeTrends(
  all: HistoryRun[],
  options: { now: number; days: number; repo?: string | null; coveredFrom?: number | null },
): Trends {
  const counted = all.filter((run) => outcomeOf(run) && (!options.repo || run.repo === options.repo));
  const keys = Array.from({ length: options.days }, (_, i) => dayKey(options.now - (options.days - 1 - i) * dayMs));
  const inPeriod = counted.filter((run) => keys.includes(dayKey(Date.parse(run.createdAt))));
  const beforeKeys = keys.map((_, i) => dayKey(options.now - (options.days * 2 - 1 - i) * dayMs));
  // The period before shows only when the history reaches back that far.
  const earlier =
    options.coveredFrom != null && options.coveredFrom <= Date.parse(`${beforeKeys[0]}T00:00:00`)
      ? totals(counted.filter((run) => beforeKeys.includes(dayKey(Date.parse(run.createdAt)))))
      : null;
  // A period before the first run of the org has nothing to compare with.
  const before = earlier?.runs ? earlier : null;
  return {
    days: keys.map((key) => {
      const runs = inPeriod.filter((run) => dayKey(Date.parse(run.createdAt)) === key);
      const count = (outcome: Outcome) => runs.filter((run) => outcomeOf(run) === outcome).length;
      return {
        key,
        success: count('success'),
        failure: count('failure'),
        cancelled: count('cancelled'),
        build: spread(numbers(runs.map(buildMs))),
        wait: spread(numbers(runs.map((run) => run.jobs?.waitMs))),
      };
    }),
    now: totals(inPeriod),
    before,
    workflows: workflowRows(inPeriod),
    machines: machineRows(inPeriod),
    steps: stepRows(inPeriod),
    repos: [...new Set(all.map((run) => run.repo))].sort(),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function workflowRows(runs: HistoryRun[]): WorkflowRow[] {
  return [...groupBy(runs, (run) => `${run.repo}\n${run.workflow}`).values()]
    .map((group) => ({
      repo: group[0].repo,
      workflow: group[0].workflow,
      runs: group.length,
      failed: group.filter((run) => outcomeOf(run) === 'failure').length,
      build: spread(numbers(group.map(buildMs))),
      lastFailUrl: group.find((run) => outcomeOf(run) === 'failure')?.url ?? null,
    }))
    .sort((a, b) => b.failed - a.failed || b.runs - a.runs)
    .slice(0, 20);
}

function machineRows(runs: HistoryRun[]): MachineRow[] {
  const pairs = runs.flatMap((run) => (run.jobs?.kinds ?? []).map((kind) => ({ kind, run })));
  return [...groupBy(pairs, (pair) => pair.kind).values()]
    .map((group) => {
      const list = group.map((pair) => pair.run);
      return {
        kind: group[0].kind,
        runs: list.length,
        failed: list.filter((run) => outcomeOf(run) === 'failure').length,
        build: percentile(numbers(list.map(buildMs)), 0.5),
        wait: percentile(numbers(list.map((run) => run.jobs?.waitMs)), 0.5),
      };
    })
    .sort((a, b) => b.runs - a.runs);
}

function stepRows(runs: HistoryRun[]): StepRow[] {
  const failedRuns = runs.filter((run) => outcomeOf(run) === 'failure' && run.jobs?.failedJob);
  // Runs come newest first, so the first run of a group is its last failure.
  return [
    ...groupBy(failedRuns, (run) => `${run.repo}\n${run.jobs?.failedJob}\n${run.jobs?.failedStep ?? ''}`).values(),
  ]
    .map((group) => ({
      repo: group[0].repo,
      job: group[0].jobs?.failedJob ?? '',
      step: group[0].jobs?.failedStep ?? '',
      count: group.length,
      lastAt: group[0].createdAt,
      lastUrl: group[0].jobs?.failedUrl ?? group[0].url,
    }))
    .sort((a, b) => b.count - a.count || Date.parse(b.lastAt) - Date.parse(a.lastAt))
    .slice(0, 10);
}
