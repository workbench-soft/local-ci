import { formatAge } from '@/status/headline';
import type { OrgStatus } from '@/status/org-status';
import { githubState, mergeRunners, pcState, type RunnerRow } from '@/status/runners';
import type { ThisPcStatus } from '@/status/this-pc';
import { StatusDot } from './status-dot';

/** Every runner once, with what this PC and GitHub each say about it. */
export function RunnersCard({ pc, org, now }: { pc: ThisPcStatus; org: OrgStatus; now: number }) {
	const githubRunners = org.ok ? org.runners : null;
	const rows = mergeRunners(pc.supported ? pc.runners : [], githubRunners);
	return (
		<section className="card">
			<h2>Runners</h2>
			{rows.length ? (
				<ul className="runners">
					{rows.map((row) => (
						<RunnerItem key={row.name} row={row} listed={githubRunners !== null} now={now} />
					))}
				</ul>
			) : (
				<p className="error">No runner is installed. Run runner\install.ps1.</p>
			)}
			{!pc.supported && <p className="muted small">The this PC checks read Windows tools, so they are skipped here.</p>}
			{!org.ok && <p className="error small">GitHub: {org.error}</p>}
			{org.ok && org.runners === null && (
				<p className="error small">GitHub: {org.runnersError}. Listing runners needs a token with admin:org.</p>
			)}
		</section>
	);
}

function RunnerItem({ row: { name, here, github, tone, hint }, listed, now }: { row: RunnerRow; listed: boolean; now: number }) {
	return (
		<li className={hint ? 'runner-row has-hint' : 'runner-row'}>
			<StatusDot tone={tone} />
			<strong>{name}</strong> <span className="muted small">{here ? 'on this PC' : 'on another machine'}</span>
			<div className="sides small">
				{here && <span>this PC: {pcState(here)}</span>}
				<span>GitHub: {github ? githubState(github) : listed ? 'not registered' : 'unknown'}</span>
			</div>
			{hint && <div className="hint small">{hint}</div>}
			{here && (
				<div className="muted small">
					Boot task {here.task ?? 'missing'}, last job {here.lastJobAt ? formatAge(here.lastJobAt, now) : 'none yet'}
				</div>
			)}
			{github && github.labels.length > 0 && (
				<div className="labels">
					{github.labels.map((label) => (
						<span key={label} className="label">
							{label}
						</span>
					))}
				</div>
			)}
		</li>
	);
}
