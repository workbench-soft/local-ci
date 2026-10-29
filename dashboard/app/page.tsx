import { AutoRefresh } from '@/cards/auto-refresh';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { RunnersCard } from '@/cards/runners-card';
import { StatusDot } from '@/cards/status-dot';
import { runDuration } from '@/status/durations';
import { summarizeCi } from '@/status/headline';
import { failureOf, fetchOrgStatus } from '@/status/org-status';
import { idleWhileQueued, liveJobs, localRunnerNames, placeOfRun, runnerSlots } from '@/status/placement';
import { releasesByRun } from '@/status/releases';
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
	const stuck = idleWhileQueued(org.ok ? org.runners : null, local, live, now);
	const headline = summarizeCi(pc, org, live, stuck);
	// The table runs in the browser, so it gets each run without its jobs.
	const releaseOf = releasesByRun(runs, releases);
	const rows: RunRow[] = runs.map((run) => {
		const { jobs, updatedAt, ...row } = run;
		return { ...row, tookMs: runDuration(run, now), place: placeOfRun(run, local), release: releaseOf.get(run.id) ?? null, failure: failureOf(run) };
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
				{org.ok && <LiveJobsCard jobs={live} slots={runnerSlots(pc, live)} stuck={stuck} now={now} />}
				<RunnersCard pc={pc} org={org} jobs={live} now={now} />
				{org.ok && <LatestRunsTable runs={rows} now={now} />}
			</div>
		</main>
	);
}
