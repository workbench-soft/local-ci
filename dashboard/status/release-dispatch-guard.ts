import { activeStatuses } from './placement.ts';

// GitHub lists a dispatched run some seconds after the call, so the action and the button both hold a second dispatch this long.
export const dispatchVisibilityMs = 30_000;
// GitHub may stamp the run a little before the time the page noted for the dispatch.
export const dispatchSlackMs = 5_000;

/** A second release of the same workflow must not start before the first one finishes. */
export function hasUnfinishedRelease(runs: readonly { status: string }[]): boolean {
  return runs.some((run) => activeStatuses.has(run.status));
}
