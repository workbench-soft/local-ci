import type { RunWait, ReleaseState } from '@/status/latest-releases';
import type { LiveJob } from '@/status/placement';
import { kindNames } from '@/status/runner-kind';
import { durationProgress } from '@/status/progress';
import { formatDuration } from '@/status/durations';
import { JobProgress } from './job-progress';

/** Workflow progress and job-level detail for a release in flight.
 * Historical durations are estimates, not GitHub's measured percent complete.
 */
export function ReleaseProgress({
  app,
  state,
  jobs,
  wait,
  now,
}: {
  app: string;
  state: Extract<ReleaseState, 'building' | 'queued'>;
  jobs: LiveJob[];
  wait: RunWait | null;
  now: number;
}) {
  if (state === 'queued' && !jobs.length)
    return <p className="release-detail muted small">Waiting for a runner; progress starts when building.</p>;

  const typical = state === 'building' ? wait?.usualMs : null;
  const estimate = typical && typical > 0 && wait ? durationProgress(wait.elapsedMs, typical) : null;
  if (!estimate && !jobs.length) return null;
  const percent = estimate ? Math.round(estimate.fraction * 100) : null;

  return (
    <div className="release-progress">
      {estimate && percent !== null && (
        <>
          <div
            className={estimate.over ? 'progress-bar over' : 'progress-bar'}
            role="progressbar"
            aria-label={`${app} release estimated progress`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="release-estimate muted small">
            {percent}% estimated · {estimate.time} · usually {formatDuration(typical!)} (recent releases)
          </div>
        </>
      )}
      {jobs.map((job) => (
        <div className="release-job" key={job.key}>
          <a href={job.url} target="_blank" rel="noreferrer">
            <strong>{job.name ?? job.workflow}</strong>
          </a>
          <span className="muted small">
            {' · '}
            {job.place === 'waiting' ? `waiting for ${kindNames[job.kind]}` : `on ${kindNames[job.kind]}`}
          </span>
          {job.place !== 'waiting' && <JobProgress job={job} now={now} />}
        </div>
      ))}
    </div>
  );
}
