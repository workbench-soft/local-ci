'use server';

import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { callGitHub, githubStatus } from './org-status.ts';
import { type ApiRelease, releasesRepo, toRelease } from './releases.ts';
import { developerPackageForTag, developerUnlockCommand, launchActivity } from './dev-phone.ts';

export type InstallResult = { ok: true; device: string } | { ok: false; error: string };

const execFileAsync = promisify(execFile);
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
const apkTimeoutMs = 180_000;

/** Downloads the APK of a release and installs it with adb on the phone plugged in over USB. */
export async function installRelease(tag: string): Promise<InstallResult> {
  // The browser sends the tag, so it is checked before it goes in a GitHub path.
  if (!/^[\w.-]+$/.test(tag)) return { ok: false, error: 'Unknown release.' };
  const adb = findAdb();
  if (!adb) return { ok: false, error: 'adb not found. Install Android platform tools, or set ADB_PATH.' };
  try {
    // The phone is checked first, so a missing one fails before the download.
    const devices = await listDevices(adb);
    if (devices.length === 0)
      return { ok: false, error: 'No phone in adb devices. Plug it in over USB and allow USB debugging.' };
    if (devices.length > 1)
      return {
        ok: false,
        error: `${devices.length} phones in adb devices: ${devices.join(', ')}. Leave one plugged in.`,
      };
    const found = await callGitHub(`/repos/${releasesRepo}/releases/tags/${tag}`).catch((error: Error) => {
      throw new Error(
        githubStatus(error) === 404
          ? `${tag} is gone from ${releasesRepo}. The repo keeps the last 3 releases of each app.`
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
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    return installFileOn(adb, devices[0], file);
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

/** Installs the latest published APK, then unlocks the existing developer settings on that phone.
 * No differently signed debug APK is needed: every supported release accepts the developer key.
 */
export async function installDeveloperRelease(tag: string): Promise<InstallResult> {
  const packageName = typeof tag === 'string' ? developerPackageForTag(tag) : null;
  if (!packageName) return { ok: false, error: 'This app has no confirmed developer unlock handler.' };
  // Never send an empty or malformed key: the unlock belongs to the local PC, not the browser.
  const key = process.env.WORKBENCH_DEV_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) {
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

/** Installs a local APK on the one authorized phone connected over USB. */
export async function installApkFile(file: string): Promise<InstallResult> {
  const adb = findAdb();
  if (!adb) return { ok: false, error: 'adb not found. Install Android platform tools, or set ADB_PATH.' };
  try {
    const devices = await listDevices(adb);
    if (devices.length === 0)
      return { ok: false, error: 'No phone in adb devices. Plug it in over USB and allow USB debugging.' };
    if (devices.length > 1)
      return {
        ok: false,
        error: `${devices.length} phones in adb devices: ${devices.join(', ')}. Leave one plugged in.`,
      };
    return installFileOn(adb, devices[0], file);
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

async function installFileOn(adb: string, device: string, file: string): Promise<InstallResult> {
  try {
    // -r keeps app data, and -d permits a lower version code from a local build.
    await execFileAsync(adb, ['-s', device, 'install', '-r', '-d', file], { timeout: 180_000 });
    return { ok: true, device };
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

async function listDevices(adb: string): Promise<string[]> {
  const { stdout } = await execFileAsync(adb, ['devices'], { timeout: 30_000 });
  return stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
}

// adb prints the reason, such as INSTALL_FAILED_UPDATE_INCOMPATIBLE, on stdout or stderr.
function adbError(error: unknown): string {
  const { stdout = '', stderr = '', message } = error as { stdout?: string; stderr?: string; message?: string };
  return `${stderr}\n${stdout}`.trim() || message || String(error);
}

// The boot task runs without a login shell, so PATH may lack adb.
function findAdb(): string | null {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.SystemDrive && join(process.env.SystemDrive, 'Android', 'Sdk'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
  ];
  const candidates = [
    process.env.ADB_PATH,
    ...(process.env.PATH ?? '').split(delimiter).map((dir) => dir && join(dir, adbName)),
    ...sdkRoots.map((root) => root && join(root, 'platform-tools', adbName)),
  ];
  return candidates.find((path): path is string => !!path && existsSync(path)) ?? null;
}
