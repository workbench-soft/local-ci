import { callGitHub, type RunJob } from './org-status.ts';
import { classify, type JobReason, logExcerpt } from './run-failure.ts';
import { orgName } from './settings.ts';

const failed = new Set(['failure', 'timed_out', 'startup_failure']);

/** The job a stopped run reads its reason from: the failed one, else a cancelled one that had started. */
export function stoppedJob(jobs: RunJob[]): RunJob | null {
  return (
    jobs.find((job) => failed.has(job.conclusion ?? '')) ??
    jobs.find((job) => job.conclusion === 'cancelled' && job.startedAt) ??
    jobs.find((job) => job.conclusion === 'cancelled') ??
    null
  );
}

// A finished job doesn't change, so its reason is read once. The page and the sweep share the map.
const kept: Map<number, Promise<JobReason | null>> = ((globalThis as Record<symbol, unknown>)[
  Symbol.for('local-ci.run-reason')
] ??= new Map()) as Map<number, Promise<JobReason | null>>;
const keptMax = 300;

/** The reason of one finished job, or null when GitHub can't be read. A failed read gets another try. */
export function readReason(repo: string, job: RunJob): Promise<JobReason | null> {
  const known = kept.get(job.id);
  if (known) return known;
  const reason = load(repo, job).catch(() => null);
  kept.set(job.id, reason);
  if (kept.size > keptMax) kept.delete(kept.keys().next().value as number);
  void reason.then((value) => value || kept.delete(job.id));
  return reason;
}

async function load(repo: string, job: RunJob): Promise<JobReason> {
  const base = `/repos/${orgName}/${repo}`;
  const notes = (await (await callGitHub(`${base}/check-runs/${job.id}/annotations`)).json()) as {
    message: string;
    title?: string;
    path?: string;
  }[];
  const { kind, message, actor } = classify(notes.map((note) => note.message));
  let excerpt: string | null = null;
  let line = message;
  if (kind === 'error') {
    // A missing log, such as one GitHub expired, leaves the annotations alone.
    const log = await callGitHub(`${base}/actions/jobs/${job.id}/logs`)
      .then((response) => response.text())
      .catch(() => '');
    const cut = logExcerpt(log);
    excerpt = cut?.excerpt || null;
    // The exit code says less than the error line of the log.
    if (cut?.message && (!line || line.startsWith('Process completed with exit code'))) line = cut.message;
  }
  return {
    kind,
    job: job.name,
    jobUrl: job.url,
    step: job.failedStep ?? job.stoppedStep ?? null,
    runner: job.runnerName,
    message: line,
    excerpt,
    actor,
  };
}
