import type { ReactNode } from 'react';
import type { CancelEntry } from '@/status/cancel-log';
import { formatAge } from '@/status/headline';
import type { AppRelease, RunView } from '@/status/latest-releases';
import type { JobReason } from '@/status/run-failure';
import { orgName } from '@/status/settings';
import { CancelReason } from './cancel-reason';

const link = (url: string, text: string) => (
  <a href={url} target="_blank" rel="noreferrer">
    {text}
  </a>
);

function runLink(repo: string, next: NonNullable<AppRelease['replacedBy']>) {
  return (
    <>
      run {link(next.url, `#${next.id}`)}
      {next.sameCommit
        ? ' of the same commit'
        : next.sha && (
            <> of commit {link(`https://github.com/${orgName}/${repo}/commit/${next.sha}`, next.sha.slice(0, 7))}</>
          )}
    </>
  );
}

// The words Local CI logged a force cancel with, by its cause.
function localCiLine(why: CancelEntry): ReactNode {
  const cause = why.cause;
  const next = cause?.url && cause.runId ? { id: cause.runId, url: cause.url, sha: cause.sha ?? null } : null;
  if (cause?.kind === 'manual') return <>Stopped from this page with Force stop: {why.words}.</>;
  if (cause?.kind === 'checks-failed')
    return <>Local CI stopped it because Checks failed on the same commit{next && <>: {runLink(why.repo, next)}</>}.</>;
  if (cause?.kind === 'superseded')
    return (
      <>Local CI stopped it because a newer commit started the same build{next && <>: {runLink(why.repo, next)}</>}.</>
    );
  return <CancelReason entry={why} />;
}

/** One sentence that says what stopped the run, and who did it. */
function headline(app: AppRelease, run: RunView, reason: JobReason | null): ReactNode {
  const at = reason?.step ? <> at step “{reason.step}”</> : null;
  const where = reason ? <> in job {link(reason.jobUrl, reason.job)}</> : null;
  const runner = reason?.runner ?? 'the runner';
  const cause = app.why?.cause;
  const next =
    app.replacedBy ?? (cause?.url && cause.runId ? { id: cause.runId, url: cause.url, sha: cause.sha ?? null } : null);
  switch (reason?.kind) {
    case 'shutdown':
      return (
        <>
          The PC turned off or restarted during the build: {runner} got a shutdown signal{at}
          {where}.
        </>
      );
    case 'lost-runner':
      return (
        <>
          The PC turned off, slept or lost its network during the build: GitHub lost contact with {runner}
          {at}
          {where}.
        </>
      );
    case 'timeout':
      return (
        <>
          The build ran past its time limit{at}
          {where}.
        </>
      );
    case 'disk-full':
      return (
        <>
          The disk of {runner} is full{at}
          {where}.
        </>
      );
    case 'replaced':
      return (
        <>
          GitHub stopped it because a newer run of the same build took its place
          {next ? <>: {runLink(app.repo, next)}</> : ''}.
        </>
      );
    case 'forced':
      return app.why ? (
        localCiLine(app.why)
      ) : (
        <>@{reason.actor} force cancelled it on GitHub. Local CI has no record of this stop.</>
      );
    case 'cancelled-by':
      return <>@{reason.actor} cancelled it on GitHub.</>;
  }
  const cancelled = run.conclusion === 'cancelled';
  if (cancelled && app.why) return localCiLine(app.why);
  if (reason?.kind === 'error')
    return (
      <>
        {run.workflow} failed{at}
        {where}.
      </>
    );
  if (cancelled) {
    if (next)
      return <>Stopped before a job ran. A newer run of the same build followed it: {runLink(app.repo, next)}.</>;
    return <>GitHub gave no reason for this stop, and Local CI has no record of it.</>;
  }
  return (
    <>
      {run.workflow} failed{at}
      {where}.
    </>
  );
}

/** The reason of an errored or cancelled release: what stopped it, the error line and the log up to it. */
export function StopReason({ app, run, now }: { app: AppRelease; run: RunView; now: number }) {
  const reason = app.reason ?? null;
  const showMessage = reason?.message && reason.kind !== 'forced' && reason.kind !== 'cancelled-by';
  return (
    <div className="release-detail stop-reason small">
      <p className="reason-head">
        {headline(app, run, reason)}
        {app.why && <span className="muted"> · {formatAge(app.why.at, now)}</span>}
        {reason && <> · {link(reason.jobUrl, 'Full log')}</>}
      </p>
      {showMessage && <pre className="reason-message">{reason.message}</pre>}
      {reason?.excerpt && (
        <details open>
          <summary>Log of the step, up to the error</summary>
          <pre className="reason-log">{reason.excerpt}</pre>
        </details>
      )}
    </div>
  );
}
