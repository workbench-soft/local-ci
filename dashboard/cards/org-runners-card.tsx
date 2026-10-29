import type { OrgRunner, OrgStatus } from '@/status/org-status';
import { orgName } from '@/status/settings';
import { StatusDot } from './status-dot';

export function OrgRunnersCard({ org }: { org: OrgStatus }) {
	return (
		<section className="card">
			<h2>Runners of {orgName}</h2>
			<RunnerList org={org} />
		</section>
	);
}

function RunnerList({ org }: { org: OrgStatus }) {
	if (!org.ok) return <p className="error">{org.error}</p>;
	if (org.runners === null) return <p className="error">{org.runnersError}. Listing runners needs a token with admin:org.</p>;
	if (org.runners.length === 0) return <p className="muted">The org has no runners.</p>;
	return (
		<ul className="runners">
			{org.runners.map((runner) => (
				<RunnerItem key={runner.id} runner={runner} />
			))}
		</ul>
	);
}

function RunnerItem({ runner }: { runner: OrgRunner }) {
	const state = runner.status === 'offline' ? 'offline' : runner.busy ? 'busy' : 'idle';
	return (
		<li>
			<StatusDot tone={state === 'offline' ? 'bad' : state === 'busy' ? 'busy' : 'ok'} />
			<strong>{runner.name}</strong> {state}
			<div className="labels">
				{runner.labels.map((label) => (
					<span key={label} className="label">
						{label}
					</span>
				))}
			</div>
		</li>
	);
}
