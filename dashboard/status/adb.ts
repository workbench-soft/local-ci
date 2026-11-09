import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

// Plain helpers, kept out of the 'use server' files: each export there becomes an action the browser can call.
export type InstallResult = { ok: true; device: string } | { ok: false; error: string };

export const execFileAsync = promisify(execFile);
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';

/** The one authorized phone in adb devices, or the words that say why there is none. */
export async function onePhone(adb: string): Promise<{ device: string } | { error: string }> {
  const { stdout } = await execFileAsync(adb, ['devices'], { timeout: 30_000 });
  const devices = stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);
  if (devices.length === 0) return { error: 'No phone in adb devices. Plug it in over USB and allow USB debugging.' };
  if (devices.length > 1)
    return { error: `${devices.length} phones in adb devices: ${devices.join(', ')}. Leave one plugged in.` };
  return { device: devices[0] };
}

/** Installs an APK on the phone. -r keeps app data, and -d permits a lower version code from a local build. */
export async function installFileOn(adb: string, device: string, file: string): Promise<InstallResult> {
  try {
    await execFileAsync(adb, ['-s', device, 'install', '-r', '-d', file], { timeout: 180_000 });
    return { ok: true, device };
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

/** Installs a local APK on the one authorized phone connected over USB. */
export async function installApkFile(file: string): Promise<InstallResult> {
  const adb = findAdb();
  if (!adb) return { ok: false, error: adbMissing };
  try {
    const phone = await onePhone(adb);
    return 'error' in phone ? { ok: false, error: phone.error } : installFileOn(adb, phone.device, file);
  } catch (error) {
    return { ok: false, error: adbError(error) };
  }
}

export const adbMissing = 'adb not found. Install Android platform tools, or set ADB_PATH.';

// adb prints the reason, such as INSTALL_FAILED_UPDATE_INCOMPATIBLE, on stdout or stderr.
export function adbError(error: unknown): string {
  const { stdout = '', stderr = '', message } = error as { stdout?: string; stderr?: string; message?: string };
  return `${stderr}\n${stdout}`.trim() || message || String(error);
}

// The boot task runs without a login shell, so PATH may lack adb.
export function findAdb(): string | null {
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
