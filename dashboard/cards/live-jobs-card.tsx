import { formatAge } from '@/status/headline';
import type { LiveJob } from '@/status/placement';
import { Icon, placeIcons } from './icons';

const columns: { place: LiveJob['place']; empty: string }[] = [
	{ place: 'local', empty: 'No job builds on this PC.' },
	{ place: 'waiting', empty: 'No job waits for a runner.' },
	{ place: 'elsewhere', empty: 'No job builds on another runner.' },
];

/** What builds right now: on this PC, in the GitHub queue, and on other runners. */
export function LiveJobsCard({ jobs, now }: { jobs: LiveJob[]; now: number }) {
	return (
		<section className="card wide">
			<h2>Now</h2>
			<div className="live">
				{columns.map(({ place, empty }) => {
					const inPlace = jobs.filter((job) => job.place === place);
					const { icon, text } = placeIcons[place];
					return (
						<div key={place} className={`live-column ${place}`}>
							<h3>
								<Icon name={icon} />
								{text}
								<span className="count">{inPlace.length}</span>
							</h3>
							{inPlace.length ? (
								<ul className="jobs">
									{inPlace.map((job) => (
										<JobItem key={job.key} job={job} now={now} />
									))}
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

function JobItem({ job, now }: { job: LiveJob; now: number }) {
	const where = job.place === 'waiting' ? `wants ${job.labels.join(', ') || 'a runner'}` : job.runnerName;
	return (
		<li>
			<Icon name={job.place === 'waiting' ? 'queued' : 'running'} className={job.place} />
			<div>
				<a href={job.url} target="_blank" rel="noreferrer">
					{job.repo} / {job.workflow}
					{job.name && ` / ${job.name}`}
				</a>
				<div className="muted small">
					{where && `${where}, `}
					{job.place === 'waiting' ? 'queued' : 'started'} {formatAge(job.since, now)}
				</div>
			</div>
		</li>
	);
}
