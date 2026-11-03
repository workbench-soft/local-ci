import { callGitHub, type WorkflowRun } from './org-status.ts';
import { orgName } from './settings.ts';

type UsageItem = { product: string; sku: string; unitType: string; quantity: number };

// GitHub Free counts a Windows minute twice and a macOS minute 10 times against the 2000 a month.
const weights: [RegExp, number][] = [
  [/windows/i, 2],
  [/macos/i, 10],
];
export const weightOf = (sku: string) => weights.find(([pattern]) => pattern.test(sku))?.[1] ?? 1;

/**
 * The minutes the org took from the free GitHub quota, as GitHub Free counts them.
 * Every repo counts: on 2026-11-03 GitHub cancelled jobs while the private repos alone held 1266 minutes.
 */
export function quotaMinutes(items: UsageItem[]): number {
  return Math.round(
    items
      .filter((item) => item.product === 'actions' && item.unitType === 'Minutes')
      .reduce((sum, item) => sum + item.quantity * weightOf(item.sku), 0),
  );
}

const hosted = /^(ubuntu|windows|macos)-/;

/** The weighted minutes so far of the jobs running on GitHub runners, which the billing API shows hours later. */
export function runningMinutes(runs: Pick<WorkflowRun, 'jobs'>[], now: number): number {
  return runs
    .flatMap((run) => run.jobs)
    .filter((job) => job.status === 'in_progress' && job.startedAt)
    .reduce((sum, job) => {
      const label = job.labels.find((item) => hosted.test(item));
      const minutes = Math.ceil((now - Date.parse(job.startedAt ?? '')) / 60_000);
      return label ? sum + minutes * weightOf(label) : sum;
    }, 0);
}

/** The minutes billed this month. The billing API lags by a few hours. */
export async function githubMinutes(now = new Date()): Promise<number> {
  const month = `year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;
  const response = await callGitHub(`/organizations/${orgName}/settings/billing/usage?${month}`);
  return quotaMinutes(((await response.json()) as { usageItems: UsageItem[] }).usageItems);
}
