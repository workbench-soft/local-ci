import { formatAge } from '@/status/headline';
import type { LiveJob } from '@/status/placement';
import { JobProgress } from './job-progress';
import { RunControls } from './run-controls';
import { StatusDot } from './status-dot';

/** A large row per job that builds right now, on this PC or elsewhere, so the person sees it at a glance. */
export function RunningNowCard({ jobs, idle, now }: { jobs: LiveJob[]; idle: string[]; now: number }) {
	const running = jobs.filter((job) => job.place !== 'waiting');
	const waiting = jobs.length - running.length;
	return (
		<section className={`card wide running-now${idle.length ? ' stuck' : ''}`}>
			<h2>
				Running now <span className="count">{running.length}</span>
			</h2>
			{idle.length > 0 && (
				<p className="error">
					{idle.join(', ')} {idle.length === 1 ? 'sits' : 'sit'} idle while {waiting} {waiting === 1 ? 'job waits' : 'jobs wait'} on GitHub.
					GitHub doesn't hand the jobs over. Restart the runner's boot task, or reboot the PC.
				</p>
			)}
			{running.length ? (
				<ul className="running">
					{running.map((job) => (
						<li key={job.key}>
							<StatusDot tone="busy" />
							<div className="grow">
								<div className="what">
									<strong>{job.runnerName ?? 'A runner'}</strong>{' '}
									<a href={job.url} target="_blank" rel="noreferrer">
										{job.repo} / {job.workflow}
										{job.name && ` / ${job.name}`}
									</a>
								</div>
								<div className="muted small">
									{job.place === 'local' ? 'on this PC' : 'on another machine'}, started {formatAge(job.since, now)}
								</div>
								<JobProgress job={job} now={now} />
							</div>
							<RunControls repo={job.repo} runId={job.runId} active label={`the ${job.repo} / ${job.workflow} run`} />
						</li>
					))}
				</ul>
			) : (
				<p className={waiting ? 'error' : 'muted'}>
					{waiting ? `No job builds, and ${waiting} ${waiting === 1 ? 'waits' : 'wait'} on GitHub for a runner.` : 'No job builds, and the queue is empty.'}
				</p>
			)}
		</section>
	);
}
