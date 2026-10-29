import { formatAge } from '@/status/headline';
import type { LiveJob, RunnerSlot } from '@/status/placement';
import { Icon, placeIcons } from './icons';
import { JobProgress } from './job-progress';
import { RunControls } from './run-controls';
import { StatusDot } from './status-dot';

const columns: { place: LiveJob['place']; empty: string }[] = [
	{ place: 'local', empty: 'No runner is installed on this PC.' },
	{ place: 'waiting', empty: 'No job waits for a runner.' },
	{ place: 'elsewhere', empty: 'No job builds on another runner.' },
];

/** What builds right now: every runner of this PC, the GitHub queue, and other runners. */
export function LiveJobsCard({ jobs, slots, now }: { jobs: LiveJob[]; slots: RunnerSlot[]; now: number }) {
	return (
		<section className="card wide">
			<h2>Now</h2>
			<div className="live">
				{columns.map(({ place, empty }) => {
					const inPlace = jobs.filter((job) => job.place === place);
					const { icon, text } = placeIcons[place];
					const rows = place === 'local' ? slots.length : inPlace.length;
					return (
						<div key={place} className={`live-column ${place}`}>
							<h3>
								<Icon name={icon} />
								{text}
								<span className="count">{place === 'local' ? `${inPlace.length} / ${slots.length}` : inPlace.length}</span>
							</h3>
							{rows ? (
								<ul className="jobs">
									{place === 'local'
										? slots.map((slot) => <RunnerRow key={slot.runner?.folder ?? slot.job?.key} slot={slot} now={now} />)
										: inPlace.map((job) => <JobItem key={job.key} job={job} now={now} />)}
								</ul>
							) : (
								<p className="muted small">{empty}</p>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}

/** A runner of this PC with its job, or idle, or stopped. */
function RunnerRow({ slot: { runner, job }, now }: { slot: RunnerSlot; now: number }) {
	const stopped = runner !== null && !runner.listener;
	const busy = Boolean(job || runner?.worker);
	return (
		<li>
			<StatusDot tone={stopped ? 'bad' : busy ? 'busy' : 'ok'} />
			<div className="grow">
				<strong>{runner ? (runner.name ?? runner.folder) : job?.runnerName}</strong>{' '}
				{job ? (
					<a href={job.url} target="_blank" rel="noreferrer">
						{job.repo} / {job.workflow}
						{job.name && ` / ${job.name}`}
					</a>
				) : (
					<span className="muted">{stopped ? 'stopped' : busy ? 'running a job' : 'idle'}</span>
				)}
				{job && (
					<>
						<div className="muted small">started {formatAge(job.since, now)}</div>
						<JobProgress job={job} now={now} />
						<RunControls repo={job.repo} runId={job.runId} active label={`the ${job.repo} / ${job.workflow} run`} />
					</>
				)}
			</div>
		</li>
	);
}

function JobItem({ job, now }: { job: LiveJob; now: number }) {
	const where = job.place === 'waiting' ? `wants ${job.labels.join(', ') || 'a runner'}` : job.runnerName;
	return (
		<li>
			<Icon name={job.place === 'waiting' ? 'queued' : 'running'} className={job.place} />
			<div className="grow">
				<a href={job.url} target="_blank" rel="noreferrer">
					{job.repo} / {job.workflow}
					{job.name && ` / ${job.name}`}
				</a>
				<div className="muted small">
					{where && `${where}, `}
					{job.place === 'waiting' ? 'queued' : 'started'} {formatAge(job.since, now)}
				</div>
				{job.place !== 'waiting' && <JobProgress job={job} now={now} />}
				<RunControls repo={job.repo} runId={job.runId} active label={`the ${job.repo} / ${job.workflow} run`} />
			</div>
		</li>
	);
}
