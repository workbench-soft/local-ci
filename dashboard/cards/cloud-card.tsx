import { formatAge } from '@/status/headline';
import type { RouterState } from '@/status/cloud-router';

const laneText = (labels: string[]) =>
  labels.includes('oracle')
    ? 'Oracle'
    : labels.some((label) => label.startsWith('blacksmith'))
      ? `Blacksmith (${labels[0]})`
      : `This PC (${labels.join(', ')})`;

/** Where new jobs go now, and why: Oracle, then Blacksmith while its free minutes last, then this PC. */
export function CloudCard({ state, now }: { state: RouterState; now: number }) {
  const left = state.used === null ? null : Math.max(state.budget - state.used, 0);
  return (
    <section className="card wide">
      <h2>Cloud runners</h2>
      <p className="muted small">
        Jobs build on Oracle and Blacksmith while their free minutes last, then on this PC. Each minute the page server
        sets the org variables CI_RUNNER and CI_HEAVY_RUNNER, which the workflows read.
      </p>
      {state.routes ? (
        <dl className="cloud">
          <dt>Light jobs</dt>
          <dd>{laneText(state.routes.light)}</dd>
          <dt>Heavy jobs</dt>
          <dd>{laneText(state.routes.heavy)}</dd>
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
              <meter min={0} max={state.budget} value={state.used ?? 0} high={state.budget * 0.8} />
            )}
          </dd>
          <dt>Oracle</dt>
          <dd>{state.oracleOnline ? 'Online, takes the light jobs.' : 'No Oracle runner online.'}</dd>
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
