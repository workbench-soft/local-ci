import { AutoRefresh } from '@/cards/auto-refresh';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { RunnersCard } from '@/cards/runners-card';
import { RunningNowCard } from '@/cards/running-now-card';
import { StatusDot } from '@/cards/status-dot';
import { summarizeCi } from '@/status/headline';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releaseOfRun } from '@/status/releases';
import { readThisPc } from '@/status/this-pc';

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
	const [pc, org] = await Promise.all([readThisPc(), fetchOrgStatus()]);
	const now = Date.now();
	const local = localRunnerNames(pc);
	const runs = org.ok ? org.runs : [];
	const releases = org.ok ? org.releases : [];
	const live = liveJobs(runs, local);
	const { idle } = idleWhileQueued(org.ok ? org.runners : null, local, live, now);
	const headline = summarizeCi(pc, org, live, idle);
	// The table runs in the browser, so it gets each run without its jobs.
	const rows: RunRow[] = runs.map((run) => {
		const { jobs, updatedAt, ...row } = run;
		return { ...row, place: placeOfRun(run, local), release: releaseOfRun(run, releases), failure: failureOf(run) };
	});
	return (
		<main>
			<header>
				<h1>
					<StatusDot tone={headline.tone} />
					{headline.text}
				</h1>
				<AutoRefresh renderedAt={new Date(now).toISOString()} />
			</header>
			<div className="grid">
				{org.ok && <LiveJobsCard jobs={live} slots={runnerSlots(pc, live)} now={now} />}
				<RunnersCard pc={pc} org={org} jobs={live} now={now} />
				{org.ok && <RunningNowCard jobs={live} idle={idle} now={now} />}
				{org.ok && <LatestRunsTable runs={rows} now={now} />}
			</div>
		</main>
	);
}
