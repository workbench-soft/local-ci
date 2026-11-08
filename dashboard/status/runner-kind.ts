import type { RunJob } from './org-status.ts';

/** The machine a job builds on: a runner folder of this PC, a cloud runner, or another self-hosted runner. */
export type RunnerKind = 'pc' | 'oracle' | 'blacksmith' | 'github' | 'other';

export const kindNames: Record<RunnerKind, string> = {
  pc: 'This PC',
  oracle: 'Oracle',
  blacksmith: 'Blacksmith',
  github: 'GitHub',
  other: 'Other runner',
};

const lower = (labels: string[]) => labels.map((label) => label.toLowerCase());
const githubLabel = /^(ubuntu|windows|macos)-/;

/**
 * Where a job built, or where it waits to build. A queued job has no runner yet, so its labels tell
 * the machine it asked for. A job of an old run that asked for local labels counts as this PC.
 */
export function kindOfJob(job: Pick<RunJob, 'runnerName' | 'labels'>, local: Set<string>): RunnerKind {
  const name = job.runnerName ?? '';
  const nameLower = name.toLowerCase();
  const labels = lower(job.labels);
  if (name && local.has(name)) return 'pc';
  if (labels.includes('oracle') || nameLower.startsWith('oracle')) return 'oracle';
  if (labels.some((label) => label.startsWith('blacksmith')) || nameLower.startsWith('blacksmith')) return 'blacksmith';
  if (nameLower.startsWith('github actions') || (!labels.includes('self-hosted') && labels.some((l) => githubLabel.test(l))))
    return 'github';
  if (!name && (labels.includes('local') || labels.includes('heavy'))) return 'pc';
  return 'other';
}

/** The machines of a run's jobs, in job order, each once. */
export function kindsOfRun(jobs: Pick<RunJob, 'runnerName' | 'labels'>[], local: Set<string>): RunnerKind[] {
  return [...new Set(jobs.map((job) => kindOfJob(job, local)))];
}

/** The vCPU count in a Blacksmith label such as blacksmith-4vcpu-ubuntu-2404, or null for another runner. */
export function blacksmithCpus(labels: string[]): number | null {
  for (const label of lower(labels)) {
    const match = /^blacksmith-(\d+)vcpu/.exec(label);
    if (match) return Number(match[1]);
  }
  return null;
}
