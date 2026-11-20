'use client';

import { useState } from 'react';
import { inspectLocalMain, syncLocalMain, type SyncInspection } from '@/status/local-main-sync';

export function LocalMainButton({ repo }: { repo: string }) {
  const [inspection, setInspection] = useState<SyncInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const answer = await inspectLocalMain(repo);
      if (!answer.ok) {
        setError(answer.error);
        setInspection(null);
      } else {
        setInspection(answer);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const update = async (stash: boolean) => {
    if (!inspection?.ok) return;
    setBusy(true);
    setError(null);
    try {
      const answer = await syncLocalMain(repo, inspection.snapshot, stash);
      if (answer.ok) {
        setResult(
          'Updated main to ' +
            answer.commit.slice(0, 8) +
            (answer.stash
              ? '. Changes saved in stash ' + answer.stash.slice(0, 12) + '. Restore manually when ready.'
              : '.'),
        );
        setInspection(null);
      } else {
        setError(answer.error + (answer.stash ? ' Your changes remain in stash ' + answer.stash.slice(0, 12) : ''));
        setInspection(null);
      }
    } catch (e) {
      setError(String(e));
      setInspection(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="action"
        disabled={busy}
        onClick={review}
        aria-label={`Get latest main locally: ${repo}`}
      >
        {busy ? 'Checking / updating…' : 'Get latest main locally'}
      </button>
      {result && (
        <span role="status" className="install-ok small">
          {result}
        </span>
      )}
      {error && (
        <pre role="alert" className="install-error">
          {error}
        </pre>
      )}
      {inspection?.ok && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Review local changes in ${repo}`}
          className="local-main-dialog"
        >
          <h3>Update {repo} from origin/main?</h3>
          <p className="muted small">
            Branch: {inspection.branch} · Local: {inspection.local.slice(0, 8)} · Remote:{' '}
            {inspection.remote.slice(0, 8)}
          </p>
          {inspection.branch !== 'main' && (
            <p role="alert">Current branch is not main. Switch branches manually first.</p>
          )}
          {inspection.diverged && (
            <p role="alert">
              Local commits exist outside origin/main. Stash will not save these commits; resolve history manually.
            </p>
          )}
          {inspection.changes.length > 0 ? (
            <>
              <p role="alert">
                Warning: {inspection.changes.length} local changes found. Review them before saving to stash.
              </p>
              <div className="local-main-changes">
                {inspection.changes.map((change, i) => (
                  <details key={i}>
                    <summary>
                      {change.state} {change.path}
                    </summary>
                    <pre>{change.diff || 'No text diff available (possibly staged or binary).'}</pre>
                  </details>
                ))}
              </div>
              <p className="muted small">
                Stash includes untracked files. It is kept after updating and is not automatically reapplied. Ignored
                files are not stashed.
              </p>
            </>
          ) : (
            <p>Working tree is clean. Fast-forward main without overwriting local commits.</p>
          )}
          <div className="release-actions">
            <button
              type="button"
              className="action"
              disabled={busy || inspection.diverged || inspection.branch !== 'main'}
              onClick={() => update(inspection.changes.length > 0)}
            >
              {inspection.changes.length ? 'Stash and update' : 'Update main'}
            </button>
            <button type="button" className="action" disabled={busy} onClick={() => setInspection(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
