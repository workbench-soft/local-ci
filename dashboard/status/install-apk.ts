'use server';

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  adbError,
  adbMissing,
  execFileAsync,
  findAdb,
  installFileOn,
  installThenRemove,
  onePhone,
  type InstallResult,
} from './adb.ts';
import { isDevKeyConfigured } from './dev-key.ts';
import { callGitHub, githubStatus } from './org-status.ts';
import { type ApiRelease, releasesRepo, toRelease } from './releases.ts';
import { developerPackageForTag, developerUnlockCommand, launchActivity } from './dev-phone.ts';

export type { InstallResult } from './adb.ts';

const apkTimeoutMs = 180_000;

/** Downloads the APK of a release and installs it with adb on the phone plugged in over USB. */
export async function installRelease(tag: string): Promise<InstallResult> {
  // The browser sends the tag, so it is checked before it goes in a GitHub path.
  if (!/^[\w.-]+$/.test(tag)) return { ok: false, error: 'Unknown release.' };
  const adb = findAdb();
  if (!adb) return { ok: false, error: adbMissing };
  try {
    // The phone is checked first, so a missing one fails before the download.
    const phone = await onePhone(adb);
    if ('error' in phone) return { ok: false, error: phone.error };
    const found = await callGitHub(`/repos/${releasesRepo}/releases/tags/${tag}`).catch((error: Error) => {
      throw new Error(
        githubStatus(error) === 404
          ? `${tag} is gone from ${releasesRepo}. Refresh the page to see the newest release.`
          : error.message,
      );
    });
    const release = toRelease((await found.json()) as ApiRelease);
    if (!release.apk) return { ok: false, error: `${release.name} has no APK.` };
    // A stalled download would keep the button spinning for 5 min.
    const response = await fetch(release.apk.url, { signal: AbortSignal.timeout(apkTimeoutMs) });
    if (!response.ok) return { ok: false, error: `GitHub answered ${response.status} to the APK download.` };
    const folder = join(tmpdir(), 'local-ci-apk');
    await mkdir(folder, { recursive: true });
    const file = join(folder, release.apk.name.replace(/[^\w.-]/g, '_'));
    // A write cut short leaves a file too, so the delete covers it as well.
    return await installThenRemove(file, async () => {
      await writeFile(file, Buffer.from(await response.arrayBuffer()));
      return installFileOn(adb, phone.device, file);
    });
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

/** Installs the latest published APK, then unlocks the existing developer settings on that phone.
 * No differently signed debug APK is needed: every supported release accepts the developer key.
 */
export async function installDeveloperRelease(tag: string): Promise<InstallResult> {
  const packageName = typeof tag === 'string' ? developerPackageForTag(tag) : null;
  if (!packageName) return { ok: false, error: 'This release tag names no app.' };
  // Never send an empty or malformed key: the unlock belongs to the local PC, not the browser.
  const key = process.env.WORKBENCH_DEV_KEY;
  if (!isDevKeyConfigured(key)) {
    return { ok: false, error: 'Set WORKBENCH_DEV_KEY (64 hex characters) on this PC and restart the CI dashboard.' };
  }
  const installed = await installRelease(tag);
  if (!installed.ok) return installed;

  try {
    const adb = findAdb();
    if (!adb) throw new Error('adb is no longer available.');
    const { stdout } = await execFileAsync(
      adb,
      ['-s', installed.device, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', packageName],
      { timeout: 30_000 },
    );
    const activity = launchActivity(stdout, packageName);
    if (!activity) throw new Error(`Could not find the launch activity for ${packageName}.`);
    // Android's adb shell command line must not contain the developer key. Send it through stdin.
    await sendDeveloperUnlock(adb, installed.device, developerUnlockCommand(activity, key));
    return installed;
  } catch (error) {
    // Installation already succeeded, so don't imply that the APK failed.
    // Never return adb shell output: it could contain the secret link.
    return {
      ok: false,
      error: `Installed on ${installed.device}, but developer unlock was not confirmed. ${safeUnlockError(error)}`,
    };
  }
}

/** An adb shell without a command reads the URI from stdin rather than exposing the key in its process arguments. */
function sendDeveloperUnlock(adb: string, device: string, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(adb, ['-s', device, 'shell'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 30_000);
    child.stdout.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-4096);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-4096);
    });
    child.on('error', () => {
      clearTimeout(timeout);
      reject(new Error('Could not start adb shell.'));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      // Some Android versions return zero for "Error: Activity not started", so inspect the result.
      if (!timedOut && code === 0 && /Status:\s*ok/i.test(output) && !/Error:|Exception/i.test(output)) resolve();
      else reject(new Error(timedOut ? 'adb shell timed out.' : 'Android did not confirm the unlock link was opened.'));
    });
    child.stdin.on('error', () => reject(new Error('Could not write to adb shell.')));
    child.stdin.end(command);
  });
}

function safeUnlockError(error: unknown): string {
  return error instanceof Error ? error.message : 'Check the phone and retry the developer install.';
}
