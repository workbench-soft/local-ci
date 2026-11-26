/**
 * The GitHub calls the page pays for, and the quota GitHub reports on each answer.
 * Agents use the same gh token, so the page slows down and pauses its background reads when the quota runs low.
 */
type Quota = { limit: number; remaining: number; resetMs: number };
type Store = { quota: Quota | null; paid: Map<string, number>; since: number; logging: boolean };

// Next bundles this module for the page and for instrumentation, so both share one store.
const store: Store = ((globalThis as Record<symbol, Store | undefined>)[Symbol.for('local-ci.github-budget')] ??= {
  quota: null,
  paid: new Map(),
  since: Date.now(),
  logging: false,
});

// Below this share of the hour's calls, the page leaves the rest to the agents until the reset.
const lowShare = 0.3;
const logMs = 10 * 60_000;

/** The path with its query and ids taken out, so the counter groups calls by what they read. */
export function kindOf(path: string): string {
  return path
    .replace(/\?.*/, '')
    .replace(/^\/repos\/[^/]+\/[^/]+/, '/repos/R')
    .replace(/\/\d+(?=\/|$)/g, '/N');
}

/** Counts a call unless GitHub answered 304, which costs no quota, and keeps the quota GitHub reported. */
export function noteAnswer(path: string, response: Pick<Response, 'status' | 'headers'>): void {
  if (response.status !== 304) store.paid.set(kindOf(path), (store.paid.get(kindOf(path)) ?? 0) + 1);
  const limit = Number(response.headers.get('x-ratelimit-limit'));
  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (limit > 0 && Number.isFinite(remaining) && reset > 0) store.quota = { limit, remaining, resetMs: reset * 1000 };
}

/** True while less than 30% of the hour's calls are left and the reset hasn't come. */
export function quotaLow(now = Date.now()): boolean {
  const quota = store.quota;
  return !!quota && now < quota.resetMs && quota.remaining < quota.limit * lowShare;
}

/** One line on the calls paid since the last line, most first, then starts a new count. */
export function budgetLine(now = Date.now()): string {
  const total = [...store.paid.values()].reduce((sum, count) => sum + count, 0);
  const kinds = [...store.paid]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([kind, count]) => `${count} ${kind}`)
    .join(', ');
  const minutes = Math.max(1, Math.round((now - store.since) / 60_000));
  const quota = store.quota ? `, ${store.quota.remaining} of ${store.quota.limit} left` : '';
  store.paid = new Map();
  store.since = now;
  return `GitHub calls paid in ${minutes} min: ${total}${quota}${kinds ? `. ${kinds}` : ''}`;
}

/** The built server writes the line to dashboard.log every 10 minutes. */
export function startBudgetLog(): void {
  if (store.logging) return;
  store.logging = true;
  setInterval(() => console.log(`${new Date().toISOString()} ${budgetLine()}`), logMs).unref();
}
