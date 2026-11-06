import type { RunWait, ReleaseState } from '@/status/latest-releases';
import type { LiveJob } from '@/status/placement';
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
  if (state === 'queued')
    return <p className="release-detail muted small">Waiting for a runner; progress starts when building.</p>;

  const running = jobs.filter((job) => job.place !== 'waiting');
  const typical = wait?.usualMs;
  const estimate = typical && typical > 0 && wait ? durationProgress(wait.elapsedMs, typical) : null;
  if (!estimate && !running.length) return null;
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
      {running.map((job) => (
        <div className="release-job" key={job.key}>
          <strong>{job.name ?? job.workflow}</strong>
          <JobProgress job={job} now={now} />
        </div>
      ))}
    </div>
  );
}
