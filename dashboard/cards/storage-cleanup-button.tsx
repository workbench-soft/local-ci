'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { previewStorageCleanup, runStorageCleanupBatch } from '@/status/storage-cleanup-actions';
import { Icon } from './icons';

type Result = { error: boolean; text: string };

function storageSize(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(2) + ' GiB';
}

/** A deliberate, confirmed cleanup. Preview and deletion use the server's GitHub token, not browser credentials. */
export function StorageCleanupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const clean = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setStage('Checking repositories and releases…');
    try {
      const preview = await previewStorageCleanup();
      if (!preview.ok) {
        setResult({ error: true, text: preview.error });
        return;
      }
      if (!preview.artifacts && !preview.releases) {
        setResult({ error: false, text: 'Nothing to clean. Newest APK releases are already protected.' });
        return;
      }
      const confirmed = window.confirm(
        `Clean GitHub storage for all apps?\n\n` +
          `Delete ${preview.artifacts} old Actions artifacts (~${storageSize(preview.artifactBytes)}) and ` +
          `${preview.releases} outdated APK releases.\n\n` +
          `Keep the latest published APK release for each of ${preview.keptApps} apps. ` +
          `Protect ${preview.protectedArtifacts} artifacts from unfinished workflow runs.\n` +
          (preview.skippedArchivedRepos ? `Skip ${preview.skippedArchivedRepos} archived repositories.\n` : '') +
          `This cannot be undone. No current build will be cancelled.`,
      );
      if (!confirmed) return;
      let finished = false;
      while (!finished) {
        const progress = await runStorageCleanupBatch(preview.planId);
        if (!progress.ok) {
          setResult({ error: true, text: `Cleanup interrupted: ${progress.error} Run it again to retry.` });
          return;
        }
        setStage(
          `Deleted ${progress.deletedArtifacts} artifacts and ${progress.deletedReleases} old releases; ` +
            `${progress.remaining} remaining…`,
        );
        finished = progress.done;
        if (finished) {
          setResult({
            error: progress.failed > 0,
            text:
              `Deleted ${progress.deletedArtifacts} artifacts and ${progress.deletedReleases} old APK releases.` +
              (progress.failed ? ` ${progress.failed} failed. ${progress.error ?? ''}` : '') +
              ' GitHub may take time to update the storage quota.',
          });
          router.refresh();
        }
      }
    } catch (error) {
      setResult({ error: true, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setStage('');
      setBusy(false);
    }
  };

  return (
    <div className="storage-cleanup">
      <button type="button" className="action danger" disabled={busy} onClick={clean}>
        <Icon name="trash" />
        {busy ? 'Cleaning GitHub storage…' : 'Clean old APK releases & artifacts'}
      </button>
      <span className="muted small">
        Keeps the newest APK release per app and skips artifacts used by active builds. Other releases are untouched.
      </span>
      {busy && stage && (
        <span role="status" className="muted small">
          {stage}
        </span>
      )}
      {result && (
        <span
          role={result.error ? 'alert' : 'status'}
          className={result.error ? 'action-error small' : 'install-ok small'}
        >
          {result.text}
        </span>
      )}
    </div>
  );
}
