import { formatDuration } from '@/status/durations';
import { formatAge } from '@/status/headline';
import { kindNames } from '@/status/runner-kind';
import type { MachineRow, StepRow, WorkflowRow } from '@/status/trends';

const time = (ms: number | null) => (ms == null ? '' : formatDuration(ms));
const share = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '');

/** Each workflow of the period, the most failures first. */
export function WorkflowTable({ rows }: { rows: WorkflowRow[] }) {
  return (
    <section className="card wide">
      <h2>Workflows</h2>
      <table>
        <thead>
          <tr>
            <th>Repo</th>
            <th>Workflow</th>
            <th>Runs</th>
            <th>Failed</th>
            <th>Median</th>
            <th>p90</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.repo}/${row.workflow}`}>
              <td>{row.repo}</td>
              <td>{row.workflow}</td>
              <td>{row.runs}</td>
              <td>
                {row.failed > 0 && row.lastFailUrl ? (
                  <a href={row.lastFailUrl} target="_blank" rel="noreferrer">
                    {row.failed} ({share(row.failed, row.runs)})
                  </a>
                ) : (
                  row.failed
                )}
              </td>
              <td className="nowrap">{time(row.build.median)}</td>
              <td className="nowrap">{time(row.build.p90)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Each kind of machine, with how often its runs fail and how long they wait. */
export function MachineTable({ rows }: { rows: MachineRow[] }) {
  return (
    <section className="card">
      <h2>Machines</h2>
      <p className="muted small">
        Runs of the last 14 days whose jobs the page read. A run on two machines counts on each.
      </p>
      <table>
        <thead>
          <tr>
            <th>Machine</th>
            <th>Runs</th>
            <th>Failed</th>
            <th>Build</th>
            <th>Wait</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.kind}>
              <td>{kindNames[row.kind]}</td>
              <td>{row.runs}</td>
              <td>{share(row.failed, row.runs)}</td>
              <td className="nowrap">{time(row.build)}</td>
              <td className="nowrap">{time(row.wait)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The steps that failed most, each with a link to its last failed job. */
export function StepTable({ rows, now }: { rows: StepRow[]; now: number }) {
  return (
    <section className="card">
      <h2>Failing steps</h2>
      {rows.length === 0 && <p className="muted small">No failed step in this period.</p>}
      <table className="steps">
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.repo}/${row.job}/${row.step}`}>
              <td>
                <a href={row.lastUrl} target="_blank" rel="noreferrer">
                  {row.step || row.job}
                </a>
                <div className="muted small">
                  {row.repo} · {row.job}
                </div>
              </td>
              <td className="nowrap">{row.count}×</td>
              <td className="muted small nowrap">{formatAge(row.lastAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
