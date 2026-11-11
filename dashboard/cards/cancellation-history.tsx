import type { CancelEntry } from '@/status/cancel-log';
import { orgName } from '@/status/settings';
import { CancelReason } from './cancel-reason';

export function CancellationHistory({ entries }: { entries: CancelEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="card wide">
      <h2>Cancellation history</h2>
      <details>
        <summary>{entries.length} recorded cancellations</summary>
        <ul className="history">
          {entries
            .toSorted((a, b) => b.at.localeCompare(a.at))
            .map((entry) => (
              <li key={`${entry.repo}-${entry.runId}`}>
                <a
                  href={`https://github.com/${orgName}/${entry.repo}/actions/runs/${entry.runId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {entry.repo} #{entry.runId}
                </a>
                {' · '}
                <CancelReason entry={entry} />
                {' · '}
                <time dateTime={entry.at}>{entry.at}</time>
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}
