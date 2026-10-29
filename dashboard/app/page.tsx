import { AutoRefresh } from '@/cards/auto-refresh';
import { LatestRunsTable } from '@/cards/latest-runs-table';
import { OrgRunnersCard } from '@/cards/org-runners-card';
import { StatusDot } from '@/cards/status-dot';
import { ThisPcCard } from '@/cards/this-pc-card';
import { summarizeCi } from '@/status/headline';
import { fetchOrgStatus } from '@/status/org-status';
import { readThisPc } from '@/status/this-pc';

// Each visit reads the runner afresh, so Next must not prerender the page.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
	const [pc, org] = await Promise.all([readThisPc(), fetchOrgStatus()]);
	const now = Date.now();
	const headline = summarizeCi(pc, org);
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
				<ThisPcCard pc={pc} now={now} />
				<OrgRunnersCard org={org} />
				{org.ok && <LatestRunsTable runs={org.runs} now={now} />}
			</div>
		</main>
	);
}
