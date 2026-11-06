'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { retryRun } from '@/status/run-actions';
import { Icon } from './icons';

/** Retry a failed Actions run without leaving Local CI. The token stays on the server. */
export function RetryRunButtons({
  repo,
  runId,
  label,
  includeFailedJobs = false,
}: {
  repo: string;
  runId: number;
  label: string;
  includeFailedJobs?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'all' | 'failed' | null>(null);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async (kind: 'all' | 'failed') => {
    if (busy || queued) return;
    setBusy(kind);
    setError(null);
    try {
      const result = await retryRun(repo, runId, kind === 'failed');
      if (result.ok) {
        setQueued(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        className="action"
        disabled={busy !== null || queued}
        aria-label={`Rerun ${label}`}
        title="Restart the entire workflow on GitHub Actions"
        onClick={() => void retry('all')}
      >
        <Icon name="retry" />
        {queued ? 'Queued' : busy === 'all' ? 'Restarting' : 'Rerun build'}
      </button>
      {includeFailedJobs && (
        <button
          type="button"
          className="action"
          disabled={busy !== null || queued}
          aria-label={`Retry failed jobs of ${label}`}
          title="Retry only the failed jobs of this workflow"
          onClick={() => void retry('failed')}
        >
          {busy === 'failed' ? 'Retrying' : 'Retry failed jobs'}
        </button>
      )}
      {error && (
        <span className="action-error small" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
