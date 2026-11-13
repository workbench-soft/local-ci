'use client';
import Link from 'next/link';

const periods = [7, 30, 90];

const href = (repo: string | null, days: number) =>
  `/?tab=trends&days=${days}${repo ? `&repo=${encodeURIComponent(repo)}` : ''}`;

/** The repo and the period of the Trends tab. Both live in the address, so a link keeps them. */
export function TrendsFilter({ repos, repo, days }: { repos: string[]; repo: string | null; days: number }) {
  return (
    <form className="toolbar" method="get" action="/">
      <input type="hidden" name="tab" value="trends" />
      <input type="hidden" name="days" value={days} />
      <label className="small">
        Repo{' '}
        <select name="repo" defaultValue={repo ?? ''} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="">All repos</option>
          {repos.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <nav className="chips" aria-label="Period">
        {periods.map((period) => (
          <Link key={period} className="chip" href={href(repo, period)} aria-pressed={period === days}>
            {period} days
          </Link>
        ))}
      </nav>
    </form>
  );
}
