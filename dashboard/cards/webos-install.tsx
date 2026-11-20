'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLumiereWebosStatus, installLumiereWebosOnAllTvs } from '@/status/install-webos';
import type { WebosInventory, WebosTv } from '@/status/webos-inventory';

const intervalMs = 30_000;

function tvLabel(tv: WebosTv, latest: string | null): string {
  switch (tv.state) {
    case 'current':
      return 'Up to date — will reinstall v' + latest;
    case 'outdated':
      return 'Update available — will install v' + latest;
    case 'ahead':
      return 'Ahead of published release — installing would downgrade to v' + latest;
    case 'missing':
      return 'Not installed — will install v' + latest;
    case 'unknown-version':
      return 'Installed (version unavailable) — will install v' + latest;
    case 'unpaired':
      return 'Not paired — pair on this PC before installing';
    case 'unavailable':
      return 'Offline or Developer Mode/key unavailable — cannot install';
  }
}

export function WebosInstall() {
  const [status, setStatus] = useState<WebosInventory | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const updated = await getLumiereWebosStatus();
      setStatus(updated);
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Cannot check webOS TVs.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const install = async () => {
    if (!status?.release || busy) return;
    const version = status.release.version;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const answer = await installLumiereWebosOnAllTvs(version);
      if (answer.ok) setResult(answer.message);
      else setError(answer.error);
      await refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not install Lumiere on LG TVs.');
    } finally {
      setBusy(false);
    }
  };

  const latest = status?.release;
  const canInstall = status?.tvs.some((tv) =>
    tv.state === 'current' || tv.state === 'outdated' ||
    tv.state === 'missing' || tv.state === 'unknown-version',
  );
  const hasNewer = status?.tvs.some((tv) => tv.state === 'ahead');

  return (
    <div className="webos-installer">
      <div className="webos-installer-actions">
        <button
          type="button"
          className="action"
          onClick={() => void install()}
          disabled={busy || checking || !latest || !canInstall || !!hasNewer}
          title={hasNewer
            ? 'One or more TVs have a version newer than the newest published IPK. Refusing a downgrade.'
            : 'Install the previewed GitHub webOS IPK on all paired, reachable LG TVs on this PC’s LAN'}
        >
          {busy ? 'Installing Lumiere on webOS…' : 'Install Lumiere on webOS'}
        </button>
        <button type="button" className="action" disabled={busy || checking} onClick={() => void refresh()}>
          {checking ? 'Checking TVs…' : 'Refresh TVs'}
        </button>
      </div>

      <div className="webos-installer-status" aria-live="polite">
        {!status && !error && <span className="muted small">Checking the newest webOS release and LG TVs…</span>}
        {status && (
          <>
            <p className="small">
              {latest ? (
                <>
                  Latest installable webOS release: <strong>v{latest.version}</strong>
                  {' · '}
                  <a href={latest.url} target="_blank" rel="noreferrer">{latest.fileName}</a>
                </>
              ) : (
                <span className="muted">Latest webOS release unknown</span>
              )}
            </p>
            {status.releaseError && <p className="install-error small">{status.releaseError}</p>}
            {status.error && <p className="install-error small">{status.error}</p>}
            {status.tvs.length ? (
              <ul className="webos-tv-list" aria-label="Live Lumiere installations by LG TV">
                {status.tvs.map((tv) => (
                  <li key={tv.ip}>
                    <strong>{tv.name}</strong> <span className="muted">({tv.ip})</span>:
                    {' '}
                    {tv.state === 'missing' ? 'not installed' : tv.installedVersion
                      ? 'installed v' + tv.installedVersion
                      : 'installed version unknown'}
                    {' · '}
                    <span className={tv.state === 'current' ? 'dev-key-ready' : tv.state === 'outdated' ? 'dev-key-missing' : 'muted'}>
                      {tvLabel(tv, latest?.version ?? null)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No registered or discovered LG TVs. Turn on the TVs and pair them from this PC.</p>
            )}
            {hasNewer && (
              <p className="install-error small">
                Installation is disabled to prevent downgrading a TV newer than the latest published release.
              </p>
            )}
            <p className="muted small">
              {canInstall && !hasNewer
                ? 'Click installs the shown IPK on every paired, reachable TV (including those already current).'
                : 'Pair or reconnect the TVs to enable installation.'}
              {' · '}
              Checked {new Date(status.checkedAt).toLocaleTimeString()} · refreshes every 30 s
            </p>
          </>
        )}
        {result && <p className="install-ok small" role="status">{result}</p>}
        {error && <p className="install-error small" role="alert">{error}</p>}
      </div>
    </div>
  );
}
