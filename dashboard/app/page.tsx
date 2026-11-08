import Link from 'next/link';
import { CancellationHistory } from '@/cards/cancellation-history';
import { AutoRefresh } from '@/cards/auto-refresh';
import { CloudCard } from '@/cards/cloud-card';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { ReleasesCard } from '@/cards/releases-card';
import { RunnersCard } from '@/cards/runners-card';
import { StatusDot } from '@/cards/status-dot';
import { readCancels } from '@/status/cancel-log';
import { isDevKeyConfigured } from '@/status/dev-key';
import { routerState } from '@/status/cloud-router';
import { runDuration } from '@/status/durations';
import { summarizeCi } from '@/status/headline';
import { latestReleases, type PipelineRun } from '@/status/latest-releases';
import { activeLocalBuilds } from '@/status/local-build-runner';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releasesByRun } from '@/status/releases';
import { kindsOfRun } from '@/status/runner-kind';
import { readRunnerCount, readThisPc } from '@/status/this-pc';

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [pc, org, count, query, cancels] = await Promise.all([
    readThisPc(),
    fetchOrgStatus(),
    readRunnerCount(),
    searchParams,
    readCancels(),
  ]);
  // Releases is the tab the person opens the page for; Status stays one click away.
  const tab = query.tab === 'status' ? 'status' : 'releases';
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
      machines: kindsOfRun(jobs, local),
      cancellation: cancels.get(run.id) ?? null,
    };
  });
  // The release states need the place of each run and the failure inside its jobs.
  const pipelineRuns: PipelineRun[] = runs.map((run) => ({
    id: run.id,
    repo: run.repo,
    workflow: run.workflow,
    typicalMs: run.typicalMs,
    title: run.title,
    branch: run.branch,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    url: run.url,
    place: placeOfRun(run, local),
    machines: kindsOfRun(run.jobs, local),
    jobs: run.jobs.map((job) => ({ name: job.name, conclusion: job.conclusion, failedStep: job.failedStep })),
  }));
  const apps = latestReleases(releases, pipelineRuns, cancels, now);
  const building = apps.filter((app) => app.state === 'building' || app.state === 'queued').length;
  const errored = apps.filter((app) => app.state === 'errored').length;
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
        <Link href="/" aria-current={tab === 'releases' ? 'page' : undefined}>
          Releases
          {building > 0 && <span className="count">{building} on the way</span>}
          {errored > 0 && <span className="count bad">{errored} errored</span>}
        </Link>
        <Link href="/?tab=status" aria-current={tab === 'status' ? 'page' : undefined}>
          Status
        </Link>
      </nav>
      {tab === 'releases' ? (
        <div className="grid">
          {org.ok ? (
            <>
              <ReleasesCard
                apps={apps}
                localBuilds={activeLocalBuilds()}
                jobs={live}
                now={now}
                devKeyConfigured={isDevKeyConfigured(process.env.WORKBENCH_DEV_KEY)}
              />
              <LiveJobsCard jobs={live} slots={runnerSlots(pc, live)} stuck={stuck} now={now} />
            </>
          ) : (
            <p className="error">{org.error}</p>
          )}
        </div>
      ) : (
        <div className="grid">
          {org.ok && <LiveJobsCard jobs={live} slots={runnerSlots(pc, live)} stuck={stuck} now={now} />}
          <CloudCard state={routerState()} now={now} />
          <RunnersCard pc={pc} org={org} jobs={live} count={count} now={now} />
          {org.ok && <LatestRunsTable runs={rows} now={now} />}
        </div>
      )}
      <CancellationHistory entries={[...cancels.values()]} />
    </main>
  );
}
