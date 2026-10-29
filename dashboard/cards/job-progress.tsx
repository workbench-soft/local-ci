import type { LiveJob } from '@/status/placement';
import { jobProgress } from '@/status/progress';

/** A bar under a running job, with its step and the time left. A job without steps or a past run gets none. */
export function JobProgress({ job, now }: { job: LiveJob; now: number }) {
	if (!job.steps || (!job.steps.total && !job.typicalMs)) return null;
	const { fraction, step, time, over } = jobProgress(job.steps, job.typicalMs, job.since, now);
	const percent = Math.round(fraction * 100);
	return (
		<div className="progress small">
			<div className={over ? 'progress-bar over' : 'progress-bar'} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
				<span style={{ width: `${percent}%` }} />
			</div>
			<div className="muted">{[step, time].filter(Boolean).join(', ')}</div>
		</div>
	);
}
