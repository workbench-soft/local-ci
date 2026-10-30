'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { purgeAllRuns } from '@/status/run-actions';
import { Icon } from './icons';

type Run = { repo: string; id: number };

// A refresh that takes longer than this ends the wait, and the loop reads the rows it has.
const refreshWaitMs = 30_000;
// GitHub may list a deleted run for a few seconds, so a load that still holds one is read again, up to this many times.
const staleLoadRetries = 6;
const staleLoadPauseMs = 5_000;

/**
 * Purges every run the table's filter and search match, after a confirm.
 * The page holds the latest 5 runs of each repo, so older runs show once those go.
 * It purges round after round until the filter and search match no run left.
 */
export function PurgeAllButton({
  runs,
  loadedAt,
  onPurging,
}: {
  runs: Run[];
  loadedAt: unknown;
  onPurging: (ids: ReadonlySet<number>) => void;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [purgedSoFar, setPurgedSoFar] = useState(0);
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  const latest = useRef(runs);
  const waiters = useRef<(() => void)[]>([]);

  useEffect(() => {
    latest.current = runs;
  }, [runs]);

  // Each new page load from the server wakes the round that waits for it.
  useEffect(() => {
    for (const wake of waiters.current.splice(0)) wake();
  }, [loadedAt]);

  const nextLoad = () =>
    new Promise<void>((resolve) => {
      waiters.current.push(resolve);
      setTimeout(resolve, refreshWaitMs);
      router.refresh();
    });

  const purgeAll = async () => {
    const count = runs.length === 1 ? '1 run' : `${runs.length} runs`;
    if (
      !window.confirm(
        `Purge ${count} that the filter and search match, and the older runs behind them? GitHub stops each run and deletes it with its logs and artifacts.`,
      )
    )
      return;
    setNote(null);
    setRunning(true);
    setPurgedSoFar(0);
    // A run tried once stays out of later rounds, so a run GitHub refuses can't loop.
    const tried = new Set<number>();
    const gone = new Set<number>();
    let purged = 0;
    let failed = 0;
    let error: string | null = null;
    let staleLoads = 0;
    try {
      for (;;) {
        const batch = latest.current.filter((run) => !tried.has(run.id));
        if (!batch.length) {
          // The page may still show runs this loop deleted, and the older runs behind them come with the next load.
          if (!latest.current.some((run) => gone.has(run.id)) || staleLoads++ >= staleLoadRetries) break;
          await new Promise((resolve) => setTimeout(resolve, staleLoadPauseMs));
          await nextLoad();
          continue;
        }
        staleLoads = 0;
        for (const run of batch) tried.add(run.id);
        // Deleted runs stay gray until the next load drops them.
        onPurging(new Set([...gone, ...batch.map((run) => run.id)]));
        const result = await purgeAllRuns(batch.map((run) => ({ repo: run.repo, runId: run.id })));
        const failedIds = new Set(result.failedIds);
        for (const run of batch) if (!failedIds.has(run.id)) gone.add(run.id);
        onPurging(new Set(gone));
        purged += result.purged;
        failed += result.failed;
        error ??= result.error;
        setPurgedSoFar(purged);
        await nextLoad();
      }
    } catch (thrown) {
      error ??= thrown instanceof Error ? thrown.message : String(thrown);
    } finally {
      onPurging(new Set());
      setRunning(false);
    }
    setNote(
      failed || error
        ? { text: `Purged ${purged}, ${failed} failed. ${error ?? ''}`.trim(), failed: true }
        : { text: `Purged ${purged}.`, failed: false },
    );
  };

  return (
    <div className="run-controls">
      <button
        type="button"
        className="action danger"
        disabled={running || !runs.length}
        onClick={purgeAll}
        title="Force cancel every run the filter and search match, older runs included, then delete them with their logs and artifacts"
      >
        <Icon name="trash" />
        {running ? `Purging, ${purgedSoFar} done` : `Purge all (${runs.length})`}
      </button>
      {note && (
        <span className={note.failed ? 'action-error small' : 'muted small'} role={note.failed ? 'alert' : 'status'}>
          {note.text}
        </span>
      )}
    </div>
  );
}
