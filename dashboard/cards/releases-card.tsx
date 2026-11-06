'use client';
import { CancelReason } from './cancel-reason';

import { useState } from 'react';
import { formatAge } from '@/status/headline';
import { installRelease } from '@/status/install-apk';
import { formatDuration } from '@/status/durations';
import { buildLatestMain, installLocalBuild } from '@/status/local-build';
import type { AppRelease, ReleaseState, RunView } from '@/status/latest-releases';
import type { LiveJob } from '@/status/placement';
import { dispatchRelease } from '@/status/release-actions';
import { releaseTargetFor } from '@/status/release-config';
import { Icon, placeIcons, type IconName } from './icons';
import { ReleaseProgress } from './release-progress';

type Outcome = 'queued' | 'installing' | { ok: boolean; text: string };
type LocalAction = {
  busy?: 'dispatch' | 'build' | 'install';
  message?: string;
  error?: string;
  artifact?: { token: string; fileName: string; commit: string };
};

/** The look and the words of each release state. */
const chipOf: Record<ReleaseState, { icon: IconName; text: string; tone: 'ok' | 'busy' | 'warn' | 'bad' | 'muted' }> = {
  released: { icon: 'success', text: 'Released', tone: 'ok' },
  building: { icon: 'running', text: 'Building', tone: 'busy' },
  queued: { icon: 'queued', text: 'Queued', tone: 'warn' },
  errored: { icon: 'failure', text: 'Errored', tone: 'bad' },
  cancelled: { icon: 'cancelled', text: 'Cancelled', tone: 'bad' },
  'gate-held': { icon: 'queued', text: 'Held', tone: 'warn' },
  'no-release': { icon: 'package', text: 'No release yet', tone: 'muted' },
};

/** Each app, its newest release and what its release pipeline does. The ticked APKs go on the phone over adb one by one. */
export function ReleasesCard({ apps, jobs, now }: { apps: AppRelease[]; jobs: LiveJob[]; now: number }) {
  // Apps stay ticked across refreshes, and Install takes the release that is newest at the click.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [localActions, setLocalActions] = useState<Record<string, LocalAction>>({});
  const [running, setRunning] = useState(false);
  const withApk = apps.filter((app) => app.release?.apk);
  const chosen = withApk.filter((app) => ticked.has(app.app));
  const allTicked = withApk.length > 0 && chosen.length === withApk.length;

  const toggle = (app: string) =>
    setTicked((current) => new Set(current.has(app) ? [...current].filter((item) => item !== app) : [...current, app]));
  const setOutcome = (app: string, outcome: Outcome) => setOutcomes((current) => ({ ...current, [app]: outcome }));
  const setLocalAction = (app: string, action: LocalAction) =>
    setLocalActions((current) => ({ ...current, [app]: { ...current[app], ...action } }));

  const runReleaseAction = async (app: string, kind: 'dispatch' | 'build' | 'install') => {
    setLocalAction(app, { busy: kind, error: undefined, message: undefined });
    if (kind === 'dispatch') {
      const answer = await dispatchRelease(app).catch((error: Error) => ({ ok: false as const, error: error.message }));
      setLocalAction(app, {
        busy: undefined,
        ...(answer.ok ? { message: 'Release queued on CI.' } : { error: answer.error }),
      });
      return;
    }
    if (kind === 'build') {
      const answer = await buildLatestMain(app).catch((error: Error) => ({ ok: false as const, error: error.message }));
      setLocalAction(app, {
        busy: undefined,
        ...(answer.ok
          ? {
              message: `Built from ${answer.commit.slice(0, 7)}.`,
              artifact: { token: answer.token, fileName: answer.fileName, commit: answer.commit },
            }
          : { error: answer.error }),
      });
      return;
    }
    const artifact = localActions[app]?.artifact;
    if (!artifact) {
      setLocalAction(app, { busy: undefined, error: 'Build a local APK first.' });
      return;
    }
    const answer = await installLocalBuild(artifact.token).catch((error: Error) => ({
      ok: false as const,
      error: error.message,
    }));
    setLocalAction(app, {
      busy: undefined,
      ...(answer.ok ? { message: `Installed on ${answer.device}.`, artifact: undefined } : { error: answer.error }),
    });
  };

  const installChosen = async () => {
    setRunning(true);
    const chosenTags = chosen.flatMap((app) => (app.release ? [{ app: app.app, tag: app.release.tag }] : []));
    for (const { app } of chosenTags) setOutcome(app, 'queued');
    // adb installs on one phone, so the APKs go one after another.
    for (const { app, tag } of chosenTags) {
      setOutcome(app, 'installing');
      const answer = await installRelease(tag).catch((error: Error) => ({
        ok: false as const,
        error: error.message,
      }));
      setOutcome(
        app,
        answer.ok ? { ok: true, text: `Installed on ${answer.device}` } : { ok: false, text: answer.error },
      );
    }
    setRunning(false);
  };

  return (
    <section className="card wide">
      <h2>Releases</h2>
      <p className="muted small">
        Each app, its newest release, and what the next one does. Tick the apps to put on the phone plugged in over USB,
        then press Install.
      </p>
      <div className="toolbar">
        <label className="tick">
          <input
            type="checkbox"
            checked={allTicked}
            disabled={running || !withApk.length}
            onChange={() => setTicked(new Set(allTicked ? [] : withApk.map((app) => app.app)))}
          />
          All with an APK
        </label>
        <button type="button" className="action" disabled={running || !chosen.length} onClick={installChosen}>
          <Icon name="phone" />
          {running ? 'Installing' : `Install ${chosen.length || ''}`.trim()}
        </button>
      </div>
      <ul className="releases">
        {apps.map((app) => (
          <AppItem
            key={app.app}
            app={app}
            now={now}
            jobs={app.run ? jobs.filter((job) => job.runId === app.run?.id) : []}
            ticked={ticked.has(app.app)}
            disabled={running}
            outcome={outcomes[app.app]}
            actions={localActions[app.app] ?? {}}
            hasReleaseWorkflow={releaseTargetFor(app.app) !== null}
            canBuildLocally={!!releaseTargetFor(app.app)?.build}
            onToggle={() => toggle(app.app)}
            onAction={(kind) => runReleaseAction(app.app, kind)}
          />
        ))}
      </ul>
      {!apps.length && <p className="muted small">No app with a release yet.</p>}
    </section>
  );
}

type ItemProps = {
  app: AppRelease;
  now: number;
  jobs: LiveJob[];
  ticked: boolean;
  disabled: boolean;
  outcome: Outcome | undefined;
  actions: LocalAction;
  hasReleaseWorkflow: boolean;
  canBuildLocally: boolean;
  onToggle: () => void;
  onAction: (kind: 'dispatch' | 'build' | 'install') => void;
};

function AppItem({
  app: { app, repo, release, state, run, wait, why },
  now,
  jobs,
  ticked,
  disabled,
  outcome,
  actions,
  hasReleaseWorkflow,
  canBuildLocally,
  onToggle,
  onAction,
}: ItemProps) {
  const chip = chipOf[state];
  const hint = run && run.place !== 'done' && state === 'building' ? placeIcons[run.place].hint : undefined;
  return (
    <li>
      <div className="release-head">
        <input
          type="checkbox"
          aria-label={`Install ${app}`}
          checked={ticked}
          disabled={disabled || !release?.apk}
          onChange={onToggle}
          title={release?.apk ? undefined : 'This release has no APK'}
        />
        <strong>{app}</strong>
        {run ? (
          <a className={`state ${chip.tone}`} href={run.url} target="_blank" rel="noreferrer" title={hint}>
            <Icon name={chip.icon} />
            {chip.text}
          </a>
        ) : (
          <span className={`state ${chip.tone}`}>
            <Icon name={chip.icon} />
            {chip.text}
          </span>
        )}
        {release && (
          <a className="release-link" href={release.url} target="_blank" rel="noreferrer">
            <Icon name="package" />
            {release.name}
          </a>
        )}
        {release && <span className="muted small nowrap">{formatAge(release.createdAt, now)}</span>}
        {repo !== app && <span className="muted small">from {repo}</span>}
        <OutcomeText outcome={outcome} />
      </div>
      <Detail state={state} run={run} wait={wait} why={why} now={now} />
      {(state === 'building' || state === 'queued') && (
        <ReleaseProgress app={app} state={state} jobs={jobs} wait={wait} now={now} />
      )}
      {(hasReleaseWorkflow || canBuildLocally) && (
        <div className="release-actions">
          {hasReleaseWorkflow && (
            <button type="button" className="action" disabled={!!actions.busy} onClick={() => onAction('dispatch')}>
              {actions.busy === 'dispatch' ? 'Queueing' : 'Release on CI'}
            </button>
          )}
          {canBuildLocally && (
            <button
              type="button"
              className="action"
              disabled={!!actions.busy}
              onClick={() => onAction('build')}
              title="Fetch main and build in a temporary checkout on this PC"
            >
              {actions.busy === 'build' ? 'Building locally' : 'Build locally'}
            </button>
          )}
          {actions.artifact && (
            <button type="button" className="action" disabled={!!actions.busy} onClick={() => onAction('install')}>
              {actions.busy === 'install' ? 'Installing' : 'Install local'}
            </button>
          )}
          {actions.message && (
            <span className="install-ok small" role="status">
              {actions.message}
            </span>
          )}
          {actions.error && (
            <pre className="install-error" role="alert">
              {actions.error}
            </pre>
          )}
        </div>
      )}
      {release?.notesHtml && (
        <details className="notes">
          <summary>Changes</summary>
          {/* GitHub renders the notes and strips scripts from them. */}
          <div dangerouslySetInnerHTML={{ __html: release.notesHtml }} />
        </details>
      )}
    </li>
  );
}

/** The line under the head: the wait, the reason a release stopped, or what a failure broke. */
function Detail({
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
    const where = state === 'building' && run && run.place !== 'done' ? placeIcons[run.place].text.toLowerCase() : null;
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

function OutcomeText({ outcome }: { outcome: Outcome | undefined }) {
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
