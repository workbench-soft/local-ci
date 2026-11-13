import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RunnerKind } from './runner-kind.ts';

/** What the jobs of a finished run tell: the machines, the failure and the wait for the first runner. */
export type RunJobsSummary = {
  kinds: RunnerKind[];
  failedJob: string | null;
  failedStep: string | null;
  failedUrl: string | null;
  waitMs: number | null;
};

/** A finished run of an org repo, as the Trends tab counts it. */
export type HistoryRun = {
  id: number;
  attempt: number;
  repo: string;
  workflow: string;
  branch: string;
  event: string;
  conclusion: string | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string;
  url: string;
  jobs?: RunJobsSummary;
};

export type RunHistory = { backfilledAt: string | null; runs: HistoryRun[] };

export const keepDays = 90;
const dayMs = 86_400_000;

/** The JSON file of the history. RUN_HISTORY_FILE in .env.local picks another one. */
export function historyFile(): string {
  return process.env.RUN_HISTORY_FILE || join(process.cwd(), 'run-history.json');
}

/** A missing or broken file starts an empty history, so the next refresh reads 90 days again. */
export async function readHistoryFile(file = historyFile()): Promise<RunHistory> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8')) as Partial<RunHistory>;
    return { backfilledAt: data.backfilledAt ?? null, runs: Array.isArray(data.runs) ? data.runs : [] };
  } catch {
    return { backfilledAt: null, runs: [] };
  }
}

// A crash mid write would leave half a file, so the history lands in a temp file first.
export async function writeHistoryFile(history: RunHistory, file = historyFile()): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(history));
  await rename(temp, file);
}

/**
 * Adds the fresh runs to the kept ones. A newer attempt of a run replaces the old one and drops its jobs.
 * Runs older than 90 days go.
 */
export function mergeRuns(kept: HistoryRun[], fresh: HistoryRun[], now: number): HistoryRun[] {
  const byId = new Map(kept.map((run) => [run.id, run]));
  for (const run of fresh) {
    const old = byId.get(run.id);
    if (old && old.attempt > run.attempt) continue;
    byId.set(
      run.id,
      old && old.attempt === run.attempt && old.endedAt === run.endedAt ? { ...run, jobs: old.jobs } : run,
    );
  }
  const cutoff = now - keepDays * dayMs;
  return [...byId.values()]
    .filter((run) => Date.parse(run.createdAt) >= cutoff)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
