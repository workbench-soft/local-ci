import Link from 'next/link';
import { AutoRefresh } from '@/cards/auto-refresh';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { ReleasesCard } from '@/cards/releases-card';
import { RunnersCard } from '@/cards/runners-card';
import { StatusDot } from '@/cards/status-dot';
import { runDuration } from '@/status/durations';
import { summarizeCi } from '@/status/headline';
import { latestReleases } from '@/status/latest-releases';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releasesByRun } from '@/status/releases';
import { readRunnerCount, readThisPc } from '@/status/this-pc';

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [pc, org, count, query] = await Promise.all([readThisPc(), fetchOrgStatus(), readRunnerCount(), searchParams]);
  const tab = query.tab === 'releases' ? 'releases' : 'status';
  const now = Date.now();
  const local = localRunnerNames(pc);
  const runs = org.ok ? org.runs : [];
  const releases = org.ok ? org.releases : [];
  const live = liveJobs(runs, local);
  const stuck = idleWhileQueued(org.ok ? org.runners : null, local, live, now);
  const headline = summarizeCi(pc, org, live, stuck);
  // The table runs in the browser, so it gets each run without its jobs.
  const releaseOf = releasesByRun(runs, releases);
  const rows: RunRow[] = runs.map((run) => {
    const { jobs, updatedAt, ...row } = run;
    return {
      ...row,
      tookMs: runDuration(run, now),
      place: placeOfRun(run, local),
      release: releaseOf.get(run.id) ?? null,
      failure: failureOf(run),
    };
  });
  const apps = latestReleases(releases, rows);
  const building = apps.filter((app) => app.build?.state === 'building').length;
  return (
    <main>
      <header>
        <h1>
          <StatusDot tone={headline.tone} />
          {headline.text}
        </h1>
        <AutoRefresh renderedAt={new Date(now).toISOString()} />
      </header>
      <nav className="tabs" aria-label="Pages">
        <Link href="/" aria-current={tab === 'status' ? 'page' : undefined}>
          Status
        </Link>
        <Link href="/?tab=releases" aria-current={tab === 'releases' ? 'page' : undefined}>
          Releases
          {building > 0 && <span className="count">{building} building</span>}
        </Link>
      </nav>
      {tab === 'status' ? (
        <div className="grid">
          {org.ok && <LiveJobsCard jobs={live} slots={runnerSlots(pc, live)} stuck={stuck} now={now} />}
          <RunnersCard pc={pc} org={org} jobs={live} count={count} now={now} />
          {org.ok && <LatestRunsTable runs={rows} now={now} />}
        </div>
      ) : (
        <div className="grid">
          {org.ok ? <ReleasesCard apps={apps} now={now} /> : <p className="error">{org.error}</p>}
        </div>
      )}
    </main>
  );
}
