'use server';

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { callGitHub } from './org-status.ts';
import { type ApiRelease, releasesRepo, toRelease } from './releases.ts';

export type InstallResult = { ok: true; device: string } | { ok: false; error: string };

const execFileAsync = promisify(execFile);
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';

/** Downloads the APK of a release and installs it with adb on the phone plugged in over USB. */
export async function installRelease(tag: string): Promise<InstallResult> {
	// The browser sends the tag, so it is checked before it goes in a GitHub path.
	if (!/^[\w.-]+$/.test(tag)) return { ok: false, error: 'Unknown release.' };
	const adb = findAdb();
	if (!adb) return { ok: false, error: 'adb not found. Install Android platform tools, or set ADB_PATH.' };
	try {
		// The phone is checked first, so a missing one fails before the download.
		const devices = await listDevices(adb);
		if (devices.length === 0) return { ok: false, error: 'No phone in adb devices. Plug it in over USB and allow USB debugging.' };
		if (devices.length > 1) return { ok: false, error: `${devices.length} phones in adb devices: ${devices.join(', ')}. Leave one plugged in.` };
		const found = await callGitHub(`/repos/${releasesRepo}/releases/tags/${tag}`).catch((error: Error) => {
			throw new Error(error.message.includes(' 404 ') ? `${tag} is gone from ${releasesRepo}. The repo keeps the last 3 releases of each app.` : error.message);
		});
		const release = toRelease((await found.json()) as ApiRelease);
		if (!release.apk) return { ok: false, error: `${release.name} has no APK.` };
		const response = await fetch(release.apk.url);
		if (!response.ok) return { ok: false, error: `GitHub answered ${response.status} to the APK download.` };
		const folder = join(tmpdir(), 'local-ci-apk');
		await mkdir(folder, { recursive: true });
		const file = join(folder, release.apk.name.replace(/[^\w.-]/g, '_'));
		await writeFile(file, Buffer.from(await response.arrayBuffer()));
		// -r keeps the app data, -d allows a lower version code than the installed one.
		await execFileAsync(adb, ['-s', devices[0], 'install', '-r', '-d', file], { timeout: 180_000 });
		return { ok: true, device: devices[0] };
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
	const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk')];
	const candidates = [
		process.env.ADB_PATH,
		...(process.env.PATH ?? '').split(delimiter).map((dir) => dir && join(dir, adbName)),
		...sdkRoots.map((root) => root && join(root, 'platform-tools', adbName)),
	];
	return candidates.find((path): path is string => !!path && existsSync(path)) ?? null;
}
