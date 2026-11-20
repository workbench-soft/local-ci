import { cookies } from 'next/headers';
import { CancellationHistory } from '@/cards/cancellation-history';
import { AutoRefresh } from '@/cards/auto-refresh';
import { CloudCard } from '@/cards/cloud-card';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { ColorKey, MachineFilter } from '@/cards/machine-filter';
import { ReleasesCard } from '@/cards/releases-card';
import { RunnersCard } from '@/cards/runners-card';
import { SitesCard, type SiteRow } from '@/cards/sites-card';
import { StatusDot } from '@/cards/status-dot';
import { TabBody, TabLinks, TabSwitch } from '@/cards/tab-switch';
import { TrendsView } from '@/cards/trends/trends-view';
import { readCancels } from '@/status/cancel-log';
import { isDevKeyConfigured } from '@/status/dev-key';
import { routerState } from '@/status/cloud-router';
import { runDuration } from '@/status/durations';
import { summarizeCi } from '@/status/headline';
import { latestReleases, type PipelineRun } from '@/status/latest-releases';
import { readReason, stoppedJob } from '@/status/run-reason';
import { activeLocalBuilds } from '@/status/local-build-runner';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releasesByRun } from '@/status/releases';
import { readRunHistory } from '@/status/run-history';
import { recentFailRate, statsKey, workflowStats } from '@/status/run-stats';
import { computeTrends } from '@/status/trends';
import { releaseWorkflowFor } from '@/status/release-workflow';
import { localBuildOf } from '@/status/local-build-target';
import { machineCookie, machineOf, touches } from '@/status/machine-filter';
import { kindsOfRun } from '@/status/runner-kind';
import { siteWorkflows } from '@/status/site-deploy';
import { readRunnerCount, readThisPc } from '@/status/this-pc';

/** The tab, repo and period of the address, so a machine chip keeps them. */
const keptQuery = (query: Record<string, string | string[] | undefined>) =>
  Object.fromEntries(
    ['tab', 'repo', 'days'].flatMap((key) => (typeof query[key] === 'string' ? [[key, query[key]]] : [])),
  ) as Record<string, string>;

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [pc, org, count, query, cancels, jar] = await Promise.all([
    readThisPc(),
    fetchOrgStatus(),
    readRunnerCount(),
    searchParams,
    readCancels(),
    cookies(),
  ]);
  // One machine, or all of them. The headline still counts every machine.
  const machine = machineOf(query.machine, jar.get(machineCookie)?.value);
  // Releases is the tab the person opens the page for; Status stays one click away.
  const tab = query.tab === 'status' || query.tab === 'trends' ? query.tab : 'releases';
  const fullHistory = await readRunHistory();
  const history = {
    ...fullHistory,
    history: {
      ...fullHistory.history,
      runs: fullHistory.history.runs.filter((run) => touches(run.jobs?.kinds, machine)),
    },
  };
  // Each card shows how its workflow did, so every tab reads the kept history.
  const stats = workflowStats(history.history.runs, Date.now());
  const failRate = recentFailRate(history.history.runs, Date.now());
  const trendDays = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const trendRepo = typeof query.repo === 'string' && query.repo ? query.repo : null;
  const now = Date.now();
  const local = localRunnerNames(pc);
  const allRuns = org.ok ? org.runs : [];
  const releases = org.ok ? org.releases : [];
  const allLive = liveJobs(allRuns, local);
  const stuck = idleWhileQueued(org.ok ? org.runners : null, local, allLive, now);
  const headline = summarizeCi(pc, org, allLive, stuck);
  const runs = allRuns.filter((run) => touches(kindsOfRun(run.jobs, local), machine));
  const live = allLive.filter((job) => touches([job.kind], machine));
  // The table runs in the browser, so it gets each run without its jobs.
  const releaseOf = releasesByRun(allRuns, releases);
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
      usual: stats.get(statsKey(run.repo, run.workflow)) ?? null,
    };
  });
  // The release states need the place of each run and the failure inside its jobs.
  const pipelineRuns: PipelineRun[] = allRuns.map((run) => ({
    id: run.id,
    repo: run.repo,
    workflow: run.workflow,
    typicalMs: run.typicalMs,
    title: run.title,
    branch: run.branch,
    headSha: run.headSha,
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
  // An app shows under a machine when its current run has a job there.
  // The machine filter applies to run activity, not the inventory: a released app has no active
  // run or runner to match, and hiding it made the Releases tab appear empty.
  const apps = latestReleases(releases, pipelineRuns, cancels, now);
  // An app with no release yet names its pipeline only through the run that builds it.
  for (const app of apps) {
    const workflow = app.pipeline ?? app.run?.workflow;
    app.stats = workflow ? (stats.get(statsKey(app.repo, workflow)) ?? null) : null;
  }
  // A failed or cancelled release says why, from the annotations and the log of its stopped job.
  if (tab === 'releases')
    await Promise.all(
      apps.map(async (app) => {
        if (!app.run || (app.state !== 'errored' && app.state !== 'cancelled')) return;
        const job = stoppedJob(allRuns.find((run) => run.id === app.run?.id)?.jobs ?? []);
        app.reason = job ? await readReason(app.repo, job) : null;
      }),
    );
  // Release on CI shows for each app whose release workflow the page can tell, Build locally for each
  // app whose clone on this PC has a build script. Only the Releases tab shows them, so the Status tab
  // skips the GitHub calls of the lookup.
  const finders =
    tab === 'releases' && org.ok
      ? [(app: string) => releaseWorkflowFor(app, releases), (app: string) => localBuildOf(app)]
      : [];
  const [[releasable = [], buildable = []], siteFlows] = await Promise.all([
    Promise.all(
      finders.map(async (find) =>
        (await Promise.all(apps.map(async ({ app }) => ((await find(app)) ? app : null)))).filter(
          (app) => app !== null,
        ),
      ),
    ),
    tab === 'releases' && org.ok ? siteWorkflows() : [],
  ]);
  // Runs come newest first, so the first run of a site's deploy workflow is its last deploy.
  // Sites are also an inventory: show them regardless of the selected runner, even when
  // there has never been a deploy run on that particular machine.
  const sites: SiteRow[] = siteFlows.map(({ repo, workflow, name, manual, file }) => {
    const run = allRuns.find((item) => item.repo === repo && item.workflowId === workflow);
    return {
      id: `${repo}/${workflow}`,
      repo,
      workflow,
      name,
      manual,
      file,
      run: run ? { status: run.status, conclusion: run.conclusion, url: run.url, createdAt: run.createdAt } : null,
      stats: run ? (stats.get(statsKey(repo, run.workflow)) ?? null) : null,
    };
  });
  const building = apps.filter((app) => app.state === 'building' || app.state === 'queued').length;
  const errored = apps.filter((app) => app.state === 'errored').length;
  return (
    <TabSwitch tab={tab}>
      <main>
        <div className="page-head">
          <header>
            <h1>
              <StatusDot tone={headline.tone} />
              {headline.text}
            </h1>
            <AutoRefresh renderedAt={new Date(now).toISOString()} />
          </header>
          <TabLinks
            links={[
              {
                tab: 'releases',
                href: '/',
                label: (
                  <>
                    Releases
                    {building > 0 && <span className="count">{building} on the way</span>}
                    {errored > 0 && <span className="count bad">{errored} errored</span>}
                  </>
                ),
              },
              { tab: 'status', href: '/?tab=status', label: 'Status' },
              {
                tab: 'trends',
                href: '/?tab=trends',
                label: (
                  <>
                    Trends
                    {failRate !== null && (
                      <span
                        className={`count${failRate >= 0.25 ? ' warn' : ''}`}
                        title="Failed runs of the last 7 days"
                      >
                        {Math.round(failRate * 100)}% failed
                      </span>
                    )}
                  </>
                ),
              },
            ]}
          />
          <div className="filter-bar">
            <MachineFilter pick={machine} query={keptQuery(query)} />
            <ColorKey />
          </div>
        </div>
        <TabBody tab={tab}>
          {tab === 'trends' ? (
            <TrendsView state={history} repo={trendRepo} days={trendDays} now={now} />
          ) : tab === 'releases' ? (
            <div className="grid">
              {org.ok ? (
                <>
                  {org.releasesError && (
                    <p className="error">Could not refresh published releases: {org.releasesError}. Showing the last known data when available.</p>
                  )}
                  <ReleasesCard
                    apps={apps}
                    releasable={releasable}
                    buildable={buildable}
                    localBuilds={activeLocalBuilds()}
                    jobs={live}
                    now={now}
                    devKeyConfigured={isDevKeyConfigured(process.env.WORKBENCH_DEV_KEY)}
                  />
                  <SitesCard sites={sites} now={now} />
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
              <RunnersCard
                pc={pc}
                org={org}
                jobs={live}
                count={count}
                now={now}
                machine={machine}
                machines={computeTrends(history.history.runs, { now, days: 14 }).machines}
              />
              {org.ok && <LatestRunsTable runs={rows} now={now} />}
            </div>
          )}
        </TabBody>
        <CancellationHistory entries={[...cancels.values()]} />
      </main>
    </TabSwitch>
  );
}
