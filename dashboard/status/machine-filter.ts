import type { OrgRunner } from './org-status.ts';
import { kindOfJob, type RunnerKind } from './runner-kind.ts';

/** The machines the filter under the tabs picks from. Other runners show under All only. */
export type MachinePick = Exclude<RunnerKind, 'other'>;
export const machinePicks: MachinePick[] = ['pc', 'oracle', 'blacksmith', 'github'];

/** The cookie that keeps the pick across tabs and refreshes. */
export const machineCookie = 'machine';

const isPick = (value: unknown): value is MachinePick => machinePicks.includes(value as MachinePick);

/** The pick from `?machine=`, else from the cookie. `?machine=all` clears it. */
export function machineOf(query: string | string[] | undefined, cookie: string | undefined): MachinePick | null {
  const value = typeof query === 'string' ? query : cookie;
  return isPick(value) ? value : null;
}

/** True when no machine is picked, or one of the kinds is the pick. */
export const touches = (kinds: readonly RunnerKind[] | undefined, pick: MachinePick | null) =>
  pick === null || (kinds ?? []).includes(pick);

/** The machine of a runner: a runner folder of this PC, else what its name and labels say. */
export const kindOfRunner = (here: boolean, github: Pick<OrgRunner, 'name' | 'labels'> | null): RunnerKind =>
  here ? 'pc' : kindOfJob({ runnerName: github?.name ?? null, labels: github?.labels ?? [] }, new Set());
