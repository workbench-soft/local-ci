import { cookies } from 'next/headers';
import { CancellationHistory } from '@/cards/cancellation-history';
import { AutoRefresh } from '@/cards/auto-refresh';
import { CloudCard } from '@/cards/cloud-card';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { ColorKey, MachineFilter } from '@/cards/machine-filter';
import { RunnersCard } from '@/cards/runners-card';
import { StatusDot } from '@/cards/status-dot';
import { StorageCleanupButton } from '@/cards/storage-cleanup-button';
import { TabBody, TabLinks, TabSwitch } from '@/cards/tab-switch';
import { TrendsView } from '@/cards/trends/trends-view';
import { readCancels } from '@/status/cancel-log';
import { routerState } from '@/status/cloud-router';
import { runDuration } from '@/status/durations';
import { summarizeCi } from '@/status/headline';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releasesByRun } from '@/status/releases';
import { readRunHistory } from '@/status/run-history';
import { recentFailRate, statsKey, workflowStats } from '@/status/run-stats';
import { computeTrends } from '@/status/trends';
import { machineCookie, machineOf, touches } from '@/status/machine-filter';
import { kindsOfRun } from '@/status/runner-kind';
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
    fetchOrgStatus({ viewer: true }),
    readRunnerCount(),
    searchParams,
    readCancels(),
    cookies(),
  ]);
  // One machine, or all of them. The headline still counts every machine.
  const machine = machineOf(query.machine, jar.get(machineCookie)?.value);
  const tab = query.tab === 'trends' ? 'trends' : 'status';
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
  const allLive = liveJobs(allRuns, local);
  const stuck = idleWhileQueued(org.ok ? org.runners : null, local, allLive, now);
  const headline = summarizeCi(pc, org, allLive, stuck);
  const runs = allRuns.filter((run) => touches(kindsOfRun(run.jobs, local), machine));
  const live = allLive.filter((job) => touches([job.kind], machine));
  // The table runs in the browser, so it gets each run without its jobs.
  const releaseOf = releasesByRun(allRuns, org.ok ? org.releases : []);
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
              { tab: 'status', href: '/', label: 'Status' },
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
          <p className="archon-note muted">Apps and sites live in Archon: Apps and Sites tabs.</p>
          <div className="filter-bar">
            <MachineFilter pick={machine} query={keptQuery(query)} />
            <ColorKey />
          </div>
        </div>
        <TabBody tab={tab}>
          {tab === 'trends' ? (
            <TrendsView state={history} repo={trendRepo} days={trendDays} now={now} />
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
              <StorageCleanupButton />
            </div>
          )}
        </TabBody>
        <CancellationHistory entries={[...cancels.values()]} />
      </main>
    </TabSwitch>
  );
}
