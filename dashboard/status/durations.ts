/** A job or a step in the breakdown row, with the time it took so far. */
export type StepTiming = { name: string; status: string; conclusion: string | null; ms: number | null };

/** A job of a run with the time of each of its steps. */
export type JobTiming = StepTiming & { url: string; steps: StepTiming[] };

/** From the start to the end, or up to now while it still runs. Null without a start. */
export function spanMs(startedAt: string | null, completedAt: string | null, now: number): number | null {
  if (!startedAt) return null;
  return Math.max(0, (completedAt ? Date.parse(completedAt) : now) - Date.parse(startedAt));
}

/** A finished run ends at its last update. A run still in the queue has taken no time yet. */
export function runDuration(
  run: { status: string; startedAt: string | null; updatedAt: string },
  now: number,
): number | null {
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') return null;
  return spanMs(run.startedAt, run.status === 'completed' ? run.updatedAt : null, now);
}

/** "42 s", "4 min 12 s" or "1 h 3 min". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`;
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${Math.floor(minutes / 60)} h`;
}

type ApiStep = {
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
  completed_at?: string | null;
};

/** The jobs API answer, turned into the times the breakdown row shows. */
export function toJobTimings(
  jobs: {
    name: string;
    status: string;
    conclusion: string | null;
    started_at: string | null;
    completed_at: string | null;
    html_url: string;
    steps?: ApiStep[];
  }[],
  now: number,
): JobTiming[] {
  return jobs.map((job) => ({
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    url: job.html_url,
    ms: spanMs(job.started_at, job.completed_at, now),
    steps: (job.steps ?? []).map((step) => ({
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      ms: spanMs(step.started_at ?? null, step.completed_at ?? null, now),
    })),
  }));
}
