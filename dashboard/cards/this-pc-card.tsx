import { formatAge } from '@/status/headline';
import type { LiveJob } from '@/status/placement';
import type { PcRunner, ThisPcStatus } from '@/status/this-pc';
import { StatusDot } from './status-dot';

export function ThisPcCard({ pc, jobs, now }: { pc: ThisPcStatus; jobs: LiveJob[]; now: number }) {
	if (!pc.supported) {
		return (
			<section className="card">
				<h2>This PC</h2>
				<p className="muted">The checks read Windows tools, so they are skipped here.</p>
			</section>
		);
	}
	return (
		<section className="card">
			<h2>This PC</h2>
			{pc.runners.length ? (
				<ul className="runners">
					{pc.runners.map((runner) => (
						<RunnerItem key={runner.folder} runner={runner} job={jobs.find((job) => job.place === 'local' && job.runnerName === runner.name)} now={now} />
					))}
				</ul>
			) : (
				<p className="error">No runner is installed. Run runner\install.ps1.</p>
			)}
		</section>
	);
}

function RunnerItem({ runner, job, now }: { runner: PcRunner; job: LiveJob | undefined; now: number }) {
	const state = !runner.listener ? 'stopped' : runner.worker || job ? 'running a job' : 'idle';
	return (
		<li>
			<StatusDot tone={!runner.listener ? 'bad' : runner.worker || job ? 'busy' : 'ok'} />
			<strong>{runner.name ?? runner.folder}</strong> {state}
			{job && (
				<div className="small">
					<a href={job.url} target="_blank" rel="noreferrer">
						{job.repo} / {job.workflow}
						{job.name && ` / ${job.name}`}
					</a>
					<span className="muted">, started {formatAge(job.since, now)}</span>
				</div>
			)}
			<div className="muted">
				Boot task {runner.task ?? 'missing'}, last job {runner.lastJobAt ? formatAge(runner.lastJobAt, now) : 'none yet'}
			</div>
		</li>
	);
}
