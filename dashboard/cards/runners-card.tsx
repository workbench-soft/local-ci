import { formatAge } from '@/status/headline';
import type { OrgStatus } from '@/status/org-status';
import type { LiveJob } from '@/status/placement';
import { githubState, mergeRunners, pcState, type RunnerRow } from '@/status/runners';
import type { ThisPcStatus } from '@/status/this-pc';
import { StatusDot } from './status-dot';

/** Every runner once, with what this PC and GitHub each say about it. */
export function RunnersCard({ pc, org, jobs, now }: { pc: ThisPcStatus; org: OrgStatus; jobs: LiveJob[]; now: number }) {
	const githubRunners = org.ok ? org.runners : null;
	const rows = mergeRunners(pc.supported ? pc.runners : [], githubRunners);
	return (
		<section className="card">
			<h2>Runners</h2>
			{rows.length ? (
				<ul className="runners">
					{rows.map((row) => (
						<RunnerItem key={row.name} row={row} job={jobs.find((job) => job.place !== 'waiting' && job.runnerName === row.name)} listed={githubRunners !== null} now={now} />
					))}
				</ul>
			) : (
				<p className="error">No runner is installed. Run {pc.supported ? 'runner\\install.ps1' : 'runner/install.sh'}.</p>
			)}
			{!pc.supported && <p className="muted small">The checks of this PC's runners need Windows, so the card shows GitHub's view only.</p>}
			{!org.ok && <p className="error small">GitHub: {org.error}</p>}
			{org.ok && org.runners === null && (
				<p className="error small">GitHub: {org.runnersError}. Listing runners needs a token with admin:org.</p>
			)}
		</section>
	);
}

function RunnerItem({ row: { name, here, github, tone, hint }, job, listed, now }: { row: RunnerRow; job: LiveJob | undefined; listed: boolean; now: number }) {
	return (
		<li className={hint ? 'runner-row has-hint' : 'runner-row'}>
			<StatusDot tone={tone} />
			<strong>{name}</strong> <span className="muted small">{here ? 'on this PC' : 'on another machine'}</span>
			<div className="sides small">
				{here && <span>this PC: {pcState(here)}</span>}
				<span>GitHub: {github ? githubState(github) : listed ? 'not registered' : 'unknown'}</span>
			</div>
			<div className="runner-job small">
				{job ? (
					<>
						Builds{' '}
						<a href={job.url} target="_blank" rel="noreferrer">
							{job.repo} / {job.workflow}
							{job.name && ` / ${job.name}`}
						</a>
						<span className="muted">, started {formatAge(job.since, now)}</span>
					</>
				) : (
					<span className="muted">{github?.busy || here?.worker ? 'Builds a job the page has yet to read' : 'No job'}</span>
				)}
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
