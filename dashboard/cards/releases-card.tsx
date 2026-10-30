'use client';

import { useState } from 'react';
import { formatAge } from '@/status/headline';
import { installRelease } from '@/status/install-apk';
import type { AppRelease } from '@/status/latest-releases';
import { Icon, placeIcons } from './icons';

type Outcome = 'queued' | 'installing' | { ok: boolean; text: string };

/** The newest release of each app, with its notes. The ticked APKs go on the phone over adb one by one. */
export function ReleasesCard({ apps, now }: { apps: AppRelease[]; now: number }) {
  // Apps stay ticked across refreshes, and Install takes the release that is newest at the click.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [running, setRunning] = useState(false);
  const withApk = apps.filter((app) => app.release.apk);
  const chosen = withApk.filter((app) => ticked.has(app.app));
  const allTicked = withApk.length > 0 && chosen.length === withApk.length;

  const toggle = (app: string) =>
    setTicked((current) => new Set(current.has(app) ? [...current].filter((item) => item !== app) : [...current, app]));
  const setOutcome = (app: string, outcome: Outcome) => setOutcomes((current) => ({ ...current, [app]: outcome }));

  const installChosen = async () => {
    setRunning(true);
    for (const { app } of chosen) setOutcome(app, 'queued');
    // adb installs on one phone, so the APKs go one after another.
    for (const { app, release } of chosen) {
      setOutcome(app, 'installing');
      const answer = await installRelease(release.tag).catch((error: Error) => ({
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
      <h2>Latest releases</h2>
      <p className="muted small">
        The newest release of each app. Tick the apps to put on the phone plugged in over USB, then press Install.
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
            ticked={ticked.has(app.app)}
            disabled={running}
            outcome={outcomes[app.app]}
            onToggle={() => toggle(app.app)}
          />
        ))}
      </ul>
      {!apps.length && <p className="muted small">No release in the public repo yet.</p>}
    </section>
  );
}

type ItemProps = {
  app: AppRelease;
  now: number;
  ticked: boolean;
  disabled: boolean;
  outcome: Outcome | undefined;
  onToggle: () => void;
};

function AppItem({ app: { app, repo, release, build }, now, ticked, disabled, outcome, onToggle }: ItemProps) {
  return (
    <li>
      <div className="release-head">
        <input
          type="checkbox"
          aria-label={`Install ${app}`}
          checked={ticked}
          disabled={disabled || !release.apk}
          onChange={onToggle}
          title={release.apk ? undefined : 'This release has no APK'}
        />
        <strong>{app}</strong>
        <a className="release-link" href={release.url} target="_blank" rel="noreferrer">
          <Icon name="package" />
          {release.name}
        </a>
        <span className="muted small nowrap">{formatAge(release.createdAt, now)}</span>
        {repo !== app && <span className="muted small">from {repo}</span>}
        <BuildState build={build} />
        <OutcomeText outcome={outcome} />
      </div>
      {release.notesHtml && (
        <details className="notes">
          <summary>Changes</summary>
          {/* GitHub renders the notes and strips scripts from them. */}
          <div dangerouslySetInnerHTML={{ __html: release.notesHtml }} />
        </details>
      )}
    </li>
  );
}

function BuildState({ build }: { build: AppRelease['build'] }) {
  if (!build) return <span className="result ok small">Latest</span>;
  const place = build.place === 'done' ? null : placeIcons[build.place];
  return (
    <a
      className={`result ${build.state === 'building' ? 'busy' : 'bad'} small`}
      href={build.url}
      target="_blank"
      rel="noreferrer"
      title={place?.hint}
    >
      <Icon name={build.state === 'building' ? 'running' : 'failure'} />
      {build.state === 'building'
        ? `Newer ${build.workflow}: ${place?.text ?? 'Building'}`
        : `${build.workflow} on main failed after it`}
    </a>
  );
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
