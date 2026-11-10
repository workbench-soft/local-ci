'use client';

import { useState, useTransition } from 'react';
import { developerPackageForTag } from '@/status/dev-phone';
import { installDeveloperRelease, installRelease } from '@/status/install-apk';
import { Icon } from './icons';

/** Installs a published APK, optionally unlocking its existing developer settings on the connected phone. */
export function InstallButton({ tag, name }: { tag: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'release' | 'developer' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const hasDeveloperUnlock = developerPackageForTag(tag) !== null;

  const install = (kind: 'release' | 'developer') => {
    setResult(null);
    setMode(kind);
    startTransition(async () => {
      try {
        const answer = kind === 'developer' ? await installDeveloperRelease(tag) : await installRelease(tag);
        setResult(
          answer.ok
            ? {
                ok: true,
                text:
                  kind === 'developer'
                    ? `Installed on ${answer.device}. Developer unlock sent; use the app settings to control ads and paid features.`
                    : `Installed on ${answer.device}`,
              }
            : { ok: false, text: answer.error },
        );
      } catch (error) {
        setResult({ ok: false, text: error instanceof Error ? error.message : String(error) });
      } finally {
        setMode(null);
      }
    });
  };

  // The name starts with the words on the button, so a screen reader hears Installing and Enabling Dev too.
  const releaseWords = pending && mode === 'release' ? 'Installing' : 'Install Release';
  const devWords = pending && mode === 'developer' ? 'Enabling Dev' : 'Install Dev';
  return (
    <div className="install">
      <div className="install-choices">
        <button
          type="button"
          className="action"
          disabled={pending}
          onClick={() => install('release')}
          aria-label={`${releaseWords}: ${name}`}
          title={`Install the published ${name} APK on the phone over ADB, keeping app data`}
        >
          <Icon name="phone" />
          {releaseWords}
        </button>
        {hasDeveloperUnlock && (
          <button
            type="button"
            className="action"
            disabled={pending}
            onClick={() => install('developer')}
            aria-label={`${devWords}: ${name}`}
            title="Install the same release APK, then unlock the existing developer settings on this phone"
          >
            <Icon name="phone" />
            {devWords}
          </button>
        )}
      </div>
      {result &&
        (result.ok ? (
          <span className="install-ok small" role="status">
            {result.text}
          </span>
        ) : (
          <pre className="install-error" role="alert">
            {result.text}
          </pre>
        ))}
    </div>
  );
}
