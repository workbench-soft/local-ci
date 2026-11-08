import { activeStatuses } from './placement.ts';

/** A second release of the same workflow must not start before the first one finishes. */
export function hasUnfinishedRelease(runs: readonly { status: string }[]): boolean {
  return runs.some((run) => activeStatuses.has(run.status));
}
