import { formatAge } from '@/status/headline';
import type { RouterState } from '@/status/cloud-router';

const laneText = (labels: string[]) =>
  labels.includes('oracle')
    ? 'Oracle'
    : labels.some((label) => label.startsWith('blacksmith'))
      ? `Blacksmith (${labels[0]})`
      : labels.some((label) => /^(ubuntu|windows)-/.test(label))
        ? `GitHub (${labels[0]})`
        : `This PC (${labels.join(', ')})`;

/** Where new jobs go now, and why: Blacksmith, then Oracle, then GitHub, then this PC. */
export function CloudCard({ state, now }: { state: RouterState; now: number }) {
  const left = state.used === null ? null : Math.max(state.budget - state.used, 0);
  const githubTotal = state.githubUsed === null ? null : state.githubUsed + state.githubRunning;
  return (
    <section className="card wide">
      <h2>Cloud runners</h2>
      <p className="muted small">
        Jobs build on Blacksmith, then Oracle, then GitHub runners while their free minutes last, then on this PC. The
        page server sets CI_RUNNER, CI_HEAVY_RUNNER and CI_WINDOWS_RUNNER in each private repo, which the workflows
        read.
      </p>
      {state.routes ? (
        <dl className="cloud">
          <dt>Light jobs</dt>
          <dd>{laneText(state.routes.light)}</dd>
          <dt>Heavy jobs</dt>
          <dd>{laneText(state.routes.heavy)}</dd>
          <dt>Windows jobs</dt>
          <dd>{laneText(state.routes.windows)}</dd>
          <dt>Blacksmith</dt>
          <dd>
            {!state.blacksmithInstalled
              ? 'Off: the Blacksmith app is not installed in the org.'
              : state.blacksmithDownUntil > now
                ? `Off until ${new Date(state.blacksmithDownUntil).toLocaleTimeString()}: a job waited on it over 5 minutes.`
                : left === null
                  ? 'Counting the minutes of this month.'
                  : `${state.used} of ${state.budget} minutes used this month, ${left} left.`}
            {state.blacksmithInstalled && left !== null && (
              <meter
                aria-label="Blacksmith minutes used this month"
                min={0}
                max={state.budget}
                value={state.used ?? 0}
                high={state.budget * 0.8}
              />
            )}
          </dd>
          <dt>GitHub</dt>
          <dd>
            {githubTotal === null
              ? 'Reading the minutes of this month.'
              : `${githubTotal} of ${state.githubFree} free minutes used this month: ${state.githubUsed} billed, ` +
                `${state.githubRunning} running now, Windows x2 and macOS x10. Jobs move to this PC at ` +
                `${state.githubStop}, so a running build finishes before GitHub cancels it.`}
            {githubTotal !== null && (
              <meter
                aria-label="GitHub minutes used this month"
                min={0}
                max={state.githubFree}
                value={githubTotal}
                high={state.githubStop}
              />
            )}
          </dd>
          <dt>Oracle</dt>
          <dd>
            {state.oracleOnline ? 'Online, takes the light jobs once Blacksmith runs out.' : 'No Oracle runner online.'}
          </dd>
          <dt>Checked</dt>
          <dd>{state.at ? formatAge(new Date(state.at).toISOString(), now) : 'not yet'}</dd>
        </dl>
      ) : (
        <p className="muted">The router starts with the built page server. pnpm dev doesn't route.</p>
      )}
      {state.error && <p className="error small">{state.error}</p>}
    </section>
  );
}
