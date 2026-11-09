import { formatAge } from '@/status/headline';
import { formatDuration } from '@/status/durations';
import type { AppRelease, ReleaseState, RunView } from '@/status/latest-releases';
import { kindNames } from '@/status/runner-kind';
import { CancelReason } from './cancel-reason';
import { placeIcons } from './icons';

export type Outcome = 'queued' | 'installing' | { ok: boolean; text: string };

/** The line under the head: the wait, the reason a release stopped, or what a failure broke. */
export function Detail({
  state,
  run,
  wait,
  why,
  now,
}: {
  state: ReleaseState;
  run: RunView | null;
  wait: AppRelease['wait'];
  why: AppRelease['why'];
  now: number;
}) {
  if (state === 'building' || state === 'queued') {
    if (!wait) return null;
    const elapsed = `for ${formatDuration(wait.elapsedMs)}`;
    const machines = run?.machines.map((kind) => kindNames[kind]).join(', ');
    const where =
      state === 'building'
        ? machines
          ? `on ${machines}`
          : run && run.place !== 'done'
            ? placeIcons[run.place].text.toLowerCase()
            : null
        : null;
    const left =
      wait.usualMs === null
        ? null
        : wait.usualMs - wait.elapsedMs >= 0
          ? `about ${formatDuration(wait.usualMs - wait.elapsedMs)} left`
          : `${formatDuration(wait.elapsedMs - wait.usualMs)} over the usual ${formatDuration(wait.usualMs)}`;
    return (
      <p className="release-detail muted small">
        {where ? `${elapsed} ${where}` : elapsed}
        {left && `, ${left}`}
      </p>
    );
  }
  if (state === 'errored' && run) {
    return (
      <p className="release-detail bad small">
        {run.workflow} failed{run.failedStep ? ` at ${run.failedStep}` : ''}
        {run.failedJob && !run.failedStep ? ` in ${run.failedJob}` : ''}
      </p>
    );
  }
  if (state === 'cancelled') {
    return (
      <p className="release-detail bad small">
        {why ? (
          <>
            <CancelReason entry={why} /> · {formatAge(why.at, now)}
          </>
        ) : (
          'No cancellation evidence was recorded.'
        )}
      </p>
    );
  }
  if (state === 'gate-held') {
    return <p className="release-detail muted small">The release waits while a PR of this batch is still open.</p>;
  }
  return null;
}

export function OutcomeText({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) return null;
  if (outcome === 'queued') return <span className="muted small">Waiting</span>;
  if (outcome === 'installing') return <span className="muted small">Installing</span>;
  if (outcome.ok)
    return (
      <span className="install-ok small" role="status">
        {outcome.text}
      </span>
    );
  return (
    <pre className="install-error" role="alert">
      {outcome.text}
    </pre>
  );
}
