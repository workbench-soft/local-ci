import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { callGitHub } from './org-status.ts';
import { blacksmithCpus } from './runner-kind.ts';
import { orgName } from './settings.ts';

/** The Blacksmith minutes of each finished run of the month, kept so a run is read once. */
type Ledger = { month: string; runs: Record<string, number> };

type ApiJob = { labels: string[]; started_at: string | null; completed_at: string | null };

// The server runs in the dashboard folder, beside dashboard.log.
const ledgerPath = join(process.cwd(), 'cloud-usage.json');
// A busy repo finishes over 100 runs a month, and each page of 100 costs a call.
const pagesPerRepo = 5;

// These reads skip the ETag store of the page, so they can't push its entries out.
const getJson = async <T>(path: string) => (await (await callGitHub(path)).json()) as T;

/**
 * Blacksmith bills each job by the minute, rounded up, at its vCPU count over 2.
 * A Windows job counts its full vCPU count, so 10 minutes on 4 vCPU cost 40.
 */
export function jobMinutes(job: ApiJob): number {
  const cpus = blacksmithCpus(job.labels);
  if (!cpus || !job.started_at || !job.completed_at) return 0;
  const ms = Date.parse(job.completed_at) - Date.parse(job.started_at);
  const windows = job.labels.some((label) => label.toLowerCase().includes('windows'));
  return Math.max(Math.ceil(ms / 60_000), 1) * (windows ? cpus : cpus / 2);
}

export const monthOf = (now: Date) => now.toISOString().slice(0, 7);

function readLedger(month: string): Ledger {
  try {
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger;
    if (ledger.month === month) return ledger;
  } catch {
    // No file yet, or a broken one: the month gets counted again.
  }
  return { month, runs: {} };
}

/** The Blacksmith minutes the org used this month, from every finished run on GitHub. */
export async function blacksmithMinutes(now = new Date()): Promise<number> {
  const ledger = readLedger(monthOf(now));
  const repos = await getJson<{ full_name: string; archived: boolean }[]>(`/orgs/${orgName}/repos?per_page=100`);
  // The repos go side by side and the runs of a repo one by one, so the first count of a month takes
  // under a minute without a burst of hundreds of calls.
  const counted = await Promise.allSettled(
    repos.filter((item) => !item.archived).map((repo) => countRepo(repo.full_name, ledger)),
  );
  const failed = counted.find((result) => result.status === 'rejected');
  writeFileSync(ledgerPath, JSON.stringify(ledger));
  // A repo that failed would undercount, and the router would keep sending jobs past the budget.
  if (failed) throw failed.reason;
  return Object.values(ledger.runs).reduce((sum, minutes) => sum + minutes, 0);
}

async function countRepo(fullName: string, ledger: Ledger): Promise<void> {
  for (let page = 1; page <= pagesPerRepo; page++) {
    const { workflow_runs } = await getJson<{ workflow_runs: { id: number }[] }>(
      `/repos/${fullName}/actions/runs?status=completed&created=%3E%3D${ledger.month}-01&per_page=100&page=${page}`,
    );
    for (const run of workflow_runs.filter((item) => !(item.id in ledger.runs))) {
      const { jobs } = await getJson<{ jobs: ApiJob[] }>(`/repos/${fullName}/actions/runs/${run.id}/jobs?per_page=100`);
      ledger.runs[run.id] = jobs.reduce((sum, job) => sum + jobMinutes(job), 0);
    }
    if (workflow_runs.length < 100) break;
  }
}
