import { formatDuration } from '@/status/durations';
import { formatAge } from '@/status/headline';
import { keepDays } from '@/status/run-history-file';
import type { HistoryState } from '@/status/run-history';
import { computeTrends, type PeriodTotals } from '@/status/trends';
import { dayLabel, Legend, OutcomeColumns, SpreadLines } from './charts';
import { MachineTable, StepTable, WorkflowTable } from './trend-tables';
import { TrendsFilter } from './trends-filter';

type Tile = { label: string; value: string; delta: string | null; worse: boolean | null };

const percent = (rate: number | null) => (rate == null ? 'no run' : `${Math.round(rate * 100)}%`);
const time = (ms: number | null) => (ms == null ? 'no run' : formatDuration(ms));

function tiles(now: PeriodTotals, before: PeriodTotals | null): Tile[] {
  // Up is worse for each tile but the run count, which only says how busy CI was.
  const change = (
    a: number | null,
    b: number | null | undefined,
    show: (d: number) => string,
    upIsWorse: boolean | null,
  ) => {
    if (a == null || b == null) return { delta: null, worse: null };
    // A change that rounds to 0 reads as no change.
    if (show(Math.abs(a - b)).startsWith('0 ')) return { delta: 'same as before', worse: null };
    return {
      delta: `${a > b ? '+' : '−'}${show(Math.abs(a - b))} vs before`,
      worse: upIsWorse === null ? null : a > b === upIsWorse,
    };
  };
  return [
    { label: 'Runs', value: String(now.runs), ...change(now.runs, before?.runs, String, null) },
    {
      label: 'Failed',
      value: percent(now.failRate),
      ...change(now.failRate, before?.failRate, (d) => `${Math.round(d * 100)} pts`, true),
    },
    { label: 'Median build', value: time(now.build), ...change(now.build, before?.build, formatDuration, true) },
    {
      label: 'Median wait for a runner',
      value: time(now.wait),
      ...change(now.wait, before?.wait, formatDuration, true),
    },
  ];
}

/** The Trends tab: tiles, charts a day and the tables, for one repo or all of them. */
export function TrendsView({
  state,
  repo,
  days,
  now,
}: {
  state: HistoryState;
  repo: string | null;
  days: number;
  now: number;
}) {
  const { history } = state;
  const coveredFrom = history.backfilledAt ? Date.parse(history.backfilledAt) - keepDays * 86_400_000 : null;
  const trends = computeTrends(history.runs, { now, days, repo, coveredFrom });
  const note = state.refreshedAt ? `Read ${formatAge(new Date(state.refreshedAt).toISOString(), now)}.` : '';
  return (
    <div className="grid trends">
      <section className="card wide">
        <TrendsFilter repos={trends.repos} repo={repo} days={days} />
        {state.error && <p className="error small">The last read failed: {state.error}</p>}
        {!history.backfilledAt && (
          <p className="muted small">Reading 90 days of runs from GitHub. The page fills in by itself.</p>
        )}
        <div className="tiles">
          {tiles(trends.now, trends.before).map((tile) => (
            <div key={tile.label} className="tile">
              <div className="muted small">{tile.label}</div>
              <div className="tile-value">{tile.value}</div>
              {tile.delta && (
                <div className={`small ${tile.worse === null ? 'muted' : tile.worse ? 'delta-worse' : 'delta-better'}`}>
                  {tile.delta}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="muted small">
          The last {days} days against the {days} before. A cancelled run counts toward neither pass nor fail. {note}
        </p>
      </section>
      <section className="card wide">
        <h2>Runs a day</h2>
        <Legend
          items={[
            { mark: 'mark-failure', label: 'Failed' },
            { mark: 'mark-success', label: 'Passed' },
            { mark: 'mark-cancelled', label: 'Cancelled' },
          ]}
        />
        <OutcomeColumns days={trends.days} />
      </section>
      <section className="card wide">
        <h2>Build time</h2>
        <p className="muted small">Successful runs, from start to end.</p>
        <Legend
          items={[
            { mark: 'line-median', label: 'Median' },
            { mark: 'line-p90', label: 'Slowest tenth (p90)' },
          ]}
        />
        <SpreadLines days={trends.days} pick={(day) => day.build} />
      </section>
      <section className="card wide">
        <h2>Wait for a runner</h2>
        <p className="muted small">From the push or the rerun to the start of its first job, last 14 days.</p>
        <Legend
          items={[
            { mark: 'line-median', label: 'Median' },
            { mark: 'line-p90', label: 'Slowest tenth (p90)' },
          ]}
        />
        <SpreadLines days={trends.days} pick={(day) => day.wait} />
      </section>
      <StepTable rows={trends.steps} now={now} />
      <MachineTable rows={trends.machines} />
      <WorkflowTable rows={trends.workflows} />
      <section className="card wide">
        <details>
          <summary>Each day as a table</summary>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Cancelled</th>
                <th>Median build</th>
                <th>Median wait</th>
              </tr>
            </thead>
            <tbody>
              {[...trends.days].reverse().map((day) => (
                <tr key={day.key}>
                  <td className="nowrap">{dayLabel(day.key)}</td>
                  <td>{day.success}</td>
                  <td>{day.failure}</td>
                  <td>{day.cancelled}</td>
                  <td className="nowrap">{day.build.median == null ? '' : formatDuration(day.build.median)}</td>
                  <td className="nowrap">{day.wait.median == null ? '' : formatDuration(day.wait.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
