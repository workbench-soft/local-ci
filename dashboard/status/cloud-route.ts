/** What the router knows when it picks the runners. */
export type CloudState = {
  oracleOnline: boolean;
  /** The Blacksmith app is installed in the org, and no job got stuck on it within the hour. */
  blacksmithOn: boolean;
  blacksmithUsed: number;
  blacksmithBudget: number;
  /** Null until the billing API answers, which counts as no minutes left. */
  githubUsed: number | null;
  githubBudget: number;
};

/** The labels each lane asks for, with the reason in words for the Cloud card and the log. */
export type Routes = { light: string[]; heavy: string[]; windows: string[]; why: string };

export const localLight = ['self-hosted', 'local'];
export const localHeavy = ['self-hosted', 'heavy'];
/** Any of the PC runners. A Gradle, Cargo or Tauri job on this lane asks for heavy in its own runs-on. */
export const localWindows = ['self-hosted', 'Windows'];
export const oracleLight = ['self-hosted', 'oracle'];
export const blacksmithLight = ['blacksmith-2vcpu-ubuntu-2404'];
export const blacksmithHeavy = ['blacksmith-4vcpu-ubuntu-2404'];
export const blacksmithWindows = ['blacksmith-2vcpu-windows-2025'];
export const githubLinux = ['ubuntu-latest'];
export const githubWindows = ['windows-latest'];

const left = (name: string, used: number, budget: number) =>
  used < budget ? `${name} has ${budget - used} of ${budget} minutes left` : `${name} used its ${budget} minutes`;

/**
 * Blacksmith while its minutes last, then Oracle, then GitHub while its minutes last, then this PC.
 * Heavy and Windows jobs skip Oracle, since Android and Windows don't build on ARM Linux.
 */
export function pickRoutes(state: CloudState): Routes {
  const blacksmith = state.blacksmithOn && state.blacksmithUsed < state.blacksmithBudget;
  const github = state.githubUsed !== null && state.githubUsed < state.githubBudget;
  const pick = (first: string[], oracle: string[] | null, hosted: string[], pc: string[]) =>
    blacksmith ? first : oracle && state.oracleOnline ? oracle : github ? hosted : pc;
  const why = [
    state.blacksmithOn ? left('Blacksmith', state.blacksmithUsed, state.blacksmithBudget) : 'Blacksmith is off',
    state.oracleOnline ? 'Oracle is online' : 'Oracle is offline',
    state.githubUsed === null ? 'GitHub minutes unknown' : left('GitHub', state.githubUsed, state.githubBudget),
  ];
  return {
    light: pick(blacksmithLight, oracleLight, githubLinux, localLight),
    heavy: pick(blacksmithHeavy, null, githubLinux, localHeavy),
    windows: pick(blacksmithWindows, null, githubWindows, localWindows),
    why: `${why.join('. ')}.`,
  };
}

const sameLabels = (a: string[], b: string[]) => a.length === b.length && a.every((label, i) => label === b[i]);

/** The variables whose value differs from the routes, with the value each one gets. */
export function variablesToSet(current: Record<string, string | undefined>, routes: Routes): [string, string][] {
  const wanted: [string, string[]][] = [
    ['CI_RUNNER', routes.light],
    ['CI_HEAVY_RUNNER', routes.heavy],
    ['CI_WINDOWS_RUNNER', routes.windows],
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
