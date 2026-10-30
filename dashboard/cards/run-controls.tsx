'use client';

import { useEffect, useState, useTransition } from 'react';
import { purgeRunById, runFinished, stopRun } from '@/status/run-actions';
import { Icon } from './icons';

const finishCheckMs = 2_000;

/** Stop and Purge for one run. A finished run gets Purge only. */
export function RunControls({
  repo,
  runId,
  active,
  label,
  onPurging,
}: {
  repo: string;
  runId: number;
  active: boolean;
  label: string;
  onPurging?: (purging: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<'stop' | 'purge' | null>(null);
  const [stop, setStop] = useState<'idle' | 'stopping' | 'stopped'>('idle');
  const [error, setError] = useState<string | null>(null);

  // GitHub takes a few seconds to end a cancelled run, so Stopping stays until it reads as completed.
  useEffect(() => {
    if (stop !== 'stopping' || busy === 'stop') return;
    const timer = setInterval(async () => {
      const result = await runFinished(repo, runId);
      if (result.ok && result.finished) setStop('stopped');
    }, finishCheckMs);
    return () => clearInterval(timer);
  }, [stop, busy, repo, runId]);

  const run = (kind: 'stop' | 'purge') => {
    if (
      kind === 'purge' &&
      !window.confirm(`Purge ${label}? GitHub stops the run and deletes it with its logs and artifacts.`)
    )
      return;
    setBusy(kind);
    if (kind === 'stop') setStop('stopping');
    setError(null);
    if (kind === 'purge') onPurging?.(true);
    startTransition(async () => {
      const result = await (kind === 'stop' ? stopRun(repo, runId) : purgeRunById(repo, runId));
      if (!result.ok) {
        setError(result.error);
        if (kind === 'stop') setStop('idle');
        if (kind === 'purge') onPurging?.(false);
      }
      setBusy(null);
    });
  };

  return (
    <div className="run-controls">
      {(active || stop !== 'idle') && (
        <button
          type="button"
          className="action"
          disabled={pending || stop !== 'idle'}
          onClick={() => run('stop')}
          aria-label={`Stop ${label}`}
          title="Force cancel the run on GitHub, so its runner takes the next job"
        >
          <Icon name="stop" />
          {stop === 'stopping' ? 'Stopping' : stop === 'stopped' ? 'Stopped' : 'Stop'}
        </button>
      )}
      <button
        type="button"
        className="action danger"
        disabled={pending}
        onClick={() => run('purge')}
        aria-label={`Purge ${label}`}
        title="Force cancel the run, then delete it with its logs and artifacts"
      >
        <Icon name="trash" />
        {busy === 'purge' ? 'Purging' : 'Purge'}
      </button>
      {error && (
        <span className="action-error small" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
