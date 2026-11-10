'use client';
import { useState } from 'react';
import { installRelease } from '@/status/install-apk';
import { buildLatestMain, cancelLocalBuild, installLocalBuild } from '@/status/local-build';
import type { AppRelease } from '@/status/latest-releases';
import type { LiveJob } from '@/status/placement';
import { dispatchRelease } from '@/status/release-actions';
import { DevKeyNotice } from './dev-key-notice';
import { Icon } from './icons';
import type { Outcome } from './release-detail';
import { AppItem, type LocalAction } from './release-item';
import { StorageCleanupButton } from './storage-cleanup-button';

/** Each app, its newest release and what its release pipeline does. The ticked APKs go on the phone over adb one by one. */
export function ReleasesCard({
  apps,
  releasable,
  buildable,
  jobs,
  localBuilds,
  now,
  devKeyConfigured,
}: {
  apps: AppRelease[];
  /** The apps whose release workflow Release on CI can start. */
  releasable: string[];
  /** The apps this PC can build an APK of from the latest main. */
  buildable: string[];
  jobs: LiveJob[];
  localBuilds: string[];
  now: number;
  devKeyConfigured: boolean;
}) {
  // Apps stay ticked across refreshes, and Install takes the release that is newest at the click.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [localActions, setLocalActions] = useState<Record<string, LocalAction>>({});
  const [running, setRunning] = useState(false);
  const [cancellingLocal, setCancellingLocal] = useState<ReadonlySet<string>>(new Set());
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
        ...(answer.ok ? { message: 'Release queued on CI.', requestedAt: Date.now() } : { error: answer.error }),
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

  const stopLocal = async (app: string) => {
    if (!window.confirm(`Force-stop the local build of ${app}? The build process and its children will be terminated.`))
      return;
    setCancellingLocal((current) => new Set([...current, app]));
    const answer = await cancelLocalBuild(app).catch((error: Error) => ({ ok: false as const, error: error.message }));
    setLocalAction(app, answer.ok ? { message: 'Stopping local build.', error: undefined } : { error: answer.error });
    setCancellingLocal((current) => new Set([...current].filter((item) => item !== app)));
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
        Each app, its newest release, and what the next one does. Install Release puts the latest APK on your USB phone;
        Install Dev also unlocks the existing developer controls. Tick apps above to install several releases.
      </p>
      <DevKeyNotice configured={devKeyConfigured} />
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
      <StorageCleanupButton />
      <ul className="releases">
        {apps.map((app) => (
          <AppItem
            key={app.app}
            app={app}
            now={now}
            jobs={app.run ? jobs.filter((job) => job.runId === app.run?.id) : []}
            ticked={ticked.has(app.app)}
            disabled={running}
            localBuildRunning={localBuilds.includes(app.app) || localActions[app.app]?.busy === 'build'}
            localBuildStopping={cancellingLocal.has(app.app)}
            outcome={outcomes[app.app]}
            actions={localActions[app.app] ?? {}}
            hasReleaseWorkflow={releasable.includes(app.app)}
            canBuildLocally={buildable.includes(app.app)}
            onToggle={() => toggle(app.app)}
            onAction={(kind) => runReleaseAction(app.app, kind)}
            onStopLocal={() => stopLocal(app.app)}
          />
        ))}
      </ul>
      {!apps.length && <p className="muted small">No app with a release yet.</p>}
    </section>
  );
}
