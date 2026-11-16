import type { CancelEntry } from '@/status/cancel-log';
import { orgName } from '@/status/settings';
import { CancelReason } from './cancel-reason';

// The page renders on each 15 s refresh, and 550 rows made 961 KB of HTML.
const shown = 100;

export function CancellationHistory({ entries }: { entries: CancelEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="card wide">
      <h2>Cancellation history</h2>
      <details>
        <summary>
          {entries.length} recorded cancellations{entries.length > shown ? `, the newest ${shown} shown` : ''}
        </summary>
        <ul className="history">
          {entries
            .toSorted((a, b) => b.at.localeCompare(a.at))
            .slice(0, shown)
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
