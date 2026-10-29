import { AutoRefresh } from '@/cards/auto-refresh';
import { LatestRunsTable, type RunRow } from '@/cards/latest-runs-table';
import { LiveJobsCard } from '@/cards/live-jobs-card';
import { OrgRunnersCard } from '@/cards/org-runners-card';
import { StatusDot } from '@/cards/status-dot';
import { ThisPcCard } from '@/cards/this-pc-card';
import { summarizeCi } from '@/status/headline';
import { fetchOrgStatus } from '@/status/org-status';
import { liveJobs, localRunnerNames, placeOfRun } from '@/status/placement';
import { readThisPc } from '@/status/this-pc';

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
	const [pc, org] = await Promise.all([readThisPc(), fetchOrgStatus()]);
	const now = Date.now();
	const local = localRunnerNames(pc);
	const runs = org.ok ? org.runs : [];
	const live = liveJobs(runs, local);
	const headline = summarizeCi(pc, org, live);
	// The table runs in the browser, so it gets each run without its jobs.
	const rows: RunRow[] = runs.map((run) => {
		const { jobs, updatedAt, ...row } = run;
		return { ...row, place: placeOfRun(run, local) };
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
				{org.ok && <LiveJobsCard jobs={live} now={now} />}
				<ThisPcCard pc={pc} jobs={live} now={now} />
				<OrgRunnersCard org={org} />
				{org.ok && <LatestRunsTable runs={rows} now={now} />}
			</div>
		</main>
	);
}
