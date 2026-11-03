import { callGitHub } from './org-status.ts';
import { orgName } from './settings.ts';

type UsageItem = { product: string; sku: string; unitType: string; quantity: number; repositoryName: string };

// GitHub Free counts a Windows minute twice and a macOS minute 10 times against the 2000 a month.
const weights: [RegExp, number][] = [
  [/windows/i, 2],
  [/macos/i, 10],
];
export const weightOf = (sku: string) => weights.find(([pattern]) => pattern.test(sku))?.[1] ?? 1;

/** The minutes the private repos took from the free GitHub quota, as GitHub Free counts them. */
export function quotaMinutes(items: UsageItem[], privateRepos: Set<string>): number {
  return Math.round(
    items
      .filter((item) => item.product === 'actions' && item.unitType === 'Minutes')
      .filter((item) => privateRepos.has(item.repositoryName))
      .reduce((sum, item) => sum + item.quantity * weightOf(item.sku), 0),
  );
}

const read = async <T>(path: string) => (await (await callGitHub(path)).json()) as T;

/** Public repos run free, so only the private ones count. The billing API lags by a few hours. */
export async function githubMinutes(now = new Date()): Promise<number> {
  const repos = await read<{ name: string }[]>(`/orgs/${orgName}/repos?type=private&per_page=100`);
  const month = `year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`;
  const { usageItems } = await read<{ usageItems: UsageItem[] }>(
    `/organizations/${orgName}/settings/billing/usage?${month}`,
  );
  return quotaMinutes(usageItems, new Set(repos.map((repo) => repo.name)));
}
