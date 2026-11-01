/** What the router knows when it picks the runners. */
export type CloudState = {
  oracleOnline: boolean;
  /** The Blacksmith app is installed in the org, and no job got stuck on it within the hour. */
  blacksmithOn: boolean;
  blacksmithUsed: number;
  blacksmithBudget: number;
};

/** The labels each lane asks for, with the reason in words for the Cloud card and the log. */
export type Routes = { light: string[]; heavy: string[]; why: string };

export const localLight = ['self-hosted', 'local'];
export const localHeavy = ['self-hosted', 'heavy'];
export const oracleLight = ['self-hosted', 'oracle'];
export const blacksmithLight = ['blacksmith-2vcpu-ubuntu-2404'];
export const blacksmithHeavy = ['blacksmith-4vcpu-ubuntu-2404'];

/** Oracle first for light jobs, then Blacksmith while minutes last, then this PC. */
export function pickRoutes(state: CloudState): Routes {
  const minutesLeft = state.blacksmithOn && state.blacksmithUsed < state.blacksmithBudget;
  const light = state.oracleOnline ? oracleLight : minutesLeft ? blacksmithLight : localLight;
  const heavy = minutesLeft ? blacksmithHeavy : localHeavy;
  const blacksmith = !state.blacksmithOn
    ? 'Blacksmith is off'
    : minutesLeft
      ? `Blacksmith has ${state.blacksmithBudget - state.blacksmithUsed} of ${state.blacksmithBudget} minutes left`
      : `Blacksmith used its ${state.blacksmithBudget} minutes this month`;
  return { light, heavy, why: `${state.oracleOnline ? 'Oracle is online' : 'Oracle is offline'}. ${blacksmith}.` };
}

const sameLabels = (a: string[], b: string[]) => a.length === b.length && a.every((label, i) => label === b[i]);

/** The variables whose value differs from the routes, with the value each one gets. */
export function variablesToSet(current: Record<string, string | undefined>, routes: Routes): [string, string][] {
  const wanted: [string, string[]][] = [
    ['CI_RUNNER', routes.light],
    ['CI_HEAVY_RUNNER', routes.heavy],
  ];
  return wanted
    .filter(([name, labels]) => {
      try {
        return !sameLabels(JSON.parse(current[name] ?? 'null') ?? [], labels);
      } catch {
        return true;
      }
    })
    .map(([name, labels]) => [name, JSON.stringify(labels)]);
}

// A cloud runner picks a job up within a minute, so 5 minutes in the queue means it is missing or down.
export const stuckAfterMs = 5 * 60_000;

/** Runs with a job that waits for Blacksmith longer than the stuck limit. */
export function stuckOnBlacksmith<
  R extends { id: number; jobs: { status: string; labels: string[]; startedAt: string | null }[]; createdAt: string },
>(runs: R[], now: number): R[] {
  return runs.filter((run) =>
    run.jobs.some(
      (job) =>
        job.status === 'queued' &&
        job.labels.some((label) => label.toLowerCase().startsWith('blacksmith')) &&
        now - Date.parse(job.startedAt ?? run.createdAt) > stuckAfterMs,
    ),
  );
}
