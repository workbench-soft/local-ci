import type { AppRelease } from '@/status/latest-releases';
import { dispatchSlackMs, dispatchVisibilityMs } from '@/status/release-dispatch-guard';
import { InstallButton } from './install-button';
import type { LocalAction } from './release-item';
import { RetryRunButtons } from './retry-run-buttons';
import { RunControls } from './run-controls';

type Props = {
  app: AppRelease;
  now: number;
  actions: LocalAction;
  hasReleaseWorkflow: boolean;
  canBuildLocally: boolean;
  localBuildRunning: boolean;
  localBuildStopping: boolean;
  onAction: (kind: 'dispatch' | 'build' | 'install') => void;
  onStopLocal: () => void;
};

/** Retry, stop, install, release on CI and the local build of one app. */
export function ReleaseButtons({
  app: { app, repo, release, state, run },
  now,
  actions,
  hasReleaseWorkflow,
  canBuildLocally,
  localBuildRunning,
  localBuildStopping,
  onAction,
  onStopLocal,
}: Props) {
  const releaseRunning = state === 'building' || state === 'queued';
  const dispatchedAt = actions.requestedAt;
  const dispatchAcknowledged =
    dispatchedAt !== undefined &&
    ((run && Date.parse(run.createdAt) >= dispatchedAt - dispatchSlackMs) ||
      (release && Date.parse(release.createdAt) >= dispatchedAt));
  const dispatchJustRequested =
    dispatchedAt !== undefined && now - dispatchedAt < dispatchVisibilityMs && !dispatchAcknowledged;
  if (!(release?.apk || hasReleaseWorkflow || canBuildLocally || (run && (state === 'errored' || releaseRunning))))
    return null;
  return (
    <div className="release-actions">
      {state === 'errored' && run && <RetryRunButtons repo={repo} runId={run.id} label={`${app} build`} />}
      {releaseRunning && run && (
        <RunControls
          repo={repo}
          runId={run.id}
          active
          label={`the active ${app} / ${run.workflow} run`}
          showPurge={false}
          stopText="Force stop"
        />
      )}
      {release?.apk && <InstallButton tag={release.tag} name={app} />}
      {hasReleaseWorkflow && (
        <button
          type="button"
          className="action release-on-ci"
          disabled={!!actions.busy || releaseRunning || dispatchJustRequested}
          title={releaseRunning ? 'Wait for the current release to finish or stop it first' : undefined}
          onClick={() => onAction('dispatch')}
        >
          {actions.busy === 'dispatch' ? 'Queueing' : 'Release on CI'}
        </button>
      )}
      {canBuildLocally && (
        <button
          type="button"
          className="action"
          disabled={!!actions.busy || localBuildRunning}
          onClick={() => onAction('build')}
          title="Fetch main and build in a temporary checkout on this PC"
        >
          {actions.busy === 'build' ? 'Building locally' : 'Build locally'}
        </button>
      )}
      {localBuildRunning && (
        <button
          type="button"
          className="action danger"
          disabled={localBuildStopping}
          onClick={onStopLocal}
          title="Force-stop this PC's local build process and all of its children"
        >
          {localBuildStopping ? 'Stopping local build' : 'Force stop local build'}
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
  );
}
