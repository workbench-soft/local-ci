import { formatAge } from '@/status/headline';
import type { AppRelease, ReleaseState } from '@/status/latest-releases';
import type { LiveJob } from '@/status/placement';
import { kindNames } from '@/status/runner-kind';
import { Icon, placeIcons, type IconName } from './icons';
import { Detail, OutcomeText, type Outcome } from './release-detail';
import { ReleaseProgress } from './release-progress';
import { ReleaseButtons } from './release-buttons';

export type LocalAction = {
  busy?: 'dispatch' | 'build' | 'install';
  requestedAt?: number;
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

type ItemProps = {
  app: AppRelease;
  now: number;
  jobs: LiveJob[];
  ticked: boolean;
  disabled: boolean;
  localBuildRunning: boolean;
  localBuildStopping: boolean;
  outcome: Outcome | undefined;
  actions: LocalAction;
  hasReleaseWorkflow: boolean;
  canBuildLocally: boolean;
  onToggle: () => void;
  onAction: (kind: 'dispatch' | 'build' | 'install') => void;
  onStopLocal: () => void;
};

export function AppItem({
  app: item,
  now,
  jobs,
  ticked,
  disabled,
  localBuildRunning,
  localBuildStopping,
  outcome,
  actions,
  hasReleaseWorkflow,
  canBuildLocally,
  onToggle,
  onAction,
  onStopLocal,
}: ItemProps) {
  const { app, repo, release, state, run, wait, why } = item;
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
        {run && run.machines.length > 0 && (
          <span className="release-platforms" aria-label={`Build platforms for ${app}`}>
            {run.machines.map((kind) => (
              <span className={`machine ${kind}`} key={kind} title={`A job runs on ${kindNames[kind]}`}>
                {kindNames[kind]}
              </span>
            ))}
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
      <ReleaseButtons
        app={item}
        now={now}
        actions={actions}
        hasReleaseWorkflow={hasReleaseWorkflow}
        canBuildLocally={canBuildLocally}
        localBuildRunning={localBuildRunning}
        localBuildStopping={localBuildStopping}
        onAction={onAction}
        onStopLocal={onStopLocal}
      />
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
